"""WebSocket connection cleanup utilities."""

from __future__ import annotations

import asyncio
import contextlib
import os
import signal

from ...logging_config import get_logger

logger = get_logger(__name__)


async def _wait_for_process(pid: int, max_iterations: int) -> bool:
    """Wait for a process to exit via non-blocking waitpid.

    Args:
        pid: Process ID to wait for
        max_iterations: Maximum poll iterations (each ~10ms)

    Returns:
        True if process was reaped, False if still running
    """
    for _ in range(max_iterations):
        try:
            wpid, _ = os.waitpid(pid, os.WNOHANG)
            if wpid != 0:
                return True
        except (ChildProcessError, OSError):
            return True
        await asyncio.sleep(0.01)
    return False


async def cleanup_pty_process(pid: int, master_fd: int) -> None:
    """Clean up PTY child process and file descriptor.

    Sends SIGTERM first for graceful shutdown, then SIGKILL if needed.
    Ensures no zombie processes remain.

    Args:
        pid: Process ID to terminate
        master_fd: Master file descriptor to close
    """
    # Try graceful termination first
    with contextlib.suppress(OSError):
        os.kill(pid, signal.SIGTERM)

    if not await _wait_for_process(pid, max_iterations=50):
        # SIGTERM didn't work — force kill
        with contextlib.suppress(OSError):
            os.kill(pid, signal.SIGKILL)

        if not await _wait_for_process(pid, max_iterations=20):
            with contextlib.suppress(OSError, ChildProcessError):
                os.waitpid(pid, 0)

    # Close the master file descriptor
    with contextlib.suppress(OSError):
        os.close(master_fd)


async def cleanup_tasks(*tasks: asyncio.Task[object]) -> None:
    """Cancel and await multiple asyncio tasks.

    Args:
        tasks: Tasks to cancel and clean up
    """
    for task in tasks:
        task.cancel()

    for task in tasks:
        with contextlib.suppress(asyncio.CancelledError):
            await task
