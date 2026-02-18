"""Terminal session query helpers: field list, row converter, and query executor."""

from __future__ import annotations

from typing import Any, Literal, LiteralString, cast, overload

from ...logging_config import get_logger
from ..connection import get_connection

logger = get_logger(__name__)

# Standard SELECT field list for terminal_sessions queries
# Keep in sync with _row_to_dict() field order
TERMINAL_SESSION_FIELDS = """id, name, user_id, project_id, working_dir, display_order,
               mode, session_number, is_alive, created_at, last_accessed_at,
               last_claude_session, claude_state, pane_id"""


def _row_to_dict(row: tuple[Any, ...]) -> dict[str, Any]:
    """Convert a database row to a session dict.

    This is the canonical session row converter. All session queries should
    SELECT TERMINAL_SESSION_FIELDS and use this function.
    """
    created_at = row[9] if len(row) > 9 else None
    last_accessed_at = row[10] if len(row) > 10 else None
    return {
        "id": str(row[0]),
        "name": row[1],
        "user_id": row[2],
        "project_id": row[3],
        "working_dir": row[4],
        "display_order": row[5],
        "mode": row[6],
        "session_number": row[7],
        "is_alive": row[8],
        "created_at": created_at.isoformat() if created_at else None,
        "last_accessed_at": last_accessed_at.isoformat() if last_accessed_at else None,
        "last_claude_session": row[11] if len(row) > 11 else None,
        "claude_state": row[12] if len(row) > 12 else "not_started",
        "pane_id": str(row[13]) if len(row) > 13 and row[13] else None,
    }


@overload
def _execute_session_query(
    query: str, params: tuple[Any, ...], *, fetch_mode: Literal["one"] = "one"
) -> dict[str, Any] | None: ...


@overload
def _execute_session_query(
    query: str, params: tuple[Any, ...], *, fetch_mode: Literal["all"]
) -> list[dict[str, Any]]: ...


def _execute_session_query(
    query: str, params: tuple[Any, ...], *, fetch_mode: Literal["one", "all"] = "one"
) -> dict[str, Any] | list[dict[str, Any]] | None:
    """Execute a session query and return converted result(s).

    Centralizes the query -> fetch -> _row_to_dict pattern.

    Args:
        query: SQL query string (should SELECT TERMINAL_SESSION_FIELDS)
        params: Query parameters
        fetch_mode: 'one' returns single dict/None, 'all' returns list

    Returns:
        Single session dict, list of dicts, or None
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(cast(LiteralString, query), params)
        if fetch_mode == "one":
            row = cur.fetchone()
            return _row_to_dict(row) if row else None
        else:
            rows = cur.fetchall()
            return [_row_to_dict(row) for row in rows]
