"""WebSocket message handling logic."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from ...config import (
    TMUX_DEFAULT_COLS,
    TMUX_DEFAULT_ROWS,
    TMUX_MAX_COLS,
    TMUX_MAX_ROWS,
    TMUX_MIN_COLS,
    TMUX_MIN_ROWS,
)
from ...logging_config import get_logger
from ...services.pty_manager import resize_pty
from ...utils.tmux import resize_tmux_window

logger = get_logger(__name__)


async def handle_websocket_message(
    message: Any,
    master_fd: int,
    session_id: str,
    tmux_session_name: str | None = None,
    last_resize: list[int] | None = None,
) -> tuple[int, int] | None:
    """Handle a single WebSocket message.

    Args:
        message: WebSocket message dict
        master_fd: Master file descriptor to write to
        session_id: Terminal session ID (for logging)
        tmux_session_name: tmux session name for resize operations
        last_resize: Mutable [cols, rows] tracker for deduplication.
            When provided, skips resize if dimensions are unchanged.

    Returns:
        (cols, rows) tuple if this was a resize event, None otherwise

    Handles:
    - Resize commands (JSON starting with {"resize":)
    - Text input (forwarded to PTY)
    - Binary input (forwarded to PTY)
    """
    # Handle text messages
    if "text" in message:
        text = message["text"]

        # Check for JSON control commands
        if text.startswith("{"):
            try:
                data = json.loads(text)

                # Handle resize command
                if "resize" in data:
                    resize = data.get("resize", {})
                    cols = min(max(int(resize.get("cols", TMUX_DEFAULT_COLS)), TMUX_MIN_COLS), TMUX_MAX_COLS)
                    rows = min(max(int(resize.get("rows", TMUX_DEFAULT_ROWS)), TMUX_MIN_ROWS), TMUX_MAX_ROWS)

                    # Skip if dimensions unchanged (dedup)
                    if last_resize and cols == last_resize[0] and rows == last_resize[1]:
                        return (cols, rows)

                    resize_pty(master_fd, cols, rows)
                    # Resize tmux window in a thread to avoid blocking the event loop
                    if tmux_session_name:
                        await asyncio.to_thread(resize_tmux_window, tmux_session_name, cols, rows)

                    # Update tracker
                    if last_resize is not None:
                        last_resize[0] = cols
                        last_resize[1] = rows

                    logger.info(
                        "terminal_resized",
                        session_id=session_id,
                        cols=cols,
                        rows=rows,
                    )
                    return (cols, rows)

                # Handle refresh command (redraw terminal after connect)
                if data.get("refresh"):
                    # Send Ctrl+L to trigger terminal redraw
                    os.write(master_fd, b"\x0c")
                    logger.debug("terminal_refreshed", session_id=session_id)
                    return None

            except json.JSONDecodeError:
                # Not valid JSON, treat as input
                pass

        # Regular input - write to PTY
        os.write(master_fd, text.encode("utf-8"))
        return None

    # Handle binary messages
    if "bytes" in message:
        os.write(master_fd, message["bytes"])
        return None

    return None
