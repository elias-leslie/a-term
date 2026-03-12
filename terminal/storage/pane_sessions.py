"""Session fetching logic for terminal panes."""

from __future__ import annotations

from typing import Any

from .connection import get_connection
from .pane_db_helpers import PaneId, normalize_pane_id
from .terminal_crud import TERMINAL_SESSION_FIELDS, _row_to_dict


def fetch_sessions_for_pane(pane_id: PaneId) -> list[dict[str, Any]]:
    """Fetch all sessions for a given pane.

    Args:
        pane_id: Pane UUID

    Returns:
        List of session dicts
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {TERMINAL_SESSION_FIELDS}
            FROM terminal_sessions
            WHERE pane_id = %s
            ORDER BY mode
            """,
            (normalize_pane_id(pane_id),),
        )
        rows = cur.fetchall()
        return [_row_to_dict(row) for row in rows]


def fetch_all_sessions_by_pane() -> dict[str, list[dict[str, Any]]]:
    """Fetch all sessions grouped by pane_id.

    Returns:
        Dict mapping pane_id to list of session dicts
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {TERMINAL_SESSION_FIELDS}
            FROM terminal_sessions
            WHERE pane_id IS NOT NULL
            ORDER BY pane_id, mode
            """
        )
        rows = cur.fetchall()

    sessions_by_pane: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        session = _row_to_dict(row)
        pane_id = session["pane_id"]
        if pane_id:
            sessions_by_pane.setdefault(pane_id, []).append(session)

    return sessions_by_pane


__all__ = ["fetch_all_sessions_by_pane", "fetch_sessions_for_pane"]
