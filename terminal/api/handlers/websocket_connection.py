"""WebSocket connection lifecycle management."""

from __future__ import annotations

import asyncio
import contextlib
import json

from fastapi import WebSocket, WebSocketDisconnect

from ...constants import SHELL_MODE
from ...logging_config import get_logger
from ...services.pty_manager import read_pty_output, spawn_pty_for_tmux
from ...services.scrollback_sync import (
    ScrollbackSyncOutputTracker,
    ScrollbackSyncScheduler,
    prepare_scrollback_for_transport,
)
from ...utils.tmux import get_scrollback
from .session_validation import validate_and_prepare_session
from .websocket_cleanup import cleanup_pty_process, cleanup_tasks
from .websocket_heartbeat import heartbeat_loop
from .websocket_messages import handle_websocket_message
from .websocket_resize import wait_for_initial_resize

logger = get_logger(__name__)
SCROLLBACK_SYNC_MIN_LINES = 40


async def _setup_connection(
    websocket: WebSocket,
    session_id: str,
) -> tuple[dict, str, int, int]:
    """Validate session, spawn PTY, sync dimensions and send scrollback.

    Returns:
        (session, tmux_session_name, master_fd, pid)

    Raises:
        ValueError: if the session is invalid/dead (caller closes websocket)
    """
    session, tmux_session_name = await asyncio.to_thread(
        validate_and_prepare_session, session_id
    )
    stored_target_session = session.get("last_claude_session")
    master_fd, pid = spawn_pty_for_tmux(tmux_session_name, stored_target_session)
    await wait_for_initial_resize(
        websocket,
        master_fd,
        session_id,
        tmux_session_name,
        resize_tmux=not bool(session.get("is_external")),
    )

    scrollback = get_scrollback(tmux_session_name)
    if scrollback:
        prepared_scrollback = prepare_scrollback_for_transport(scrollback)
        if prepared_scrollback:
            await websocket.send_text(prepared_scrollback)
            logger.info(
                "scrollback_sent",
                session_id=session_id,
                bytes=len(prepared_scrollback),
                original_bytes=len(scrollback),
            )

    return session, tmux_session_name, master_fd, pid


async def _run_message_loop(
    websocket: WebSocket,
    master_fd: int,
    session_id: str,
    tmux_session_name: str,
    resize_tmux: bool,
    output_task: asyncio.Task,
    heartbeat_task: asyncio.Task,
) -> None:
    """Process incoming WebSocket messages until disconnect."""
    last_resize = [0, 0]
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            await handle_websocket_message(
                message,
                master_fd,
                session_id,
                tmux_session_name,
                last_resize,
                resize_tmux=resize_tmux,
            )
    except WebSocketDisconnect:
        logger.info("terminal_disconnected", session_id=session_id)
    finally:
        await cleanup_tasks(heartbeat_task, output_task)


async def _run_session(
    websocket: WebSocket,
    session_id: str,
) -> tuple[int | None, int | None]:
    """Set up and run the full terminal session. Returns (pid, master_fd) for cleanup."""
    try:
        session, tmux_session_name, master_fd, pid = await _setup_connection(
            websocket, session_id
        )
    except ValueError as e:
        await websocket.close(
            code=4000,
            reason=json.dumps({"error": "session_dead", "message": str(e)}),
        )
        return None, None

    scrollback_sync: ScrollbackSyncScheduler | None = None
    scrollback_tracker: ScrollbackSyncOutputTracker | None = None
    if session.get("mode") == SHELL_MODE:
        scrollback_sync = ScrollbackSyncScheduler(websocket, tmux_session_name)
        scrollback_tracker = ScrollbackSyncOutputTracker(
            scrollback_sync,
            min_lines=SCROLLBACK_SYNC_MIN_LINES,
        )

    async def maybe_schedule_scrollback_sync(batch: str) -> None:
        if not scrollback_tracker:
            return
        scrollback_tracker.record_output(batch)

    output_task = asyncio.create_task(
        read_pty_output(
            websocket,
            master_fd,
            session_id=session_id,
            on_flush=maybe_schedule_scrollback_sync,
        )
    )
    heartbeat_task = asyncio.create_task(heartbeat_loop(websocket))
    try:
        await _run_message_loop(
            websocket,
            master_fd,
            session_id,
            tmux_session_name,
            not bool(session.get("is_external")),
            output_task, heartbeat_task,
        )
    finally:
        if scrollback_sync:
            await scrollback_sync.close()
    return pid, master_fd


async def handle_terminal_connection(
    websocket: WebSocket,
    session_id: str,
) -> None:
    """Handle a terminal WebSocket connection.

    Protocol: text input, binary resize (JSON {cols, rows}), text output.
    """
    await websocket.accept()
    logger.info("terminal_connected", session_id=session_id)
    pid: int | None = None
    master_fd: int | None = None
    try:
        pid, master_fd = await _run_session(websocket, session_id)
    except Exception as e:
        logger.error("terminal_error", session_id=session_id, error=str(e))
        with contextlib.suppress(Exception):
            await websocket.close(code=1011, reason="Internal server error")
    finally:
        if pid is not None and master_fd is not None:
            await cleanup_pty_process(pid, master_fd)
        logger.info("terminal_cleanup_complete", session_id=session_id)
