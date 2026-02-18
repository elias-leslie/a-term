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


def _clamp_dimension(value: int, min_val: int, max_val: int) -> int:
    """Clamp a dimension value between min and max."""
    return min(max(value, min_val), max_val)


async def _handle_resize_command(
    data: dict[str, Any],
    master_fd: int,
    session_id: str,
    tmux_session_name: str | None,
    last_resize: list[int] | None,
) -> tuple[int, int]:
    """Handle a resize JSON command."""
    resize = data.get("resize", {})
    cols = _clamp_dimension(int(resize.get("cols", TMUX_DEFAULT_COLS)), TMUX_MIN_COLS, TMUX_MAX_COLS)
    rows = _clamp_dimension(int(resize.get("rows", TMUX_DEFAULT_ROWS)), TMUX_MIN_ROWS, TMUX_MAX_ROWS)

    # Skip PTY/tmux resize if dimensions unchanged (dedup)
    if not last_resize or cols != last_resize[0] or rows != last_resize[1]:
        resize_pty(master_fd, cols, rows)
        if tmux_session_name:
            await asyncio.to_thread(resize_tmux_window, tmux_session_name, cols, rows)
        if last_resize is not None:
            last_resize[0] = cols
            last_resize[1] = rows
        logger.info("terminal_resized", session_id=session_id, cols=cols, rows=rows)

    return (cols, rows)


async def _handle_text_message(
    text: str,
    master_fd: int,
    session_id: str,
    tmux_session_name: str | None,
    last_resize: list[int] | None,
) -> tuple[int, int] | None:
    """Handle a text WebSocket message, dispatching JSON control or raw input."""
    if text.startswith("{"):
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            os.write(master_fd, text.encode("utf-8"))
            return None

        if "resize" in data:
            return await _handle_resize_command(data, master_fd, session_id, tmux_session_name, last_resize)

        if data.get("refresh"):
            os.write(master_fd, b"\x0c")
            logger.debug("terminal_refreshed", session_id=session_id)
            return None

    os.write(master_fd, text.encode("utf-8"))
    return None


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
    if "text" in message:
        return await _handle_text_message(
            message["text"], master_fd, session_id, tmux_session_name, last_resize
        )

    if "bytes" in message:
        os.write(master_fd, message["bytes"])
        return None

    return None
