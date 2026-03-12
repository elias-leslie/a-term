"""Tests for tmux utility functions."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from terminal.utils.tmux import (
    TMUX_SESSION_PREFIX,
    get_external_agent_tmux_session,
    get_tmux_session_name,
    is_managed_tmux_session_name,
    list_external_agent_tmux_sessions,
    list_tmux_sessions,
    reset_tmux_window_size_policy,
    validate_session_name,
)


class TestValidateSessionName:
    def test_valid_names(self) -> None:
        assert validate_session_name("abc123") is True
        assert validate_session_name("my-session_1") is True
        assert validate_session_name("A") is True

    def test_invalid_names(self) -> None:
        assert validate_session_name("") is False
        assert validate_session_name("has space") is False
        assert validate_session_name("has;semicolon") is False
        assert validate_session_name("a" * 256) is False


class TestSessionNameHelpers:
    def test_get_tmux_session_name(self) -> None:
        assert get_tmux_session_name("abc") == f"{TMUX_SESSION_PREFIX}abc"

    def test_is_managed_with_uuid(self) -> None:
        assert is_managed_tmux_session_name("summitflow-123e4567-e89b-12d3-a456-426614174000") is True

    def test_is_managed_without_prefix(self) -> None:
        assert is_managed_tmux_session_name("other-session") is False

    def test_is_managed_with_prefix_but_not_uuid(self) -> None:
        assert is_managed_tmux_session_name("summitflow-not-a-uuid") is False


class TestListTmuxSessions:
    def test_returns_uuids_only(self) -> None:
        output = "\n".join([
            "summitflow-123e4567-e89b-12d3-a456-426614174000",
            "summitflow-not-a-uuid",
            "other-session",
        ])
        with patch("terminal.utils.tmux.run_tmux_command", return_value=(True, output)):
            result = list_tmux_sessions()
        assert result == {"123e4567-e89b-12d3-a456-426614174000"}

    def test_returns_empty_on_failure(self) -> None:
        with patch("terminal.utils.tmux.run_tmux_command", return_value=(False, "error")):
            assert list_tmux_sessions() == set()


def test_list_external_agent_tmux_sessions_discovers_non_terminal_agent_sessions() -> None:
    with (
        patch(
            "terminal.utils.tmux.run_tmux_command",
            return_value=(
                True,
                "\n".join(
                    [
                        "claude-summitflow\t%1\t/home/kasadis/summitflow\tclaude",
                        "summitflow-123e4567-e89b-12d3-a456-426614174000\t%2\t/home/kasadis/summitflow\tbash",
                        "codex-agent-hub\t%3\t/home/kasadis/agent-hub\tcodex",
                    ]
                ),
            ),
        ),
        patch("terminal.utils.tmux.subprocess.run") as mock_subprocess,
    ):
        mock_subprocess.side_effect = [
            MagicMock(stdout="/home/kasadis/summitflow\n"),
            MagicMock(stdout="/home/kasadis/agent-hub\n"),
        ]
        sessions = list_external_agent_tmux_sessions()

    assert [session["id"] for session in sessions] == ["claude-summitflow", "codex-agent-hub"]
    assert sessions[0]["project_id"] == "summitflow"
    assert sessions[0]["mode"] == "claude"
    assert sessions[1]["project_id"] == "agent-hub"
    assert sessions[1]["mode"] == "codex"


def test_get_external_agent_tmux_session_matches_by_name() -> None:
    session = {
        "id": "claude-summitflow",
        "tmux_session_name": "claude-summitflow",
        "is_external": True,
    }
    with patch("terminal.utils.tmux.list_external_agent_tmux_sessions", return_value=[session]):
        assert get_external_agent_tmux_session("claude-summitflow") == session


def test_reset_tmux_window_size_policy_sets_latest() -> None:
    with patch("terminal.utils.tmux.run_tmux_command", return_value=(True, "")) as mock_run:
        assert reset_tmux_window_size_policy("codex-agent-hub") is True

    mock_run.assert_called_once_with(
        ["set-window-option", "-t", "codex-agent-hub", "window-size", "latest"]
    )
