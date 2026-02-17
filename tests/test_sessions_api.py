"""Tests for session REST endpoints (/api/terminal/sessions).

Covers:
- List sessions
- Get session by ID
- Create session (deprecated, should return 400)
- Update session metadata
- Delete session
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_session(
    session_id: str | None = None,
    name: str = "Test Session",
    is_alive: bool = True,
    mode: str = "shell",
    project_id: str | None = None,
) -> dict[str, Any]:
    """Build a fake session dict matching the shape returned by storage._row_to_dict."""
    sid = session_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": sid,
        "name": name,
        "user_id": None,
        "project_id": project_id,
        "working_dir": "/home/user",
        "display_order": 0,
        "mode": mode,
        "session_number": 1,
        "is_alive": is_alive,
        "created_at": now,
        "last_accessed_at": now,
        "last_claude_session": None,
        "claude_state": "not_started",
        "pane_id": None,
    }


# ---------------------------------------------------------------------------
# List sessions
# ---------------------------------------------------------------------------

def test_list_sessions_returns_items(test_app: TestClient) -> None:
    """GET /api/terminal/sessions -- returns list of alive sessions."""
    # Arrange
    sessions = [_make_session(name="s1"), _make_session(name="s2")]
    with patch("terminal.api.sessions.terminal_store.list_sessions", return_value=sessions):
        # Act
        response = test_app.get("/api/terminal/sessions")

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    assert body["items"][0]["name"] == "s1"


def test_list_sessions_empty_returns_zero_total(test_app: TestClient) -> None:
    """GET /api/terminal/sessions -- empty list returns total=0."""
    # Arrange
    with patch("terminal.api.sessions.terminal_store.list_sessions", return_value=[]):
        # Act
        response = test_app.get("/api/terminal/sessions")

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


# ---------------------------------------------------------------------------
# Get session
# ---------------------------------------------------------------------------

def test_get_session_found_returns_200(test_app: TestClient) -> None:
    """GET /api/terminal/sessions/{id} -- existing session returns 200."""
    # Arrange
    sid = str(uuid.uuid4())
    session = _make_session(session_id=sid, name="My Terminal")
    with patch("terminal.api.sessions.terminal_store.get_session", return_value=session):
        # Act
        response = test_app.get(f"/api/terminal/sessions/{sid}")

    # Assert
    assert response.status_code == 200
    assert response.json()["id"] == sid
    assert response.json()["name"] == "My Terminal"


def test_get_session_not_found_returns_404(test_app: TestClient) -> None:
    """GET /api/terminal/sessions/{id} -- missing session returns 404."""
    # Arrange
    sid = str(uuid.uuid4())
    with patch("terminal.api.sessions.terminal_store.get_session", return_value=None):
        # Act
        response = test_app.get(f"/api/terminal/sessions/{sid}")

    # Assert
    assert response.status_code == 404


def test_get_session_invalid_uuid_returns_400(test_app: TestClient) -> None:
    """GET /api/terminal/sessions/{id} -- malformed UUID returns 400."""
    # Act
    response = test_app.get("/api/terminal/sessions/not-a-uuid")

    # Assert
    assert response.status_code == 400
    assert "Invalid UUID" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Update session
# ---------------------------------------------------------------------------

def test_update_session_name_returns_updated(test_app: TestClient) -> None:
    """PATCH /api/terminal/sessions/{id} -- rename succeeds."""
    # Arrange
    sid = str(uuid.uuid4())
    original = _make_session(session_id=sid, name="Old Name")
    updated = {**original, "name": "New Name"}
    with (
        patch("terminal.api.sessions.terminal_store.get_session", return_value=original),
        patch("terminal.api.sessions.terminal_store.update_session", return_value=updated),
    ):
        # Act
        response = test_app.patch(
            f"/api/terminal/sessions/{sid}",
            json={"name": "New Name"},
        )

    # Assert
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_update_session_not_found_returns_404(test_app: TestClient) -> None:
    """PATCH /api/terminal/sessions/{id} -- missing session returns 404."""
    # Arrange
    sid = str(uuid.uuid4())
    with patch("terminal.api.sessions.terminal_store.get_session", return_value=None):
        # Act
        response = test_app.patch(
            f"/api/terminal/sessions/{sid}",
            json={"name": "Whatever"},
        )

    # Assert
    assert response.status_code == 404


def test_update_session_no_fields_returns_existing(test_app: TestClient) -> None:
    """PATCH /api/terminal/sessions/{id} -- empty body returns current session."""
    # Arrange
    sid = str(uuid.uuid4())
    existing = _make_session(session_id=sid, name="Unchanged")
    with patch("terminal.api.sessions.terminal_store.get_session", return_value=existing):
        # Act
        response = test_app.patch(
            f"/api/terminal/sessions/{sid}",
            json={},
        )

    # Assert
    assert response.status_code == 200
    assert response.json()["name"] == "Unchanged"


# ---------------------------------------------------------------------------
# Delete session
# ---------------------------------------------------------------------------

def test_delete_session_success_returns_deleted(test_app: TestClient, mock_lifecycle: dict[str, MagicMock]) -> None:
    """DELETE /api/terminal/sessions/{id} -- returns deleted=True."""
    # Arrange
    sid = str(uuid.uuid4())

    # Act
    response = test_app.delete(f"/api/terminal/sessions/{sid}")

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] is True
    assert body["id"] == sid
    mock_lifecycle["delete_session"].assert_called_once_with(sid)


def test_delete_session_invalid_uuid_returns_400(test_app: TestClient) -> None:
    """DELETE /api/terminal/sessions/{id} -- malformed UUID returns 400."""
    # Act
    response = test_app.delete("/api/terminal/sessions/bad-id")

    # Assert
    assert response.status_code == 400
