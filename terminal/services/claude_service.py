"""Claude Code service layer: state management and process verification."""

from __future__ import annotations

import asyncio
import contextlib
import subprocess
from typing import Literal, cast

from ..constants import CLAUDE_COMMAND
from ..logging_config import get_logger
from ..storage import terminal as terminal_store

logger = get_logger(__name__)

# Type alias for Claude state
ClaudeState = Literal["not_started", "starting", "running", "stopped", "error"]

# Delay before verifying Claude started (Claude needs time to initialize)
CLAUDE_STARTUP_VERIFY_DELAY_SECONDS = 3


def _is_claude_running_in_session_sync(tmux_session: str) -> bool:
    """Check if Claude Code is running in a tmux session (sync).

    Uses tmux's pane_current_command to check if 'claude' is the foreground process.
    """
    result = subprocess.run(
        ["tmux", "list-panes", "-t", tmux_session, "-F", "#{pane_current_command}"],
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

    return result.stdout.strip() == "claude"


async def is_claude_running(tmux_session: str) -> bool:
    """Check if Claude Code is running in a tmux session (async)."""
    return await asyncio.to_thread(_is_claude_running_in_session_sync, tmux_session)


async def background_verify_claude_start(session_id: str, tmux_session: str) -> None:
    """Background task: verify Claude started, then update DB state accordingly."""
    try:
        await asyncio.sleep(CLAUDE_STARTUP_VERIFY_DELAY_SECONDS)

        if await is_claude_running(tmux_session):
            updated = terminal_store.update_claude_state(
                session_id, "running", expected_state="starting"
            )
            if updated:
                logger.info("claude_verified_running", session_id=session_id, tmux_session=tmux_session)
            else:
                logger.info("claude_state_already_changed", session_id=session_id, tmux_session=tmux_session)
        else:
            updated = terminal_store.update_claude_state(session_id, "error", expected_state="starting")
            if updated:
                logger.warning("claude_start_failed", session_id=session_id, tmux_session=tmux_session)
    except Exception as e:
        logger.error(
            "background_verify_failed",
            session_id=session_id,
            tmux_session=tmux_session,
            error=str(e),
        )
        with contextlib.suppress(Exception):
            terminal_store.update_claude_state(session_id, "error", expected_state="starting")


async def send_claude_command(session_id: str, tmux_session: str) -> str | None:
    """Send the Claude start command via tmux send-keys.

    Returns an error message string on failure, or None on success.
    """
    result = await asyncio.to_thread(
        subprocess.run,
        ["tmux", "send-keys", "-t", tmux_session, CLAUDE_COMMAND, "Enter"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        terminal_store.update_claude_state(session_id, "error", expected_state="starting")
        stderr = cast(str, result.stderr)
        logger.error("claude_send_keys_failed", session_id=session_id, error=stderr)
        return stderr

    return None


def atomically_set_starting(session_id: str, current_state: ClaudeState) -> ClaudeState | None:
    """Atomically transition session to 'starting' state.

    Returns the new conflicting state if the CAS failed, else None (success).
    """
    updated = terminal_store.update_claude_state(
        session_id, "starting", expected_state=current_state
    )
    if not updated:
        return cast(ClaudeState, terminal_store.get_claude_state(session_id) or "not_started")
    return None
