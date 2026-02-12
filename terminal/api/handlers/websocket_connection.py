"""WebSocket connection lifecycle management."""

from __future__ import annotations

import asyncio
import contextlib
import os
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from ...logging_config import get_logger
from ...services.pty_manager import read_pty_output, spawn_pty_for_tmux
from ...utils.tmux import get_scrollback
from .session_validation import validate_and_prepare_session
from .websocket_messages import handle_websocket_message

logger = get_logger(__name__)

# Active sessions tracking
_sessions: dict[str, dict[str, Any]] = {}


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
        # Validate session and prepare tmux
        try:
            session, tmux_session_name = validate_and_prepare_session(session_id)
        except ValueError as e:
            await websocket.close(
                code=4000,
                reason=f'{{"error": "session_dead", "message": "{e!s}"}}',
            )
            return

        # Extract session data for PTY spawn
        stored_target_session = session.get("last_claude_session")

        # Spawn PTY for tmux (pass stored target session for auto-reconnect)
        master_fd, pid = spawn_pty_for_tmux(tmux_session_name, stored_target_session)

        # Store session info
        _sessions[session_id] = {
            "master_fd": master_fd,
            "pid": pid,
            "session_name": tmux_session_name,
        }

        # Wait for first resize event from frontend (sync dimensions)
        # This ensures tmux dimensions match frontend before sending scrollback
        initial_resize_received = False
        resize_timeout = 5.0  # seconds to wait for resize

        try:
            async with asyncio.timeout(resize_timeout):
                while not initial_resize_received:
                    message = await websocket.receive()
                    if message["type"] == "websocket.disconnect":
                        return
                    resize_result = handle_websocket_message(
                        message, master_fd, session_id, tmux_session_name
                    )
                    if resize_result is not None:
                        initial_resize_received = True
                        logger.info(
                            "initial_resize_received",
                            session_id=session_id,
                            cols=resize_result[0],
                            rows=resize_result[1],
                        )
        except TimeoutError:
            # No resize received, proceed with defaults
            logger.warning(
                "initial_resize_timeout",
                session_id=session_id,
                timeout=resize_timeout,
            )

        # Capture and send scrollback after resize (dimensions now match)
        scrollback = get_scrollback(tmux_session_name)
        if scrollback:
            await websocket.send_text(scrollback)
            logger.info(
                "scrollback_sent",
                session_id=session_id,
                bytes=len(scrollback),
            )

        # Start output reader task for live output
        output_task = asyncio.create_task(read_pty_output(websocket, master_fd))

        # Start heartbeat task to keep connection alive through proxies/firewalls
        async def _heartbeat() -> None:
            while True:
                await asyncio.sleep(30)
                try:
                    await websocket.send_bytes(b"")
                except Exception:
                    break

        heartbeat_task = asyncio.create_task(_heartbeat())

        # Auto-start Claude for claude-mode sessions
        session_mode = session.get("mode")
        if session_mode == "claude":
            # Import here to avoid circular import
            from ...utils.tmux import is_claude_running_in_session

            # Check if Claude is already running
            if not is_claude_running_in_session(tmux_session_name):
                # Wait for shell prompt to appear, then send claude command
                await asyncio.sleep(0.3)
                os.write(master_fd, b"claude --dangerously-skip-permissions\n")
                logger.info("auto_started_claude", session_id=session_id)

        # Session tracking is now handled by tmux hooks (see main.py)
        # No polling needed - hooks notify us instantly on session switch

        # Read input from WebSocket
        try:
            while True:
                message = await websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                handle_websocket_message(message, master_fd, session_id, tmux_session_name)

        except WebSocketDisconnect:
            logger.info("terminal_disconnected", session_id=session_id)

        finally:
            heartbeat_task.cancel()
            output_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task
            with contextlib.suppress(asyncio.CancelledError):
                await output_task

    except Exception as e:
        logger.error("terminal_error", session_id=session_id, error=str(e))
        with contextlib.suppress(Exception):
            await websocket.close(code=1011, reason=str(e))

    finally:
        # Clean up PTY child process and fd, but keep tmux session
        if pid is not None:
            with contextlib.suppress(OSError):
                os.kill(pid, 9)  # SIGKILL the tmux attach process
            # Wait for child to exit (with retries to prevent zombie)
            for _ in range(20):
                try:
                    wpid, _ = os.waitpid(pid, os.WNOHANG)
                    if wpid != 0:
                        break  # Child reaped
                except ChildProcessError:
                    break  # Already reaped by someone else
                except OSError:
                    break  # Process doesn't exist
                await asyncio.sleep(0.01)  # 10ms delay between retries
            else:
                # Final blocking wait if still not reaped
                with contextlib.suppress(OSError, ChildProcessError):
                    os.waitpid(pid, 0)

        if master_fd is not None:
            with contextlib.suppress(OSError):
                os.close(master_fd)

        _sessions.pop(session_id, None)

        logger.info("terminal_cleanup_complete", session_id=session_id)
