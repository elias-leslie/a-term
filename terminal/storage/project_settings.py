"""Terminal project settings storage layer.

This module provides data access for per-project terminal settings.
Each project can be enabled/disabled for terminal access and tracks
the active mode (shell or claude) which syncs across devices.
"""

from __future__ import annotations

from typing import Any

import psycopg.sql

from .connection import get_connection


def get_all_settings() -> dict[str, dict[str, Any]]:
    """Get all project settings, keyed by project_id."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT project_id, enabled, active_mode, display_order,
                   created_at, updated_at
            FROM terminal_project_settings
            ORDER BY display_order, project_id
            """
        )
        rows = cur.fetchall()

    return {row[0]: _row_to_dict(row) for row in rows}


def _build_upsert_query(
    enabled: bool | None,
    active_mode: str | None,
    display_order: int | None,
) -> psycopg.sql.Composed:
    """Build the upsert query with dynamic SET clause."""
    update_parts = [psycopg.sql.SQL("updated_at = NOW()")]
    if enabled is not None:
        update_parts.append(psycopg.sql.SQL("enabled = EXCLUDED.enabled"))
    if active_mode is not None:
        update_parts.append(psycopg.sql.SQL("active_mode = EXCLUDED.active_mode"))
    if display_order is not None:
        update_parts.append(psycopg.sql.SQL("display_order = EXCLUDED.display_order"))

    return psycopg.sql.SQL("""
        INSERT INTO terminal_project_settings
            (project_id, enabled, active_mode, display_order)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (project_id) DO UPDATE SET
            {}
        RETURNING project_id, enabled, active_mode, display_order,
                  created_at, updated_at
    """).format(psycopg.sql.SQL(", ").join(update_parts))


def upsert_settings(
    project_id: str,
    enabled: bool | None = None,
    active_mode: str | None = None,
    display_order: int | None = None,
) -> dict[str, Any]:
    """Create or update project settings (INSERT ... ON CONFLICT)."""
    query = _build_upsert_query(enabled, active_mode, display_order)
    insert_enabled = enabled if enabled is not None else False
    insert_mode = active_mode if active_mode is not None else "shell"
    insert_order = display_order if display_order is not None else 0

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (project_id, insert_enabled, insert_mode, insert_order))
        row = cur.fetchone()
        conn.commit()

    if not row:
        raise ValueError(f"Failed to upsert settings for {project_id}")
    return _row_to_dict(row)


def bulk_update_order(project_ids: list[str]) -> None:
    """Update display_order for projects; index in list becomes display_order."""
    if not project_ids:
        return

    with get_connection() as conn, conn.cursor() as cur:
        case_parts = [
            psycopg.sql.SQL("WHEN project_id = %s THEN {}").format(psycopg.sql.Literal(i))
            for i in range(len(project_ids))
        ]
        placeholders = psycopg.sql.SQL(", ").join([psycopg.sql.SQL("%s")] * len(project_ids))
        query = psycopg.sql.SQL("""
            UPDATE terminal_project_settings
            SET display_order = CASE {} END,
                updated_at = NOW()
            WHERE project_id IN ({})
        """).format(psycopg.sql.SQL(" ").join(case_parts), placeholders)

        cur.execute(query, (*project_ids, *project_ids))
        conn.commit()


def set_active_mode(project_id: str, mode: str) -> dict[str, Any] | None:
    """Set the active mode for a project; returns None if not found."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE terminal_project_settings
            SET active_mode = %s, updated_at = NOW()
            WHERE project_id = %s
            RETURNING project_id, enabled, active_mode, display_order,
                      created_at, updated_at
            """,
            (mode, project_id),
        )
        row = cur.fetchone()
        conn.commit()

    if not row:
        return None
    return _row_to_dict(row)


def _row_to_dict(row: tuple[Any, ...]) -> dict[str, Any]:
    """Convert a database row to a settings dict."""
    return {
        "project_id": row[0],
        "enabled": row[1],
        "active_mode": row[2],
        "display_order": row[3],
        "created_at": row[4],
        "updated_at": row[5],
    }
