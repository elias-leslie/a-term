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

# Output batching constants (from ghostty/AutoMaker analysis)
FLUSH_INTERVAL_MS = 16  # milliseconds - ~60fps
BATCH_SIZE_LIMIT = 4096  # bytes - 4KB
MAX_UTF8_BUFFER = 4  # UTF-8 chars are max 4 bytes


def _make_on_readable(
    master_fd: int,
    queue: asyncio.Queue[bytes | None],
) -> Callable[[], None]:
    """Return a callback for when the PTY fd becomes readable."""

    def on_readable() -> None:
        try:
            data = os.read(master_fd, 8192)
            if data:
                # Drop data when consumer can't keep up — prevents memory runaway.
                # Terminal output is best-effort; the user still has tmux scrollback.
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(data)
            else:
                queue.put_nowait(None)  # EOF
        except OSError as e:
            # EIO is expected when terminal closes
            if e.errno != errno.EIO:
                logger.warning("pty_read_error", error=str(e), errno=e.errno)
            queue.put_nowait(None)
        except Exception as e:
            logger.error("pty_read_unexpected_error", error=str(e))
            queue.put_nowait(None)

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


async def _run_batch_loop(
    websocket: WebSocket,
    queue: asyncio.Queue[bytes | None],
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Drive the batching loop: read from queue, decode, flush to websocket."""
    utf8_buffer = b""
    batch_buffer = ""
    last_flush_time = loop.time()

    async def flush() -> bool:
        nonlocal batch_buffer, last_flush_time
        if batch_buffer:
            await websocket.send_text(batch_buffer)
            if "[exited]" in batch_buffer:
                logger.info("tmux_session_exited_detected")
                batch_buffer = ""
                return False
            batch_buffer = ""
        last_flush_time = loop.time()
        return True

    try:
        while True:
            time_since_flush = (loop.time() - last_flush_time) * 1000  # ms
            wait_time = max(0.001, (FLUSH_INTERVAL_MS - time_since_flush) / 1000)

            try:
                output = await asyncio.wait_for(queue.get(), timeout=wait_time)
            except TimeoutError:
                if not await flush():
                    break
                continue

            if output is None:
                await flush()
                break

            decoded, utf8_buffer = _decode_output(output, utf8_buffer)

            if decoded:
                batch_buffer += decoded
                size_limit_hit = len(batch_buffer) >= BATCH_SIZE_LIMIT
                if (size_limit_hit and not await flush()) or (
                    queue.empty() and not await flush()
                ):
                    break

    except asyncio.CancelledError:
        if batch_buffer:
            with contextlib.suppress(Exception):
                await websocket.send_text(batch_buffer)
    except Exception as e:
        logger.error("terminal_output_error", error=str(e))
