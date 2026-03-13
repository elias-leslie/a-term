"""Tests for WebSocket connection lifecycle helpers."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from terminal.api.handlers.websocket_connection import _run_session, _setup_connection


@pytest.mark.asyncio
async def test_setup_connection_applies_external_attach_options() -> None:
    session = {
        "is_external": True,
        "mode": "codex",
        "last_claude_session": None,
    }
    websocket = AsyncMock()

    with (
        patch(
            "terminal.api.handlers.websocket_connection.validate_and_prepare_session",
            return_value=(session, "codex-agent-hub"),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.reset_tmux_window_size_policy",
            return_value=True,
        ) as mock_reset,
        patch(
            "terminal.api.handlers.websocket_connection.apply_external_attach_options",
            return_value=True,
        ) as mock_apply,
        patch(
            "terminal.api.handlers.websocket_connection.spawn_pty_for_tmux",
            return_value=(17, 23),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.wait_for_initial_resize",
            new=AsyncMock(),
        ) as mock_wait,
        patch(
            "terminal.api.handlers.websocket_connection.get_scrollback",
            return_value=None,
        ),
    ):
        result = await _setup_connection(websocket, "codex-agent-hub")

    assert result == (session, "codex-agent-hub", 17, 23, False)
    mock_reset.assert_called_once_with("codex-agent-hub")
    mock_apply.assert_called_once_with("codex-agent-hub")
    mock_wait.assert_awaited_once()


@pytest.mark.asyncio
async def test_setup_connection_restores_external_attach_options_after_setup_failure() -> None:
    session = {
        "is_external": True,
        "mode": "codex",
        "last_claude_session": None,
    }
    websocket = AsyncMock()

    with (
        patch(
            "terminal.api.handlers.websocket_connection.validate_and_prepare_session",
            return_value=(session, "codex-agent-hub"),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.reset_tmux_window_size_policy",
            return_value=True,
        ),
        patch(
            "terminal.api.handlers.websocket_connection.apply_external_attach_options",
            return_value=True,
        ),
        patch(
            "terminal.api.handlers.websocket_connection.restore_external_attach_options",
            return_value=True,
        ) as mock_restore,
        patch(
            "terminal.api.handlers.websocket_connection.spawn_pty_for_tmux",
            return_value=(17, 23),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.wait_for_initial_resize",
            new=AsyncMock(side_effect=RuntimeError("resize failed")),
        ),
    ):
        with pytest.raises(RuntimeError, match="resize failed"):
            await _setup_connection(websocket, "codex-agent-hub")

    mock_restore.assert_called_once_with("codex-agent-hub")


@pytest.mark.asyncio
async def test_run_session_restores_external_attach_options_on_disconnect() -> None:
    websocket = AsyncMock()
    session = {"is_external": True, "mode": "codex"}

    with (
        patch(
            "terminal.api.handlers.websocket_connection._setup_connection",
            new=AsyncMock(return_value=(session, "codex-agent-hub", 17, 23, False)),
        ),
        patch(
            "terminal.api.handlers.websocket_connection._run_message_loop",
            new=AsyncMock(),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.read_pty_output",
            new=AsyncMock(),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.heartbeat_loop",
            new=AsyncMock(),
        ),
        patch(
            "terminal.api.handlers.websocket_connection.restore_external_attach_options",
            return_value=True,
        ) as mock_restore,
    ):
        result = await _run_session(websocket, "codex-agent-hub")

    assert result == (23, 17)
    mock_restore.assert_called_once_with("codex-agent-hub")
