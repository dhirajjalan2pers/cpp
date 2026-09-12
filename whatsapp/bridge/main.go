// Derived from lharries/whatsapp-mcp (MIT), pinned in THIRD_PARTY_NOTICES.md.
// This bridge has no HTTP server and no outbound messaging or media download path.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/signal"
	"reflect"
	"syscall"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/mdp/qrterminal"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

type messageStore struct{ db *sql.DB }

func newMessageStore() (*messageStore, error) {
	if err := os.MkdirAll("store", 0700); err != nil { return nil, err }
	db, err := sql.Open("sqlite3", "file:store/messages.db?_foreign_keys=on&_busy_timeout=5000")
	if err != nil { return nil, err }
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS chats (jid TEXT PRIMARY KEY, name TEXT, last_message_time TIMESTAMP);
		CREATE TABLE IF NOT EXISTS messages (
			id TEXT NOT NULL, chat_jid TEXT NOT NULL, sender TEXT, content TEXT NOT NULL DEFAULT '',
			timestamp TIMESTAMP NOT NULL, is_from_me BOOLEAN NOT NULL DEFAULT 0,
			media_type TEXT, filename TEXT, PRIMARY KEY (id, chat_jid),
			FOREIGN KEY (chat_jid) REFERENCES chats(jid)
		);
		CREATE INDEX IF NOT EXISTS messages_timestamp ON messages(timestamp DESC);
		CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_jid, timestamp DESC);
	`)
	if err != nil { db.Close(); return nil, err }
	return &messageStore{db: db}, nil
}

func (s *messageStore) chat(jid, name string, at time.Time) error {
	_, err := s.db.Exec(`INSERT INTO chats(jid,name,last_message_time) VALUES(?,?,?)
		ON CONFLICT(jid) DO UPDATE SET name=CASE WHEN excluded.name='' THEN chats.name ELSE excluded.name END,
		last_message_time=MAX(chats.last_message_time,excluded.last_message_time)`, jid, name, at)
	return err
}

func (s *messageStore) message(id, chatJID, sender, content string, at time.Time, fromMe bool, mediaType, filename string) error {
	if id == "" || (content == "" && mediaType == "") { return nil }
	_, err := s.db.Exec(`INSERT INTO messages(id,chat_jid,sender,content,timestamp,is_from_me,media_type,filename)
		VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id,chat_jid) DO UPDATE SET sender=excluded.sender,
		content=excluded.content,is_from_me=excluded.is_from_me,media_type=excluded.media_type,
		filename=excluded.filename,timestamp=MIN(messages.timestamp,excluded.timestamp)`,
		id, chatJID, sender, content, at, fromMe, mediaType, filename)
	return err
}

func textContent(message *waProto.Message) string {
	if message == nil { return "" }
	if value := message.GetConversation(); value != "" { return value }
	if value := message.GetExtendedTextMessage(); value != nil { return value.GetText() }
	return ""
}

func mediaMetadata(message *waProto.Message) (string, string) {
	if message == nil { return "", "" }
	if message.GetImageMessage() != nil { return "image", "" }
	if message.GetVideoMessage() != nil { return "video", "" }
	if message.GetAudioMessage() != nil { return "audio", "" }
	if document := message.GetDocumentMessage(); document != nil { return "document", document.GetFileName() }
	if message.GetStickerMessage() != nil { return "sticker", "" }
	return "", ""
}

func fieldString(value any, names ...string) string {
	v := reflect.ValueOf(value)
	if v.Kind() == reflect.Ptr && !v.IsNil() { v = v.Elem() }
	if !v.IsValid() || v.Kind() != reflect.Struct { return "" }
	for _, name := range names {
		field := v.FieldByName(name)
		if field.IsValid() && field.Kind() == reflect.Ptr && !field.IsNil() && field.Elem().Kind() == reflect.String { return field.Elem().String() }
	}
	return ""
}

func chatName(client *whatsmeow.Client, store *messageStore, jid types.JID, history any, sender string) string {
	var existing sql.NullString
	if store.db.QueryRow("SELECT name FROM chats WHERE jid=?", jid.String()).Scan(&existing) == nil && existing.Valid && existing.String != "" { return existing.String }
	if name := fieldString(history, "DisplayName", "Name"); name != "" { return name }
	if jid.Server == "g.us" {
		if info, err := client.GetGroupInfo(context.Background(), jid); err == nil && info.Name != "" { return info.Name }
	}
	if contact, err := client.Store.Contacts.GetContact(context.Background(), jid); err == nil {
		if contact.FullName != "" { return contact.FullName }
		if contact.PushName != "" { return contact.PushName }
	}
	if sender != "" { return sender }
	return jid.User
}

func handleLive(client *whatsmeow.Client, store *messageStore, event *events.Message, log waLog.Logger) {
	chatJID := event.Info.Chat.String()
	sender := event.Info.Sender.String()
	name := chatName(client, store, event.Info.Chat, nil, sender)
	if err := store.chat(chatJID, name, event.Info.Timestamp); err != nil { log.Warnf("store chat: %v", err) }
	content := textContent(event.Message)
	mediaType, filename := mediaMetadata(event.Message)
	if err := store.message(event.Info.ID, chatJID, sender, content, event.Info.Timestamp, event.Info.IsFromMe, mediaType, filename); err != nil { log.Warnf("store message: %v", err) }
}

func handleHistory(client *whatsmeow.Client, store *messageStore, event *events.HistorySync, log waLog.Logger) {
	for _, conversation := range event.Data.Conversations {
		if conversation.ID == nil { continue }
		jid, err := types.ParseJID(*conversation.ID)
		if err != nil { continue }
		name := chatName(client, store, jid, conversation, "")
		for _, wrapped := range conversation.Messages {
			if wrapped == nil || wrapped.Message == nil || wrapped.Message.Message == nil { continue }
			message := wrapped.Message
			at := time.Unix(int64(message.GetMessageTimestamp()), 0)
			if at.Unix() <= 0 { continue }
			_ = store.chat(jid.String(), name, at)
			fromMe := message.GetKey().GetFromMe()
			sender := message.GetKey().GetParticipant()
			if sender == "" { if fromMe && client.Store.ID != nil { sender = client.Store.ID.String() } else { sender = jid.String() } }
			mediaType, filename := mediaMetadata(message.Message)
			if err := store.message(message.GetKey().GetID(), jid.String(), sender, textContent(message.Message), at, fromMe, mediaType, filename); err != nil { log.Warnf("store history: %v", err) }
		}
	}
}

func main() {
	log := waLog.Stdout("ReadonlyBridge", "INFO", true)
	if err := os.MkdirAll("store", 0700); err != nil { log.Errorf("create store: %v", err); return }
	container, err := sqlstore.New(context.Background(), "sqlite3", "file:store/whatsapp.db?_foreign_keys=on", waLog.Stdout("Database", "WARN", true))
	if err != nil { log.Errorf("session database: %v", err); return }
	device, err := container.GetFirstDevice(context.Background())
	if err == sql.ErrNoRows { device = container.NewDevice() } else if err != nil { log.Errorf("load device: %v", err); return }
	client := whatsmeow.NewClient(device, log)
	store, err := newMessageStore()
	if err != nil { log.Errorf("message database: %v", err); return }
	defer store.db.Close()
	client.AddEventHandler(func(raw any) {
		switch event := raw.(type) {
		case *events.Message: handleLive(client, store, event, log)
		case *events.HistorySync: handleHistory(client, store, event, log)
		case *events.Connected: log.Infof("Connected; read-only message capture is active")
		case *events.LoggedOut: log.Warnf("Linked device logged out; re-link with a QR code")
		}
	})
	if client.Store.ID == nil {
		qr, err := client.GetQRChannel(context.Background())
		if err != nil { log.Errorf("QR channel: %v", err); return }
		if err = client.Connect(); err != nil { log.Errorf("connect: %v", err); return }
		for event := range qr {
			if event.Event == "code" { fmt.Println("Scan in WhatsApp → Linked devices:"); qrterminal.GenerateHalfBlock(event.Code, qrterminal.L, os.Stdout) }
			if event.Event == "success" { break }
		}
	} else if err = client.Connect(); err != nil { log.Errorf("connect: %v", err); return }
	fmt.Println("Read-only WhatsApp bridge running. Press Ctrl+C to stop.")
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	client.Disconnect()
}

