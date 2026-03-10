"""Tests for agent state/start endpoints with external tmux sessions."""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient


def test_get_agent_state_returns_external_tmux_state(test_app: TestClient) -> None:
    external = {
        "id": "claude-summitflow",
        "mode": "claude",
        "claude_state": "running",
    }
    with (
        patch("terminal.api.agent.terminal_store.get_session", return_value=None),
        patch("terminal.api.agent.get_external_agent_tmux_session", return_value=external),
    ):
        response = test_app.get("/api/terminal/sessions/claude-summitflow/agent-state")

    assert response.status_code == 200
    assert response.json() == {
        "session_id": "claude-summitflow",
        "claude_state": "running",
    }


def test_start_agent_returns_noop_for_external_tmux_session(test_app: TestClient) -> None:
    external = {
        "id": "codex-summitflow",
        "mode": "codex",
        "claude_state": "running",
    }
    with (
        patch("terminal.api.agent.terminal_store.get_session", return_value=None),
        patch("terminal.api.agent.get_external_agent_tmux_session", return_value=external),
    ):
        response = test_app.post("/api/terminal/sessions/codex-summitflow/start-agent")

    assert response.status_code == 200
    assert response.json() == {
        "session_id": "codex-summitflow",
        "started": False,
        "message": "External tmux agent session is already running",
        "claude_state": "running",
    }
