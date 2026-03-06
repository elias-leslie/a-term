"""Terminal panes storage - CRUD operations.

Panes contain 1-2 sessions (ad-hoc: 1 shell, project: shell + agent tool).
"""

from __future__ import annotations

from typing import Any, Literal

import psycopg.sql

from ._pane_helpers import (
    _compute_session_number,
    _get_next_pane_order,
    _insert_session,
    count_panes,
    get_next_pane_number,
    swap_pane_positions,
    update_pane_layouts,
    update_pane_order,
)
from .connection import get_connection
from .pane_db_helpers import (
    PANE_FIELDS,
    PaneId,
    execute_pane_query,
    normalize_pane_id,
    row_to_pane_dict,
)
from .pane_sessions import fetch_all_sessions_by_pane, fetch_sessions_for_pane
from .pane_validation import validate_pane_type_and_project

MAX_PANES = 4


# Import lazily to avoid circular imports
def _get_default_agent_slug() -> str:
    """Get the default agent tool slug, falling back to 'claude'."""
    from . import agent_tools
    default = agent_tools.get_default()
    return default["slug"] if default else "claude"


def _enforce_pane_limit(cur: Any, max_panes: int = MAX_PANES) -> None:
    """Enforce pane limit within the current transaction to avoid race conditions."""
    cur.execute("LOCK TABLE terminal_panes IN SHARE ROW EXCLUSIVE MODE")
    cur.execute("SELECT COUNT(*) FROM terminal_panes")
    row = cur.fetchone()
    current_count = int(row[0]) if row else 0
    if current_count >= max_panes:
        raise ValueError(f"Maximum {max_panes} panes allowed. Close one to add more.")


def list_panes() -> list[dict[str, Any]]:
    """List all panes ordered by pane_order."""
    query = f"SELECT {PANE_FIELDS} FROM terminal_panes ORDER BY pane_order"
    return execute_pane_query(query, (), fetch_mode="all")


def get_pane(pane_id: PaneId) -> dict[str, Any] | None:
    """Get a pane by ID."""
    query = f"SELECT {PANE_FIELDS} FROM terminal_panes WHERE id = %s"
    return execute_pane_query(query, (normalize_pane_id(pane_id),))


def get_pane_with_sessions(pane_id: PaneId) -> dict[str, Any] | None:
    """Get a pane with its sessions."""
    pane = get_pane(pane_id)
    if not pane:
        return None
    pane["sessions"] = fetch_sessions_for_pane(pane_id)
    return pane


def list_panes_with_sessions() -> list[dict[str, Any]]:
    """List all panes with their sessions."""
    panes = list_panes()
    if not panes:
        return []
    sessions_by_pane = fetch_all_sessions_by_pane()
    for pane in panes:
        pane["sessions"] = sessions_by_pane.get(pane["id"], [])
    return panes


def create_pane(
    pane_type: Literal["project", "adhoc"],
    pane_name: str,
    project_id: str | None = None,
    pane_order: int | None = None,
) -> dict[str, Any]:
    """Create a new pane (without sessions)."""
    validate_pane_type_and_project(pane_type, project_id)
    with get_connection() as conn, conn.cursor() as cur:
        _enforce_pane_limit(cur)
        if pane_order is None:
            pane_order = _get_next_pane_order(cur)
        cur.execute(
            f"INSERT INTO terminal_panes (pane_type, project_id, pane_order, pane_name) VALUES (%s, %s, %s, %s) RETURNING {PANE_FIELDS}",
            (pane_type, project_id, pane_order, pane_name),
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            raise ValueError("Failed to create pane")
        return row_to_pane_dict(row)


def create_pane_with_sessions(
    pane_type: Literal["project", "adhoc"],
    pane_name: str,
    project_id: str | None = None,
    working_dir: str | None = None,
    pane_order: int | None = None,
    agent_tool_slug: str | None = None,
) -> dict[str, Any]:
    """Atomically create a pane with its sessions.

    Args:
        agent_tool_slug: Override the default agent tool slug for the agent session.
            If None, uses the default agent tool from the DB.
    """
    validate_pane_type_and_project(pane_type, project_id)
    with get_connection() as conn, conn.cursor() as cur:
        _enforce_pane_limit(cur)
        if pane_order is None:
            pane_order = _get_next_pane_order(cur)
        tool_slug = agent_tool_slug or _get_default_agent_slug()
        default_mode = tool_slug if pane_type == "project" else "shell"
        cur.execute(
            f"INSERT INTO terminal_panes (pane_type, project_id, pane_order, pane_name, active_mode) VALUES (%s, %s, %s, %s, %s) RETURNING {PANE_FIELDS}",
            (pane_type, project_id, pane_order, pane_name, default_mode),
        )
        pane_row = cur.fetchone()
        if not pane_row:
            raise ValueError("Failed to create pane")
        pane = row_to_pane_dict(pane_row)
        session_number = _compute_session_number(cur, project_id)
        session_name = f"Project: {project_id}" if project_id else pane_name
        sessions = [
            _insert_session(
                cur, session_name, project_id, working_dir, "shell", session_number, pane["id"]
            )
        ]
        if pane_type == "project":
            sessions.append(
                _insert_session(
                    cur, session_name, project_id, working_dir, tool_slug, session_number, pane["id"]
                )
            )
        conn.commit()
        pane["sessions"] = sessions
        return pane


def update_pane(pane_id: PaneId, **fields: Any) -> dict[str, Any] | None:
    """Update pane metadata."""
    allowed = {
        "pane_name",
        "pane_order",
        "active_mode",
        "width_percent",
        "height_percent",
        "grid_row",
        "grid_col",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_pane(pane_id)
    set_clauses = [psycopg.sql.SQL("{} = %s").format(psycopg.sql.Identifier(f)) for f in updates]
    values = [*updates.values(), normalize_pane_id(pane_id)]
    query = psycopg.sql.SQL(
        f"UPDATE terminal_panes SET {{}} WHERE id = %s RETURNING {PANE_FIELDS}"
    ).format(psycopg.sql.SQL(", ").join(set_clauses))
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, values)
        row = cur.fetchone()
        conn.commit()
    return row_to_pane_dict(row) if row else None


def delete_pane(pane_id: PaneId) -> bool:
    """Delete a pane and all its sessions (cascading delete).

    Deletes child sessions first since there's no FK CASCADE constraint,
    then deletes the pane itself. Both happen in a single transaction.
    """
    normalized_id = normalize_pane_id(pane_id)
    with get_connection() as conn, conn.cursor() as cur:
        # Delete child sessions first to prevent orphans
        cur.execute("DELETE FROM terminal_sessions WHERE pane_id = %s", (normalized_id,))
        cur.execute(
            "DELETE FROM terminal_panes WHERE id = %s RETURNING id", (normalized_id,)
        )
        result = cur.fetchone()
        conn.commit()
    return result is not None


__all__ = [
    "PANE_FIELDS",
    "PaneId",
    "count_panes",
    "create_pane",
    "create_pane_with_sessions",
    "delete_pane",
    "get_next_pane_number",
    "get_pane",
    "get_pane_with_sessions",
    "list_panes",
    "list_panes_with_sessions",
    "swap_pane_positions",
    "update_pane",
    "update_pane_layouts",
    "update_pane_order",
]
