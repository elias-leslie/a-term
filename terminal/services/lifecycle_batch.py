"""Batch terminal session lifecycle operations.

Handles multi-session operations: reset single/project/all sessions,
and disable project terminal (delete sessions + update settings).
"""

from __future__ import annotations

from typing import Any

from ..constants import SHELL_MODE
from ..logging_config import get_logger
from ..storage import agent_tools as agent_tools_store
from ..storage import project_settings as settings_store
from ..storage import terminal as terminal_store
from .lifecycle_core import create_session, delete_session

logger = get_logger(__name__)


def reset_session(session_id: str) -> str | None:
    """Delete and recreate a session with the same parameters. Returns new ID or None."""
    session = terminal_store.get_session(session_id)
    if not session:
        logger.warning("reset_session_not_found", session_id=session_id)
        return None

    delete_session(session_id)
    new_session_id = create_session(
        name=session["name"],
        project_id=session.get("project_id"),
        working_dir=session.get("working_dir"),
        user_id=session.get("user_id"),
        mode=session.get("mode", "shell"),
        pane_id=session.get("pane_id"),
    )
    logger.info(
        "session_reset",
        old_session_id=session_id,
        new_session_id=new_session_id,
        project_id=session.get("project_id"),
        mode=session.get("mode", "shell"),
        pane_id=session.get("pane_id"),
    )
    return new_session_id


def _collect_session_info(sessions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Extract per-mode metadata from existing sessions for recreation."""
    info: dict[str, dict[str, Any]] = {}
    for session in sessions:
        mode = session.get("mode", "shell")
        if mode not in info:
            info[mode] = {
                "working_dir": session.get("working_dir"),
                "name": session.get("name"),
                "user_id": session.get("user_id"),
            }
    return info


def _delete_project_sessions(sessions: list[dict[str, Any]], project_id: str) -> int:
    """Delete all sessions and warn if orphan count exceeds expected."""
    count = len(sessions)
    for session in sessions:
        delete_session(session["id"])
    if count > 2:
        logger.warning("excess_sessions_cleaned", project_id=project_id, deleted_count=count)
    return count


def _recreate_project_sessions(
    project_id: str,
    session_info: dict[str, dict[str, Any]],
    working_dir: str | None,
) -> dict[str, str | None]:
    """Create fresh sessions for each mode, returning a mode -> session_id map.

    Creates a shell session and an agent session using the default agent tool slug.
    """
    default_tool = agent_tools_store.get_default()
    if not default_tool:
        logger.warning("no_default_agent_tool", fallback="claude")
    agent_slug = default_tool["slug"] if default_tool else "claude"
    modes = [SHELL_MODE, agent_slug]

    result: dict[str, str | None] = {SHELL_MODE: None, agent_slug: None}
    for mode in modes:
        info = session_info.get(mode, {})
        new_id = create_session(
            name=info.get("name") or f"Project: {project_id} ({mode.title()})",
            project_id=project_id,
            working_dir=working_dir or info.get("working_dir"),
            user_id=info.get("user_id"),
            mode=mode,
        )
        logger.info("session_reset", new_session_id=new_id, project_id=project_id, mode=mode)
        result[mode] = new_id
    return result


def reset_project_sessions(
    project_id: str, working_dir: str | None = None
) -> dict[str, str | None]:
    """Reset all sessions for a project, deleting orphans and recreating fresh ones.

    Args:
        project_id: Project identifier
        working_dir: Optional new working directory for recreated sessions

    Returns:
        Dict mapping mode slugs to new session IDs (or None)
    """
    from ..storage.terminal_project import get_all_project_sessions

    all_sessions = get_all_project_sessions(project_id)
    session_info = _collect_session_info(all_sessions)
    deleted_count = _delete_project_sessions(all_sessions, project_id)
    result = _recreate_project_sessions(project_id, session_info, working_dir)

    # Find the agent session ID (non-shell key)
    agent_session = next((v for k, v in result.items() if k != SHELL_MODE), None)
    logger.info(
        "project_sessions_reset",
        project_id=project_id,
        shell_session=result.get(SHELL_MODE),
        agent_session=agent_session,
        cleaned_orphans=max(0, deleted_count - 2),
    )
    return result


def reset_all_sessions() -> int:
    """Reset all terminal sessions globally. Returns count of sessions reset."""
    sessions = terminal_store.list_sessions()
    count = sum(1 for session in sessions if reset_session(session["id"]))
    logger.info("all_sessions_reset", count=count)
    return count


def disable_project_terminal(project_id: str) -> bool:
    """Delete all project sessions and mark the project terminal as disabled."""
    from ..storage.terminal_project import get_all_project_sessions

    all_sessions = get_all_project_sessions(project_id)
    for session in all_sessions:
        delete_session(session["id"])

    settings_store.upsert_settings(project_id, enabled=False)
    logger.info(
        "project_terminal_disabled",
        project_id=project_id,
        deleted_sessions=len(all_sessions),
    )
    return True
