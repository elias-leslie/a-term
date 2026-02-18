"""Low-level lifecycle helpers for terminal session operations.

Contains tmux interaction primitives and resurrection logic used by
lifecycle_core.py.
"""

from __future__ import annotations

from ..logging_config import get_logger
from ..storage import terminal as terminal_store
from ..utils.tmux import (
    TmuxError,
    create_tmux_session,
    get_tmux_session_name,
    run_tmux_command,
)

logger = get_logger(__name__)


def kill_tmux_session(session_id: str, ignore_missing: bool = True) -> bool:
    """Kill a tmux session.

    Args:
        session_id: Session UUID
        ignore_missing: Don't raise error if session doesn't exist

    Returns:
        True if session was killed, False if it didn't exist

    Raises:
        TmuxError: If kill fails (and ignore_missing is False)
    """
    session_name = get_tmux_session_name(session_id)
    success, error = run_tmux_command(["kill-session", "-t", session_name])

    if not success:
        if ignore_missing and "session not found" in error.lower():
            logger.info("tmux_session_not_found", session=session_name)
            return False
        if not ignore_missing:
            raise TmuxError(f"Failed to kill tmux session: {error}")
        return False

    logger.info("tmux_session_killed", session=session_name)
    return True


def resurrect_session_record(
    session_id: str,
    project_id: str | None,
    name: str,
    working_dir: str | None,
    mode: str,
) -> None:
    """Update DB record and create tmux session for resurrection.

    Rollback strategy: On tmux creation failure, marks session as dead
    (mark_dead) rather than deleting, since DB record already existed.

    Raises:
        TmuxError: If tmux creation fails (session marked dead again)
    """
    logger.info(
        "resurrecting_dead_session",
        session_id=session_id,
        project_id=project_id,
        mode=mode,
    )
    terminal_store.update_session(session_id, name=name, working_dir=working_dir, is_alive=True)
    try:
        create_tmux_session(session_id, working_dir)
    except TmuxError as e:
        logger.error(
            "tmux_create_failed_rolling_back_resurrection",
            session_id=session_id,
            error=str(e),
        )
        terminal_store.mark_dead(session_id)
        raise
    logger.info("session_resurrected", session_id=session_id, name=name, project_id=project_id, mode=mode)


def claim_and_resurrect(
    project_id: str,
    mode: str,
    name: str,
    working_dir: str | None,
) -> str | None:
    """Atomically claim a dead session and resurrect it.

    Returns:
        Session ID if a dead session was claimed and resurrected, else None.
    """
    claimed = terminal_store.claim_dead_session_by_project(project_id, mode)
    if not claimed:
        return None

    session_id: str = claimed["id"]
    resurrect_session_record(
        session_id=session_id,
        project_id=project_id,
        name=name,
        working_dir=working_dir,
        mode=mode,
    )
    return session_id


def try_resurrect_tmux(session_id: str, working_dir: str | None) -> bool:
    """Attempt to recreate a dead tmux session for an existing DB record.

    Returns:
        True on success, False on failure (marks session dead on failure).
    """
    logger.info("session_resurrection_attempt", session_id=session_id)
    try:
        create_tmux_session(session_id, working_dir)
        terminal_store.update_session(session_id, is_alive=True)
        logger.info("session_resurrected", session_id=session_id)
        return True
    except TmuxError as e:
        logger.error(
            "tmux_create_failed_rolling_back_ensure_alive",
            session_id=session_id,
            error=str(e),
        )
        terminal_store.mark_dead(session_id)
        return False
