import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_DB = Path(__file__).resolve().parent.parent / "bridge" / "store" / "messages.db"

def _connect() -> sqlite3.Connection:
    path = Path(os.environ.get("WHATSAPP_SQLITE_PATH", DEFAULT_DB)).resolve()
    if not path.exists():
        raise FileNotFoundError(f"WhatsApp message database not found: {path}")
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    return connection

def _limit(value: int, maximum: int = 100) -> int:
    return max(1, min(int(value), maximum))

def _rows(cursor: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.fetchall()]

def search_contacts(query: str, limit: int = 30) -> list[dict[str, Any]]:
    with _connect() as db:
        return _rows(db.execute("SELECT jid,name,last_message_time FROM chats WHERE lower(name) LIKE lower(?) OR jid LIKE ? ORDER BY last_message_time DESC LIMIT ?", (f"%{query}%", f"%{query}%", _limit(limit))))

def list_chats(query: str | None = None, limit: int = 20, page: int = 0) -> list[dict[str, Any]]:
    where, values = "", []
    if query:
        where, values = "WHERE lower(c.name) LIKE lower(?) OR c.jid LIKE ?", [f"%{query}%", f"%{query}%"]
    values.extend([_limit(limit), max(0, page) * _limit(limit)])
    sql = f"""SELECT c.jid,c.name,c.last_message_time,
        (SELECT content FROM messages m WHERE m.chat_jid=c.jid ORDER BY timestamp DESC LIMIT 1) last_message
        FROM chats c {where} ORDER BY c.last_message_time DESC LIMIT ? OFFSET ?"""
    with _connect() as db: return _rows(db.execute(sql, values))

def list_messages(after: str | None = None, before: str | None = None, sender: str | None = None,
                  chat_jid: str | None = None, query: str | None = None, limit: int = 20, page: int = 0) -> list[dict[str, Any]]:
    clauses, values = [], []
    for raw, operator in ((after, ">"), (before, "<")):
        if raw:
            datetime.fromisoformat(raw.replace("Z", "+00:00"))
            clauses.append(f"m.timestamp {operator} ?"); values.append(raw)
    if sender: clauses.append("m.sender = ?"); values.append(sender)
    if chat_jid: clauses.append("m.chat_jid = ?"); values.append(chat_jid)
    if query: clauses.append("lower(m.content) LIKE lower(?)"); values.append(f"%{query}%")
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    safe_limit = _limit(limit)
    values.extend([safe_limit, max(0, page) * safe_limit])
    sql = f"""SELECT m.id,m.chat_jid,c.name chat_name,m.sender,m.content,m.timestamp,
        m.is_from_me,m.media_type,m.filename FROM messages m JOIN chats c ON c.jid=m.chat_jid
        {where} ORDER BY m.timestamp DESC LIMIT ? OFFSET ?"""
    with _connect() as db: return _rows(db.execute(sql, values))

def get_chat(chat_jid: str) -> dict[str, Any] | None:
    with _connect() as db:
        row = db.execute("SELECT jid,name,last_message_time FROM chats WHERE jid=?", (chat_jid,)).fetchone()
        return dict(row) if row else None

def get_direct_chat_by_contact(phone_number: str) -> dict[str, Any] | None:
    clean = "".join(character for character in phone_number if character.isdigit())
    with _connect() as db:
        row = db.execute("SELECT jid,name,last_message_time FROM chats WHERE jid LIKE ? ORDER BY last_message_time DESC LIMIT 1", (f"{clean}@%",)).fetchone()
        return dict(row) if row else None

def get_contact_chats(contact: str, limit: int = 20) -> list[dict[str, Any]]:
    with _connect() as db:
        return _rows(db.execute("""SELECT DISTINCT c.jid,c.name,c.last_message_time FROM chats c
            JOIN messages m ON m.chat_jid=c.jid WHERE m.sender LIKE ? OR c.jid LIKE ?
            ORDER BY c.last_message_time DESC LIMIT ?""", (f"%{contact}%", f"%{contact}%", _limit(limit))))

def get_last_interaction(contact: str) -> dict[str, Any] | None:
    rows = list_messages(sender=contact, limit=1)
    if rows: return rows[0]
    with _connect() as db:
        row = db.execute("""SELECT m.id,m.chat_jid,c.name chat_name,m.sender,m.content,m.timestamp,m.is_from_me,m.media_type
            FROM messages m JOIN chats c ON c.jid=m.chat_jid WHERE m.chat_jid LIKE ?
            ORDER BY m.timestamp DESC LIMIT 1""", (f"%{contact}%",)).fetchone()
        return dict(row) if row else None

def get_message_context(message_id: str, before: int = 5, after: int = 5) -> dict[str, Any] | None:
    with _connect() as db:
        target = db.execute("SELECT * FROM messages WHERE id=? LIMIT 1", (message_id,)).fetchone()
        if not target: return None
        older = _rows(db.execute("SELECT * FROM messages WHERE chat_jid=? AND timestamp<? ORDER BY timestamp DESC LIMIT ?", (target["chat_jid"], target["timestamp"], _limit(before, 20))))
        newer = _rows(db.execute("SELECT * FROM messages WHERE chat_jid=? AND timestamp>? ORDER BY timestamp ASC LIMIT ?", (target["chat_jid"], target["timestamp"], _limit(after, 20))))
        return {"before": list(reversed(older)), "message": dict(target), "after": newer}

