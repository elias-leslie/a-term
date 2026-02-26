"""Private helper functions for pane CRUD operations.

Contains ordering, counting, layout, and session-insert helpers
extracted from pane_crud.py to keep that module focused on core CRUD.
"""

from __future__ import annotations

from typing import Any

from .connection import get_connection
from .pane_db_helpers import PANE_FIELDS, PaneId, normalize_pane_id, row_to_pane_dict


def _get_next_pane_order(cur: Any) -> int:
    """Get the next available pane order."""
    cur.execute("SELECT COALESCE(MAX(pane_order), -1) + 1 FROM terminal_panes")
    row = cur.fetchone()
    return row[0] if row else 0


def _compute_session_number(cur: Any, project_id: str | None) -> int:
    """Compute the next session number for a project."""
    if not project_id:
        return 1
    cur.execute(
        "SELECT COALESCE(MAX(session_number), 0) + 1 FROM terminal_sessions WHERE project_id = %s AND is_alive = true",
        (project_id,),
    )
    row = cur.fetchone()
    return row[0] if row else 1


def _insert_session(
    cur: Any,
    name: str,
    project_id: str | None,
    working_dir: str | None,
    mode: str,
    session_number: int,
    pane_id: str,
) -> dict[str, Any]:
    """Insert a session and return its dict."""
    cur.execute(
        "INSERT INTO terminal_sessions (name, project_id, working_dir, mode, session_number, pane_id) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, name, mode, session_number, is_alive, working_dir",
        (name, project_id, working_dir, mode, session_number, pane_id),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Failed to create {mode} session")
    return {
        "id": str(row[0]),
        "name": row[1],
        "mode": row[2],
        "session_number": row[3],
        "is_alive": row[4],
        "working_dir": row[5],
    }


def update_pane_order(pane_orders: list[tuple[str, int]]) -> None:
    """Batch update pane ordering."""
    if not pane_orders:
        return
    with get_connection() as conn, conn.cursor() as cur:
        for pane_id, order in pane_orders:
            cur.execute("UPDATE terminal_panes SET pane_order = %s WHERE id = %s", (order, pane_id))
        conn.commit()


def swap_pane_positions(pane_id_a: PaneId, pane_id_b: PaneId) -> bool:
    """Swap positions of two panes."""
    if str(normalize_pane_id(pane_id_a)) == str(normalize_pane_id(pane_id_b)):
        return True  # no-op: same pane
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, pane_order FROM terminal_panes WHERE id IN (%s, %s)",
            (normalize_pane_id(pane_id_a), normalize_pane_id(pane_id_b)),
        )
        rows = cur.fetchall()
        if len(rows) != 2:
            return False
        orders = {str(row[0]): row[1] for row in rows}
        id_a, id_b = normalize_pane_id(pane_id_a), normalize_pane_id(pane_id_b)
        cur.execute("UPDATE terminal_panes SET pane_order = %s WHERE id = %s", (orders[id_b], id_a))
        cur.execute("UPDATE terminal_panes SET pane_order = %s WHERE id = %s", (orders[id_a], id_b))
        conn.commit()
    return True


def count_panes() -> int:
    """Count total number of panes."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM terminal_panes")
        row = cur.fetchone()
    return row[0] if row else 0


def get_next_pane_number(project_id: str | None) -> int:
    """Get the next pane number for naming (e.g., 'Project [2]')."""
    with get_connection() as conn, conn.cursor() as cur:
        if project_id:
            cur.execute(
                "SELECT COUNT(*) + 1 FROM terminal_panes WHERE project_id = %s", (project_id,)
            )
        else:
            cur.execute("SELECT COUNT(*) + 1 FROM terminal_panes WHERE pane_type = 'adhoc'")
        row = cur.fetchone()
    return row[0] if row else 1


def update_pane_layouts(layouts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Batch update pane layout positions and sizes."""
    if not layouts:
        return []
    updated_panes = []
    with get_connection() as conn, conn.cursor() as cur:
        for layout in layouts:
            pane_id = layout.get("pane_id")
            if not pane_id:
                continue
            cur.execute(
                f"UPDATE terminal_panes SET width_percent = COALESCE(%s, width_percent), height_percent = COALESCE(%s, height_percent), grid_row = COALESCE(%s, grid_row), grid_col = COALESCE(%s, grid_col) WHERE id = %s RETURNING {PANE_FIELDS}",
                (
                    layout.get("width_percent"),
                    layout.get("height_percent"),
                    layout.get("grid_row"),
                    layout.get("grid_col"),
                    normalize_pane_id(pane_id),
                ),
            )
            row = cur.fetchone()
            if row:
                updated_panes.append(row_to_pane_dict(row))
        conn.commit()
    return updated_panes


__all__ = [
    "_compute_session_number",
    "_get_next_pane_order",
    "_insert_session",
    "count_panes",
    "get_next_pane_number",
    "swap_pane_positions",
    "update_pane_layouts",
    "update_pane_order",
]
