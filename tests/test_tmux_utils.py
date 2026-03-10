"""Tests for external tmux session discovery."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from terminal.utils.tmux import (
    get_external_agent_tmux_session,
    list_external_agent_tmux_sessions,
    reset_tmux_window_size_policy,
)


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
