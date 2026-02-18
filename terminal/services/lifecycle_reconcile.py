"""Terminal session startup reconciliation.

Handles reconciliation of database state with tmux session state:
- Sync DB ↔ tmux state on startup
- Mark sessions as alive/dead based on tmux presence
- Purge old abandoned sessions
- Kill orphan tmux sessions (no DB record)
"""

from __future__ import annotations

from typing import Any

from ..logging_config import get_logger
from ..storage import terminal as terminal_store
from ..utils.tmux import get_tmux_session_name, list_tmux_sessions, run_tmux_command

logger = get_logger(__name__)


def _kill_orphan_tmux_sessions(db_session_ids: set[str]) -> int:
    """Kill tmux sessions that have no matching DB record.

    These are true orphans - tmux sessions that were created but their
    DB records were deleted (e.g., purged after 7 days of inactivity).
    Safe to kill because there's no way to reconnect without a DB record.

    Args:
        db_session_ids: Set of all session IDs that exist in the database

    Returns:
        Number of orphan tmux sessions killed
    """
    tmux_sessions = list_tmux_sessions()
    orphans = tmux_sessions - db_session_ids
    killed = 0

    for session_id in orphans:
        session_name = get_tmux_session_name(session_id)
        success, error = run_tmux_command(["kill-session", "-t", session_name])
        if success:
            killed += 1
            logger.info("orphan_tmux_killed", session_id=session_id)
        else:
            logger.warning("orphan_tmux_kill_failed", session_id=session_id, error=error)

    return killed


def _sync_sessions(db_sessions: list[dict[str, Any]], tmux_sessions: set[str]) -> dict[str, int]:
    """Sync each DB session against the live tmux session set.

    Returns a dict with 'marked_alive' and 'marked_dead' counts.
    """
    counts = {"marked_alive": 0, "marked_dead": 0}

    for session in db_sessions:
        session_id = session["id"]
        if session_id in tmux_sessions:
            if not session["is_alive"]:
                terminal_store.update_session(session_id, is_alive=True)
                counts["marked_alive"] += 1
                logger.info("reconcile_marked_alive", session_id=session_id)
        else:
            if session["is_alive"]:
                terminal_store.mark_dead(session_id)
                counts["marked_dead"] += 1
                logger.info("reconcile_marked_dead", session_id=session_id)

    return counts


def _purge_dead_and_kill_orphans(purge_after_days: int) -> dict[str, int]:
    """Purge old dead sessions and kill orphan tmux sessions.

    Returns a dict with 'purged' and 'orphans_killed' counts.
    Must be called after the main sync loop so purged IDs are excluded
    from the orphan check.
    """
    purged = terminal_store.purge_dead_sessions(older_than_days=purge_after_days)
    if purged > 0:
        logger.info("reconcile_purged_dead_sessions", count=purged)

    # Fetch remaining DB IDs after purge for accurate orphan detection
    remaining_ids = {s["id"] for s in terminal_store.list_sessions(include_dead=True)}
    orphans_killed = _kill_orphan_tmux_sessions(remaining_ids)
    if orphans_killed > 0:
        logger.info("reconcile_orphans_killed", count=orphans_killed)

    return {"purged": purged, "orphans_killed": orphans_killed}


def reconcile_on_startup(purge_after_days: int = 7) -> dict[str, int]:
    """Reconcile DB with tmux state on server startup.

    Syncs the database with the actual tmux session state:
    - Sessions in DB but not tmux: mark as dead
    - Sessions in DB and tmux: mark as alive
    - Dead sessions older than purge_after_days: permanently deleted
    - Orphan tmux sessions (no DB record): killed

    Args:
        purge_after_days: Delete dead sessions not accessed in this many days

    Returns:
        Stats dict with counts of sessions processed
    """
    logger.info("reconciliation_starting")

    db_sessions = terminal_store.list_sessions(include_dead=True)
    tmux_sessions = list_tmux_sessions()

    stats: dict[str, int] = {
        "total_db_sessions": len(db_sessions),
        "total_tmux_sessions": len(tmux_sessions),
    }

    stats.update(_sync_sessions(db_sessions, tmux_sessions))
    stats.update(_purge_dead_and_kill_orphans(purge_after_days))

    logger.info("reconciliation_complete", **stats)
    return stats
