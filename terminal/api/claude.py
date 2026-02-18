"""Claude Code integration API.

This module provides:
- Get Claude state for a terminal session (state machine based)
- Start Claude Code in a terminal session with state machine
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from ..logging_config import get_logger
from ..services.claude_service import (
    atomically_set_starting,
    background_verify_claude_start,
    is_claude_running,
    send_claude_command,
)
from ..storage import terminal as terminal_store
from ..utils.tmux import get_tmux_session_name, tmux_session_exists_by_name

router = APIRouter(tags=["Claude Integration"])
logger = get_logger(__name__)

# Type alias for Claude state
ClaudeState = Literal["not_started", "starting", "running", "stopped", "error"]


# ============================================================================
# Request/Response Models
# ============================================================================


class ClaudeStateResponse(BaseModel):
    """Claude Code state for a terminal session (state machine based)."""

    session_id: str
    claude_state: ClaudeState


class StartClaudeResponse(BaseModel):
    """Response after starting Claude Code."""

    session_id: str
    started: bool
    message: str
    claude_state: ClaudeState


# ============================================================================
# Endpoints
# ============================================================================


@router.get(
    "/api/terminal/sessions/{session_id}/claude-state",
    response_model=ClaudeStateResponse,
)
async def get_claude_state_endpoint(session_id: str) -> ClaudeStateResponse:
    """Get Claude Code state for a terminal session.

    State machine states:
    - not_started: Claude has never been started
    - starting: Claude is in the process of starting
    - running: Claude is running and ready
    - stopped: Claude was running but exited
    - error: Claude failed to start
    """
    session = terminal_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    claude_state: ClaudeState = session.get("claude_state", "not_started")
    return ClaudeStateResponse(session_id=session_id, claude_state=claude_state)


def _early_return(session_id: str, state: ClaudeState, msg: str) -> StartClaudeResponse:
    return StartClaudeResponse(session_id=session_id, started=False, message=msg, claude_state=state)


@router.post(
    "/api/terminal/sessions/{session_id}/start-claude",
    response_model=StartClaudeResponse,
)
async def start_claude(session_id: str, background_tasks: BackgroundTasks) -> StartClaudeResponse:
    """Start Claude Code in a terminal session using state-machine guards."""
    session = terminal_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    current_state: ClaudeState = session.get("claude_state", "not_started")

    if current_state == "starting":
        return _early_return(session_id, "starting", "Claude is already starting")
    if current_state == "running":
        return _early_return(session_id, "running", "Claude is already running")

    tmux_session = get_tmux_session_name(session_id)
    if not tmux_session_exists_by_name(tmux_session):
        raise HTTPException(status_code=400, detail=f"tmux session {tmux_session} does not exist")

    # Sync state if Claude is already running but DB is stale
    if await is_claude_running(tmux_session):
        terminal_store.update_claude_state(session_id, "running", expected_state=current_state)
        return _early_return(session_id, "running", "Claude is already running in this session")

    # Atomically claim 'starting' (handles concurrent requests)
    conflicting_state = atomically_set_starting(session_id, current_state)
    if conflicting_state is not None:
        return _early_return(session_id, conflicting_state, f"Claude state changed to {conflicting_state}")

    send_error = await send_claude_command(session_id, tmux_session)
    if send_error:
        return _early_return(session_id, "error", f"Failed to send command: {send_error}")

    background_tasks.add_task(background_verify_claude_start, session_id, tmux_session)
    logger.info("claude_start_initiated", session_id=session_id, tmux_session=tmux_session)
    return StartClaudeResponse(
        session_id=session_id, started=True,
        message="Claude command sent, verifying startup...", claude_state="starting",
    )
