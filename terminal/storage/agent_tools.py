"""Agent tools storage - CRUD operations for CLI agent tools.

Agent tools define CLI tools (Claude Code, OpenCode, etc.) that can be
launched in terminal sessions. Each tool has a slug used as the session mode.
"""

from __future__ import annotations

from typing import Any

from .connection import get_connection

#: Sentinel value callers pass to explicitly clear a nullable field (set it to SQL NULL).
UNSET = object()

AGENT_TOOL_FIELDS = (
    "id, name, slug, command, process_name, description, color, "
    "display_order, is_default, enabled, created_at, updated_at"
)

_FIELD_NAMES = [f.strip() for f in AGENT_TOOL_FIELDS.split(",")]


def _row_to_dict(row: tuple) -> dict[str, Any]:
    """Convert a database row to a dict."""
    return dict(zip(_FIELD_NAMES, row, strict=True))


def list_all() -> list[dict[str, Any]]:
    """List all agent tools ordered by display_order."""
    query = f"SELECT {AGENT_TOOL_FIELDS} FROM agent_tools ORDER BY display_order, name"
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query)
        return [_row_to_dict(row) for row in cur.fetchall()]


def list_enabled() -> list[dict[str, Any]]:
    """List enabled agent tools ordered by display_order."""
    query = f"SELECT {AGENT_TOOL_FIELDS} FROM agent_tools WHERE enabled = true ORDER BY display_order, name"
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query)
        return [_row_to_dict(row) for row in cur.fetchall()]


def get_by_slug(slug: str) -> dict[str, Any] | None:
    """Get an agent tool by slug."""
    query = f"SELECT {AGENT_TOOL_FIELDS} FROM agent_tools WHERE slug = %s"
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (slug,))
        row = cur.fetchone()
        return _row_to_dict(row) if row else None


def get_by_id(tool_id: str) -> dict[str, Any] | None:
    """Get an agent tool by ID."""
    query = f"SELECT {AGENT_TOOL_FIELDS} FROM agent_tools WHERE id = %s"
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (tool_id,))
        row = cur.fetchone()
        return _row_to_dict(row) if row else None


def get_default() -> dict[str, Any] | None:
    """Get the default agent tool (is_default=true)."""
    query = f"SELECT {AGENT_TOOL_FIELDS} FROM agent_tools WHERE is_default = true LIMIT 1"
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query)
        row = cur.fetchone()
        return _row_to_dict(row) if row else None


def create(
    name: str,
    slug: str,
    command: str,
    process_name: str,
    description: str | None = None,
    color: str | None = None,
    display_order: int = 0,
    is_default: bool = False,
    enabled: bool = True,
) -> dict[str, Any]:
    """Create a new agent tool."""
    with get_connection() as conn, conn.cursor() as cur:
        # If setting as default, clear existing default
        if is_default:
            cur.execute("UPDATE agent_tools SET is_default = false WHERE is_default = true")
        cur.execute(
            f"""
            INSERT INTO agent_tools (name, slug, command, process_name, description, color, display_order, is_default, enabled)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {AGENT_TOOL_FIELDS}
            """,
            (name, slug, command, process_name, description, color, display_order, is_default, enabled),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise ValueError("Failed to create agent tool")
    return _row_to_dict(row)


def update(tool_id: str, **fields: Any) -> dict[str, Any] | None:
    """Update an agent tool. Slug is immutable after creation.

    Pass ``UNSET`` as the value for a nullable field (e.g. ``description`` or
    ``color``) to clear it (set it to SQL NULL).  Fields whose values are plain
    ``None`` are treated the same way — they are included in the UPDATE so the
    column is set to NULL.  Only keys that are not in the allowed set are
    silently ignored.
    """
    allowed = {"name", "command", "process_name", "description", "color", "display_order", "is_default", "enabled"}
    # Resolve UNSET → None (SQL NULL) and keep all allowed keys, including those
    # explicitly set to None so callers can clear nullable fields.
    updates = {k: (None if v is UNSET else v) for k, v in fields.items() if k in allowed}
    if not updates:
        return get_by_id(tool_id)

    with get_connection() as conn, conn.cursor() as cur:
        # If setting as default, clear existing default first
        if updates.get("is_default"):
            cur.execute("UPDATE agent_tools SET is_default = false WHERE is_default = true AND id != %s", (tool_id,))

        set_parts = [f"{k} = %s" for k in updates]
        set_parts.append("updated_at = NOW()")
        values = [*updates.values(), tool_id]
        cur.execute(
            f"UPDATE agent_tools SET {', '.join(set_parts)} WHERE id = %s RETURNING {AGENT_TOOL_FIELDS}",
            values,
        )
        row = cur.fetchone()
        conn.commit()
    return _row_to_dict(row) if row else None


def delete(tool_id: str) -> bool:
    """Delete an agent tool. Returns True if deleted."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM agent_tools WHERE id = %s RETURNING id", (tool_id,))
        result = cur.fetchone()
        conn.commit()
    return result is not None


def has_active_sessions(slug: str) -> bool:
    """Check if any active sessions reference this agent tool slug."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM terminal_sessions WHERE mode = %s AND is_alive = true)",
            (slug,),
        )
        row = cur.fetchone()
    return bool(row and row[0])
