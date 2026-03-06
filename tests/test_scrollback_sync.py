from __future__ import annotations

import asyncio
import json

from terminal.services.scrollback_sync import (
    ScrollbackSyncOutputTracker,
    ScrollbackSyncScheduler,
    normalize_scrollback,
)


def test_normalize_scrollback_converts_lf_without_duplicating_cr() -> None:
    assert normalize_scrollback("1\n2\r\n3\n") == "1\r\n2\r\n3\r\n"


def test_scrollback_sync_scheduler_debounces_to_latest_snapshot() -> None:
    sent_messages: list[str] = []
    latest_snapshot = {"value": "first\n"}

    class FakeWebSocket:
        async def send_text(self, payload: str) -> None:
            sent_messages.append(payload)

    async def run_test() -> None:
        scheduler = ScrollbackSyncScheduler(
            websocket=FakeWebSocket(),
            tmux_session_name="summitflow-test",
            delay_seconds=0.01,
            get_scrollback_fn=lambda _session_name: latest_snapshot["value"],
        )
        scheduler.notify_output()
        await asyncio.sleep(0)
        latest_snapshot["value"] = "second\n"
        scheduler.notify_output()
        await asyncio.sleep(0.03)
        await scheduler.close()

    asyncio.run(run_test())

    assert len(sent_messages) == 1
    payload = json.loads(sent_messages[0])
    assert payload == {
        "__ctrl": True,
        "scrollback_sync": "second\r\n",
    }


def test_scrollback_sync_output_tracker_waits_for_cumulative_threshold() -> None:
    notifications: list[str] = []

    class FakeScheduler:
        def notify_output(self) -> None:
            notifications.append("sync")

    tracker = ScrollbackSyncOutputTracker(FakeScheduler(), min_lines=5)

    tracker.record_output("1\n2\n")
    tracker.record_output("3\n4\n")

    assert notifications == []

    tracker.record_output("5\n")

    assert notifications == ["sync"]


def test_scrollback_sync_output_tracker_resets_after_trigger() -> None:
    notifications: list[str] = []

    class FakeScheduler:
        def notify_output(self) -> None:
            notifications.append("sync")

    tracker = ScrollbackSyncOutputTracker(FakeScheduler(), min_lines=3)

    tracker.record_output("1\n2\n3\n")
    tracker.record_output("4\n5\n")

    assert notifications == ["sync"]

    tracker.record_output("6\n")

    assert notifications == ["sync", "sync"]
