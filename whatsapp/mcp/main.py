from typing import Any
from mcp.server.fastmcp import FastMCP
import queries

mcp = FastMCP("whatsapp-readonly")

@mcp.tool()
def search_contacts(query: str, limit: int = 30) -> list[dict[str, Any]]:
    """Search read-only WhatsApp chat contacts by name or number."""
    return queries.search_contacts(query, limit)

@mcp.tool()
def list_chats(query: str | None = None, limit: int = 20, page: int = 0) -> list[dict[str, Any]]:
    """List recent read-only WhatsApp chats."""
    return queries.list_chats(query, limit, page)

@mcp.tool()
def list_messages(after: str | None = None, before: str | None = None, sender: str | None = None,
                  chat_jid: str | None = None, query: str | None = None, limit: int = 20, page: int = 0) -> list[dict[str, Any]]:
    """Search read-only WhatsApp text and media metadata. Dates use ISO-8601."""
    return queries.list_messages(after, before, sender, chat_jid, query, limit, page)

@mcp.tool()
def get_chat(chat_jid: str) -> dict[str, Any] | None:
    """Read metadata for one WhatsApp chat."""
    return queries.get_chat(chat_jid)

@mcp.tool()
def get_direct_chat_by_contact(phone_number: str) -> dict[str, Any] | None:
    """Find a direct chat by phone number."""
    return queries.get_direct_chat_by_contact(phone_number)

@mcp.tool()
def get_contact_chats(contact: str, limit: int = 20) -> list[dict[str, Any]]:
    """List chats involving a contact identifier."""
    return queries.get_contact_chats(contact, limit)

@mcp.tool()
def get_last_interaction(contact: str) -> dict[str, Any] | None:
    """Read the latest interaction involving a contact."""
    return queries.get_last_interaction(contact)

@mcp.tool()
def get_message_context(message_id: str, before: int = 5, after: int = 5) -> dict[str, Any] | None:
    """Read bounded context around a message."""
    return queries.get_message_context(message_id, before, after)

if __name__ == "__main__":
    mcp.run(transport="stdio")

