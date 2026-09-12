import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
import queries

class ReadonlyQueriesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "messages.db"
        db = sqlite3.connect(self.path)
        db.executescript("""
            CREATE TABLE chats(jid TEXT PRIMARY KEY,name TEXT,last_message_time TEXT);
            CREATE TABLE messages(id TEXT,chat_jid TEXT,sender TEXT,content TEXT,timestamp TEXT,is_from_me INTEGER,media_type TEXT,filename TEXT,PRIMARY KEY(id,chat_jid));
            INSERT INTO chats VALUES('100@s.whatsapp.net','Example Contact','2030-01-01T10:00:00Z');
            INSERT INTO messages VALUES('m1','100@s.whatsapp.net','100@s.whatsapp.net','Synthetic hello','2030-01-01T10:00:00Z',0,NULL,NULL);
        """)
        db.commit(); db.close()
        os.environ["WHATSAPP_SQLITE_PATH"] = str(self.path)

    def tearDown(self):
        os.environ.pop("WHATSAPP_SQLITE_PATH", None)
        self.temp.cleanup()

    def test_search_and_context(self):
        self.assertEqual(queries.search_contacts("Example")[0]["jid"], "100@s.whatsapp.net")
        self.assertEqual(queries.list_messages(query="hello")[0]["id"], "m1")
        self.assertEqual(queries.get_message_context("m1")["message"]["content"], "Synthetic hello")

    def test_database_connection_is_query_only(self):
        connection = queries._connect()
        with self.assertRaises(sqlite3.OperationalError):
            connection.execute("DELETE FROM messages")
        connection.close()

if __name__ == "__main__":
    unittest.main()

