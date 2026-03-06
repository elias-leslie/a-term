from __future__ import annotations

import asyncio

from terminal.services._pty_reader import _make_on_readable


def test_make_on_readable_enqueues_all_output(monkeypatch) -> None:
    queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    on_readable = _make_on_readable(123, queue, session_id="session-1")

    monkeypatch.setattr(
        "terminal.services._pty_reader._read_pty_data",
        lambda _master_fd: b"hello",
    )

    on_readable()

    assert queue.get_nowait() == b"hello"


def test_make_on_readable_enqueues_eof(monkeypatch) -> None:
    queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    on_readable = _make_on_readable(123, queue, session_id="session-1")

    monkeypatch.setattr(
        "terminal.services._pty_reader._read_pty_data",
        lambda _master_fd: None,
    )

    on_readable()

    assert queue.get_nowait() is None
