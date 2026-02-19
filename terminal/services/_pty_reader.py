"""Internal helpers for PTY output reading and batching.

Extracted from pty_manager to keep that module concise.
Not part of the public API — import from pty_manager instead.
"""

from __future__ import annotations

import asyncio
import contextlib
import errno
import os
from collections.abc import Callable
from typing import TYPE_CHECKING

from ..logging_config import get_logger

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = get_logger(__name__)

_drop_count = 0

# Output batching constants (from ghostty/AutoMaker analysis)
FLUSH_INTERVAL_MS = 16  # milliseconds - ~60fps
BATCH_SIZE_LIMIT = 4096  # bytes - 4KB
MAX_UTF8_BUFFER = 4  # UTF-8 chars are max 4 bytes


def _read_pty_data(master_fd: int) -> bytes | None:
    """Read data from PTY fd. Returns None on EOF or error."""
    try:
        data = os.read(master_fd, 8192)
        return data or None
    except OSError as e:
        if e.errno != errno.EIO:
            logger.warning("pty_read_error", error=str(e), errno=e.errno)
        return None
    except Exception as e:
        logger.error("pty_read_unexpected_error", error=str(e))
        return None


def _make_on_readable(
    master_fd: int,
    queue: asyncio.Queue[bytes | None],
) -> Callable[[], None]:
    """Return a callback for when the PTY fd becomes readable."""

    def on_readable() -> None:
        global _drop_count
        data = _read_pty_data(master_fd)
        if data is not None:
            # Drop data when consumer can't keep up — prevents memory runaway.
            # Terminal output is best-effort; the user still has tmux scrollback.
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                _drop_count += 1
                if _drop_count % 100 == 1:  # Log first drop, then every 100th
                    logger.warning("pty_output_dropped", drop_count=_drop_count, session=master_fd)
        else:
            queue.put_nowait(None)  # EOF

    return on_readable


def _decode_output(
    raw: bytes,
    utf8_buffer: bytes,
) -> tuple[str, bytes]:
    """Decode PTY bytes, handling incomplete UTF-8 sequences.

    Returns:
        (decoded_text, remaining_utf8_buffer)
    """
    output = utf8_buffer + raw
    try:
        return output.decode("utf-8"), b""
    except UnicodeDecodeError as e:
        if e.start >= len(output) - 3:
            # Incomplete sequence at the end — buffer for next read
            incomplete = output[e.start :]
            if len(incomplete) > MAX_UTF8_BUFFER:
                logger.debug("utf8_buffer_overflow", buffer_size=len(incomplete))
                incomplete = b""
            return output[: e.start].decode("utf-8", errors="replace"), incomplete
        return output.decode("utf-8", errors="replace"), b""


async def _flush_batch(
    websocket: WebSocket,
    batch_buffer: str,
    loop: asyncio.AbstractEventLoop,
) -> tuple[str, float, bool]:
    """Send buffered output to the websocket.

    Returns:
        (cleared_batch_buffer, new_flush_time, should_continue)
    """
    if batch_buffer:
        await websocket.send_text(batch_buffer)
        if "[exited]" in batch_buffer:
            logger.info("tmux_session_exited_detected")
            return "", loop.time(), False
    return "", loop.time(), True


async def _run_one_iteration(
    websocket: WebSocket,
    queue: asyncio.Queue[bytes | None],
    loop: asyncio.AbstractEventLoop,
    state: dict,
    wait_time: float,
) -> None:
    """Run one iteration: wait for data, decode, and flush when ready."""
    try:
        output = await asyncio.wait_for(queue.get(), timeout=wait_time)
    except TimeoutError:
        state["batch"], state["flush_time"], ok = await _flush_batch(
            websocket, state["batch"], loop
        )
        if not ok:
            state["running"] = False
        return

    if output is None:
        await _flush_batch(websocket, state["batch"], loop)
        state["running"] = False
        return

    decoded, state["utf8"] = _decode_output(output, state["utf8"])
    if decoded:
        state["batch"] += decoded
        size_limit_hit = len(state["batch"]) >= BATCH_SIZE_LIMIT
        if size_limit_hit or queue.empty():
            state["batch"], state["flush_time"], ok = await _flush_batch(
                websocket, state["batch"], loop
            )
            if not ok:
                state["running"] = False


async def _run_batch_loop(
    websocket: WebSocket,
    queue: asyncio.Queue[bytes | None],
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Drive the batching loop: read from queue, decode, flush to websocket."""
    state: dict = {
        "utf8": b"",
        "batch": "",
        "flush_time": loop.time(),
        "running": True,
    }

    try:
        while state["running"]:
            elapsed_ms = (loop.time() - state["flush_time"]) * 1000
            wait_time = max(0.001, (FLUSH_INTERVAL_MS - elapsed_ms) / 1000)
            await _run_one_iteration(websocket, queue, loop, state, wait_time)
    except asyncio.CancelledError:
        with contextlib.suppress(Exception):
            await websocket.send_text(state["batch"])
    except Exception as e:
        logger.error("terminal_output_error", error=str(e))
