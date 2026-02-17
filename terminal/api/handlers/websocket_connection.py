"""WebSocket connection lifecycle management."""

from __future__ import annotations

import asyncio
import contextlib
import os

from fastapi import WebSocket, WebSocketDisconnect

from ...constants import CLAUDE_COMMAND
from ...logging_config import get_logger
from ...services.pty_manager import read_pty_output, spawn_pty_for_tmux
from ...utils.tmux import get_scrollback, is_claude_running_in_session
from .session_validation import validate_and_prepare_session
from .websocket_cleanup import cleanup_pty_process, cleanup_tasks
from .websocket_heartbeat import heartbeat_loop
from .websocket_messages import handle_websocket_message
from .websocket_resize import wait_for_initial_resize

logger = get_logger(__name__)


async def handle_terminal_connection(
    websocket: WebSocket,
    session_id: str,
    working_dir: str | None = None,
) -> None:
    """Handle a terminal WebSocket connection.

    Protocol:
    - Text messages: Input to terminal
    - Binary messages starting with 'r': Resize event (JSON: {cols, rows})
    - Server sends output as text messages

    Args:
        websocket: WebSocket connection
        session_id: Terminal session identifier
        working_dir: Optional working directory for new sessions
    """
    await websocket.accept()
    logger.info("terminal_connected", session_id=session_id, working_dir=working_dir)

    master_fd: int | None = None
    pid: int | None = None

    try:
        # Validate session and prepare tmux (run in thread to avoid blocking event loop)
        try:
            session, tmux_session_name = await asyncio.to_thread(
                validate_and_prepare_session, session_id
            )
        except ValueError as e:
            await websocket.close(
                code=4000,
                reason=f'{{"error": "session_dead", "message": "{e!s}"}}',
            )
            return

        # Spawn PTY for tmux (pass stored target session for auto-reconnect)
        stored_target_session = session.get("last_claude_session")
        master_fd, pid = spawn_pty_for_tmux(tmux_session_name, stored_target_session)

        # Wait for initial resize to sync dimensions
        await wait_for_initial_resize(
            websocket, master_fd, session_id, tmux_session_name
        )

        # Send scrollback history after resize
        scrollback = get_scrollback(tmux_session_name)
        if scrollback:
            # tmux capture-pane -p outputs bare \n between lines.
            # xterm.js treats \n as LF-only (cursor down, same column) without \r,
            # causing diagonal/staircase text. Convert to \r\n so each line starts
            # at column 0. Normalize first to avoid \r\r\n from existing \r\n pairs.
            scrollback = scrollback.replace("\r\n", "\n").replace("\n", "\r\n")
            await websocket.send_text(scrollback)
            logger.info("scrollback_sent", session_id=session_id, bytes=len(scrollback))

        # Start background tasks
        output_task = asyncio.create_task(read_pty_output(websocket, master_fd))
        heartbeat_task = asyncio.create_task(heartbeat_loop(websocket))

        # Auto-start Claude for claude-mode sessions
        if session.get("mode") == "claude" and not is_claude_running_in_session(tmux_session_name):
            await asyncio.sleep(0.3)  # Wait for shell prompt
            os.write(master_fd, f"{CLAUDE_COMMAND}\n".encode())
            logger.info("auto_started_claude", session_id=session_id)

        # Track last resize dimensions to skip duplicate resize events
        last_resize = [0, 0]

        # Process incoming WebSocket messages
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                await handle_websocket_message(
                    message, master_fd, session_id, tmux_session_name, last_resize
                )
        except WebSocketDisconnect:
            logger.info("terminal_disconnected", session_id=session_id)
        finally:
            await cleanup_tasks(heartbeat_task, output_task)

    except Exception as e:
        logger.error("terminal_error", session_id=session_id, error=str(e))
        with contextlib.suppress(Exception):
            await websocket.close(code=1011, reason=str(e))

    finally:
        # Clean up PTY child process and fd, but keep tmux session
        if pid is not None and master_fd is not None:
            await cleanup_pty_process(pid, master_fd)

        logger.info("terminal_cleanup_complete", session_id=session_id)
