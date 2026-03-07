from __future__ import annotations

import asyncio
import contextlib
import json
from collections.abc import Callable
from typing import Any

from ..logging_config import get_logger
from ..utils.tmux import get_scrollback

logger = get_logger(__name__)

SCROLLBACK_SYNC_DELAY_SECONDS = 0.05
MAX_SCROLLBACK_CHARS = 64_000


def normalize_scrollback(scrollback: str) -> str:
    """Normalize tmux capture-pane output for xterm consumption."""
    return scrollback.replace("\r\n", "\n").replace("\n", "\r\n")


def limit_scrollback(scrollback: str, max_chars: int = MAX_SCROLLBACK_CHARS) -> str:
    """Trim large scrollback payloads to the newest tail for browser transport."""
    if max_chars <= 0 or len(scrollback) <= max_chars:
        return scrollback

    trimmed = scrollback[-max_chars:]
    first_newline = trimmed.find("\n")
    if first_newline == -1:
        return trimmed
    return trimmed[first_newline + 1:]


def prepare_scrollback_for_transport(
    scrollback: str,
    max_chars: int = MAX_SCROLLBACK_CHARS,
) -> str:
    """Normalize and bound tmux scrollback before sending it to the browser."""
    return limit_scrollback(
        normalize_scrollback(scrollback),
        max_chars=max_chars,
    )


def _make_scrollback_payload(scrollback_data: str) -> dict[str, Any]:
    """Return the canonical scrollback-sync control dict."""
    return {"__ctrl": True, "scrollback_sync": scrollback_data}


def build_scrollback_sync_payload(scrollback: str) -> str:
    return json.dumps(
        _make_scrollback_payload(prepare_scrollback_for_transport(scrollback)),
    )


class ScrollbackSyncOutputTracker:
    """Trigger syncs after enough cumulative flushed output has arrived."""

    def __init__(
        self,
        scheduler: ScrollbackSyncScheduler,
        *,
        min_lines: int,
    ) -> None:
        self._scheduler = scheduler
        self._min_lines = min_lines
        self._pending_lines = 0

    def record_output(self, batch: str) -> None:
        self._pending_lines += batch.count("\n")
        if self._pending_lines < self._min_lines:
            return
        self._pending_lines = 0
        self._scheduler.notify_output()


class ScrollbackSyncScheduler:
    """Debounce authoritative tmux scrollback syncs after live shell output."""

    def __init__(
        self,
        websocket: Any,
        tmux_session_name: str,
        *,
        delay_seconds: float = SCROLLBACK_SYNC_DELAY_SECONDS,
        max_chars: int = MAX_SCROLLBACK_CHARS,
        get_scrollback_fn: Callable[[str], str | None] = get_scrollback,
    ) -> None:
        self._websocket = websocket
        self._tmux_session_name = tmux_session_name
        self._delay_seconds = delay_seconds
        self._max_chars = max_chars
        self._get_scrollback = get_scrollback_fn
        self._task: asyncio.Task[None] | None = None

    def notify_output(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = asyncio.create_task(self._send_after_idle())

    async def close(self) -> None:
        if not self._task:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def _send_after_idle(self) -> None:
        try:
            await asyncio.sleep(self._delay_seconds)
            scrollback = await asyncio.to_thread(
                self._get_scrollback,
                self._tmux_session_name,
            )
            if not scrollback:
                return
            bounded_scrollback = prepare_scrollback_for_transport(
                scrollback,
                max_chars=self._max_chars,
            )
            if not bounded_scrollback:
                return
            await self._websocket.send_text(
                json.dumps(_make_scrollback_payload(bounded_scrollback)),
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "scrollback_sync_failed",
                session=self._tmux_session_name,
                error=str(exc),
            )
