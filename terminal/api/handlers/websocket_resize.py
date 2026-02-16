"""WebSocket resize event handling."""

from __future__ import annotations

import asyncio

from fastapi import WebSocket

from ...logging_config import get_logger
from .websocket_messages import handle_websocket_message

logger = get_logger(__name__)


async def wait_for_initial_resize(
    websocket: WebSocket,
    master_fd: int,
    session_id: str,
    tmux_session_name: str,
    timeout: float = 5.0,
) -> bool:
    """Wait for initial resize event from frontend.

    The frontend sends a resize event on connection to sync dimensions
    between the browser terminal and tmux session.

    Args:
        websocket: WebSocket connection
        master_fd: PTY master file descriptor
        session_id: Terminal session identifier
        tmux_session_name: Tmux session name
        timeout: Maximum seconds to wait for resize event

    Returns:
        True if resize was received, False if timeout occurred
    """
    try:
        async with asyncio.timeout(timeout):
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    return False

                resize_result = await handle_websocket_message(
                    message, master_fd, session_id, tmux_session_name
                )
                if resize_result is not None:
                    logger.info(
                        "initial_resize_received",
                        session_id=session_id,
                        cols=resize_result[0],
                        rows=resize_result[1],
                    )
                    return True
    except TimeoutError:
        logger.warning(
            "initial_resize_timeout",
            session_id=session_id,
            timeout=timeout,
        )
        return False
