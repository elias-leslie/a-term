"""Terminal WebSocket API for PTY sessions.

Provides WebSocket endpoints for terminal access:
- /ws/terminal/{session_id} - Connect to a terminal session

Uses tmux for session persistence so terminals survive disconnects.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request, WebSocket

from .handlers.session_switch import handle_session_switch
from .handlers.websocket_connection import handle_terminal_connection

router = APIRouter()


@router.get("/api/internal/session-switch")
async def session_switch_hook(
    request: Request,
    from_session: str = Query(..., alias="from"),
    to_session: str = Query(..., alias="to"),
    token: str = Query(""),
) -> dict[str, Any]:
    """Handle tmux session switch notifications.

    Called by tmux hook when a client switches sessions.
    Extracts terminal session ID from the base session name and stores the target.

    Security: Only accepts requests from localhost (tmux hooks).
    """
    return handle_session_switch(request, from_session, to_session, token)


@router.websocket("/ws/terminal/{session_id}")
async def terminal_websocket(
    websocket: WebSocket,
    session_id: str,
    working_dir: str | None = Query(None),
) -> None:
    """WebSocket endpoint for terminal sessions.

    Protocol:
    - Text messages: Input to terminal
    - Binary messages starting with 'r': Resize event (JSON: {cols, rows})
    - Server sends output as text messages

    Args:
        websocket: WebSocket connection
        session_id: Terminal session identifier
        working_dir: Optional working directory for new sessions
    """
    await handle_terminal_connection(websocket, session_id, working_dir)
