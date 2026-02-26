"""Agent service layer: state management and process verification.

Generalized from claude_service.py to support any CLI agent tool.
Uses parameterized command and process_name instead of hardcoded constants.
"""

from __future__ import annotations

import asyncio
import contextlib
import subprocess
from typing import Literal, cast

from ..logging_config import get_logger
from ..storage import terminal as terminal_store

logger = get_logger(__name__)

AgentState = Literal["not_started", "starting", "running", "stopped", "error"]

# Delay before verifying agent started (agents need time to initialize)
AGENT_STARTUP_VERIFY_DELAY_SECONDS = 3


def _is_agent_running_in_session_sync(tmux_session: str, process_name: str) -> bool:
    """Check if an agent is running in a tmux session (sync).

    Checks both pane_current_command and pane_start_command to handle
    Node.js-based tools where pane_current_command reports 'node'.
    """
    result = subprocess.run(
        ["tmux", "list-panes", "-t", tmux_session, "-F", "#{pane_current_command} #{pane_start_command}"],
        capture_output=True,
        text=True,
        timeout=10,
    )

    if result.returncode != 0:
        logger.warning(
            "tmux_list_panes_failed",
            tmux_session=tmux_session,
            stderr=result.stderr,
            returncode=result.returncode,
        )
        return False

    return process_name in result.stdout.strip().lower()


async def is_agent_running(tmux_session: str, process_name: str) -> bool:
    """Check if an agent is running in a tmux session (async)."""
    return await asyncio.to_thread(_is_agent_running_in_session_sync, tmux_session, process_name)


async def background_verify_agent_start(
    session_id: str, tmux_session: str, process_name: str
) -> None:
    """Background task: verify agent started, then update DB state accordingly."""
    try:
        await asyncio.sleep(AGENT_STARTUP_VERIFY_DELAY_SECONDS)

        if await is_agent_running(tmux_session, process_name):
            updated = terminal_store.update_claude_state(
                session_id, "running", expected_state="starting"
            )
            if updated:
                logger.info("agent_verified_running", session_id=session_id, tmux_session=tmux_session)
            else:
                logger.info("agent_state_already_changed", session_id=session_id, tmux_session=tmux_session)
        else:
            updated = terminal_store.update_claude_state(session_id, "error", expected_state="starting")
            if updated:
                logger.warning("agent_start_failed", session_id=session_id, tmux_session=tmux_session)
    except Exception as e:
        logger.error(
            "background_verify_failed",
            session_id=session_id,
            tmux_session=tmux_session,
            error=str(e),
        )
        with contextlib.suppress(Exception):
            terminal_store.update_claude_state(session_id, "error", expected_state="starting")


async def send_agent_command(session_id: str, tmux_session: str, command: str) -> str | None:
    """Send an agent start command via tmux send-keys.

    Returns an error message string on failure, or None on success.
    """
    result = await asyncio.to_thread(
        subprocess.run,
        ["tmux", "send-keys", "-t", tmux_session, command, "Enter"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        terminal_store.update_claude_state(session_id, "error", expected_state="starting")
        stderr = cast(str, result.stderr)
        logger.error("agent_send_keys_failed", session_id=session_id, error=stderr)
        return stderr

    return None


def atomically_set_starting(session_id: str, current_state: AgentState) -> AgentState | None:
    """Atomically transition session to 'starting' state.

    Returns the new conflicting state if the CAS failed, else None (success).
    """
    updated = terminal_store.update_claude_state(
        session_id, "starting", expected_state=current_state
    )
    if not updated:
        return cast(AgentState, terminal_store.get_claude_state(session_id) or "not_started")
    return None
