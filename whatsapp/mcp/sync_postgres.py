"""Opt-in, one-shot SQLite to Postgres mirror for read-only web context."""
import os
import sqlite3
from pathlib import Path
import psycopg

MCP_DIR = Path(__file__).resolve().parent
STARTER_DIR = MCP_DIR.parent.parent
DASHBOARD_DIR = STARTER_DIR / "dashboard"

def load_env() -> None:
    path = DASHBOARD_DIR / ".env.local"
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"\''))

def source_path() -> Path:
    configured = os.environ.get("WHATSAPP_SQLITE_PATH", "../whatsapp/bridge/store/messages.db")
    path = Path(configured)
    return path.resolve() if path.is_absolute() else (DASHBOARD_DIR / path).resolve()

def read_source(path: Path, cursor: int):
    db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    chats = [dict(row) for row in db.execute("SELECT jid,name,last_message_time FROM chats")]
    messages = [dict(row) for row in db.execute("""SELECT rowid,id,chat_jid,sender,content,timestamp,is_from_me,media_type
        FROM messages WHERE rowid > ? ORDER BY rowid""", (cursor,))]
    db.close()
    return chats, messages

def sync() -> None:
    load_env()
    if os.environ.get("ENABLE_WHATSAPP_WEB_SYNC") != "true":
        raise SystemExit("WhatsApp web sync is disabled. Set ENABLE_WHATSAPP_WEB_SYNC=true only after accepting the privacy implications.")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    path = source_path()
    if not path.exists():
        raise SystemExit(f"WhatsApp message database not found: {path}")
    with psycopg.connect(database_url) as pg:
        row = pg.execute("SELECT last_rowid FROM whatsapp_sync_state WHERE singleton=TRUE").fetchone()
        cursor = int(row[0]) if row else 0
        chats, messages = read_source(path, cursor)
        try:
            for chat in chats:
                pg.execute("""INSERT INTO whatsapp_chats(jid,name,last_message_at,updated_at) VALUES(%s,%s,%s,now())
                    ON CONFLICT(jid) DO UPDATE SET name=COALESCE(EXCLUDED.name,whatsapp_chats.name),
                    last_message_at=GREATEST(EXCLUDED.last_message_at,whatsapp_chats.last_message_at),updated_at=now()""",
                    (chat["jid"], chat["name"], chat["last_message_time"]))
                if not chat["jid"].endswith("@g.us"):
                    pg.execute("""INSERT INTO whatsapp_contacts(jid,phone_number,name,updated_at) VALUES(%s,%s,%s,now())
                        ON CONFLICT(jid) DO UPDATE SET phone_number=EXCLUDED.phone_number,
                        name=COALESCE(EXCLUDED.name,whatsapp_contacts.name),updated_at=now()""",
                        (chat["jid"], chat["jid"].split("@")[0], chat["name"]))
            for message in messages:
                pg.execute("""INSERT INTO whatsapp_messages(sqlite_rowid,message_id,chat_jid,sender,content,is_from_me,media_type,sent_at)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(chat_jid,message_id) DO UPDATE SET
                    sqlite_rowid=EXCLUDED.sqlite_rowid,sender=EXCLUDED.sender,content=EXCLUDED.content,
                    is_from_me=EXCLUDED.is_from_me,media_type=EXCLUDED.media_type,
                    sent_at=LEAST(whatsapp_messages.sent_at,EXCLUDED.sent_at)""",
                    (message["rowid"], message["id"], message["chat_jid"], message["sender"], message["content"] or "",
                     bool(message["is_from_me"]), message["media_type"], message["timestamp"]))
            latest = int(messages[-1]["rowid"]) if messages else cursor
            pg.execute("""INSERT INTO whatsapp_sync_state(singleton,last_rowid,last_synced_at,last_error) VALUES(TRUE,%s,now(),NULL)
                ON CONFLICT(singleton) DO UPDATE SET last_rowid=%s,last_synced_at=now(),last_error=NULL""", (latest, latest))
        except Exception as error:
            pg.rollback()
            with pg.transaction():
                pg.execute("""INSERT INTO whatsapp_sync_state(singleton,last_rowid,last_synced_at,last_error) VALUES(TRUE,%s,now(),%s)
                    ON CONFLICT(singleton) DO UPDATE SET last_synced_at=now(),last_error=%s""", (cursor, str(error), str(error)))
            raise
    print(f"Synced {len(messages)} new message(s) and reconciled {len(chats)} chat(s).")

if __name__ == "__main__":
    sync()

