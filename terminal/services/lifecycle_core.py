"""Core terminal session lifecycle operations.

Handles single-session atomic operations:
- Atomic create (DB + tmux, rollback on failure)
- Atomic delete (tmux kill + DB delete)
- Session resurrection (recreate tmux if DB record exists)
- Ensure session alive (resurrection on connect)

The database is the source of truth; tmux is the implementation detail.
"""

from __future__ import annotations

from ..logging_config import get_logger
from ..storage import terminal as terminal_store
from ..utils.tmux import TmuxError, create_tmux_session, tmux_session_exists
from .lifecycle_helpers import (
    claim_and_resurrect,
    kill_tmux_session,
    try_resurrect_tmux,
)

# Re-export for callers that import _kill_tmux_session directly (api/panes.py)
_kill_tmux_session = kill_tmux_session

logger = get_logger(__name__)


def create_session(
    name: str,
    project_id: str | None = None,
    working_dir: str | None = None,
    user_id: str | None = None,
    mode: str = "shell",
    pane_id: str | None = None,
) -> str:
    """Create a new terminal session atomically.

    If a dead session exists for the same project_id+mode, resurrects it
    instead of creating a new one (to avoid unique constraint violations).

    Returns:
        Server-generated session UUID

    Raises:
        TmuxError: If tmux session creation fails (after rollback)
    """
    # Step 0: Atomically claim a dead session to resurrect (prevents TOCTOU races)
    if project_id:
        resurrected = claim_and_resurrect(project_id, mode, name, working_dir)
        if resurrected:
            return resurrected

    # Step 1: Create DB record
    session_id = terminal_store.create_session(
        name=name,
        project_id=project_id,
        working_dir=working_dir,
        user_id=user_id,
        mode=mode,
        pane_id=pane_id,
    )

    # Step 2: Create tmux session (rollback DB on failure)
    try:
        create_tmux_session(session_id, working_dir)
    except TmuxError as e:
        logger.error("tmux_create_failed_rolling_back_new_session", session_id=session_id, error=str(e))
        terminal_store.delete_session(session_id)
        raise

    logger.info("session_created", session_id=session_id, name=name, project_id=project_id, mode=mode)
    return session_id


def delete_session(session_id: str) -> bool:
    """Delete a terminal session atomically.

    Kills tmux session first, then deletes DB record.
    Idempotent - returns True even if session didn't exist.

    Returns:
        True (always succeeds, idempotent)
    """
    kill_tmux_session(session_id, ignore_missing=True)
    deleted = terminal_store.delete_session(session_id)
    if deleted:
        logger.info("session_deleted", session_id=session_id)
    else:
        logger.info("session_not_found_for_delete", session_id=session_id)
    return True


def ensure_session_alive(session_id: str) -> bool:
    """Ensure a session is alive, recreating tmux if necessary.

    Called on WebSocket connect. If tmux session died but DB record
    exists, attempts to recreate the tmux session.

    Returns:
        True if session is alive (or was successfully resurrected)
        False if session doesn't exist in DB or resurrection failed
    """
    session = terminal_store.get_session(session_id)
    if not session:
        logger.warning("ensure_alive_no_db_record", session_id=session_id)
        return False

    if tmux_session_exists(session_id):
        if not session["is_alive"]:
            terminal_store.update_session(session_id, is_alive=True)
            logger.info("session_marked_alive", session_id=session_id)
        return True

    return try_resurrect_tmux(session_id, session.get("working_dir"))
