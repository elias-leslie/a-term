"""Terminal sessions storage - Project-specific queries.

This module handles project-scoped session queries, including
finding sessions by project and mode.
"""

from __future__ import annotations

from typing import Any

from .connection import get_connection
from .terminal_crud import TERMINAL_SESSION_FIELDS, _execute_session_query, _row_to_dict


def get_session_by_project(project_id: str, mode: str = "shell") -> dict[str, Any] | None:
    """Get the active session for a project and mode.

    Each project can have one session per mode (e.g. shell, claude, or any agent tool slug).

    Args:
        project_id: Project identifier
        mode: Session mode - 'shell' or agent tool slug (default: 'shell')

    Returns:
        Session dict or None if not found
    """
    query = f"""
        SELECT {TERMINAL_SESSION_FIELDS}
        FROM terminal_sessions
        WHERE project_id = %s AND mode = %s AND is_alive = true
        ORDER BY created_at DESC
        LIMIT 1
    """
    return _execute_session_query(query, (project_id, mode))



def get_all_project_sessions(project_id: str) -> list[dict[str, Any]]:
    """Get ALL sessions for a project (including duplicates).

    Used for cleanup - returns all sessions regardless of mode duplicates.

    Args:
        project_id: Project identifier

    Returns:
        List of all session dicts for the project
    """
    query = f"""
        SELECT {TERMINAL_SESSION_FIELDS}
        FROM terminal_sessions
        WHERE project_id = %s AND is_alive = true
        ORDER BY created_at
    """
    return _execute_session_query(query, (project_id,), fetch_mode="all")


def claim_dead_session_by_project(project_id: str, mode: str) -> dict[str, Any] | None:
    """Atomically claim a dead session for resurrection.

    Uses UPDATE...WHERE is_alive=false to prevent TOCTOU races.
    Only one concurrent caller can claim a given dead session.
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE terminal_sessions
            SET is_alive = true
            WHERE id = (
                SELECT id FROM terminal_sessions
                WHERE project_id = %s AND mode = %s AND is_alive = false
                ORDER BY last_accessed_at DESC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING {TERMINAL_SESSION_FIELDS}
            """,
            (project_id, mode),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        return None
    return _row_to_dict(row)


__all__ = [
    "claim_dead_session_by_project",
    "get_all_project_sessions",
    "get_session_by_project",
]
