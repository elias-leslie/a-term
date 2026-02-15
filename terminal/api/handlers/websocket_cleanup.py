"""WebSocket connection cleanup utilities."""

from __future__ import annotations

import asyncio
import contextlib
import os
import signal

from ...logging_config import get_logger

logger = get_logger(__name__)


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

    # Wait for child to exit after SIGTERM
    for _ in range(50):  # 500ms grace period
        try:
            wpid, _ = os.waitpid(pid, os.WNOHANG)
            if wpid != 0:
                break  # Child reaped
        except ChildProcessError:
            break  # Already reaped
        except OSError:
            break  # Process doesn't exist
        await asyncio.sleep(0.01)
    else:
        # SIGTERM didn't work — force kill
        with contextlib.suppress(OSError):
            os.kill(pid, signal.SIGKILL)

        # Wait for SIGKILL to take effect
        for _ in range(20):
            try:
                wpid, _ = os.waitpid(pid, os.WNOHANG)
                if wpid != 0:
                    break
            except (ChildProcessError, OSError):
                break
            await asyncio.sleep(0.01)
        else:
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
