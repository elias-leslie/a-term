"""Tests for the maintenance orchestration service."""

from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI

from terminal.services.maintenance import (
    MAINTENANCE_STATUS_ATTR,
    build_initial_status,
    run_cycle,
    start_scheduler,
)
from terminal.services.upload_cleanup import UploadCleanupStats


@contextmanager
def _advisory_lock(acquired: bool):
    yield acquired


@pytest.mark.asyncio
async def test_run_cycle_updates_status_and_collects_results() -> None:
    """Maintenance cycle stores detailed success results on the app state."""
    app = FastAPI()
    setattr(app.state, MAINTENANCE_STATUS_ATTR, build_initial_status())

    with (
        patch("terminal.services.maintenance.advisory_lock", side_effect=lambda _key: _advisory_lock(True)),
        patch(
            "terminal.services.maintenance.lifecycle.reconcile_sessions",
            return_value={"purged": 2, "orphans_killed": 1},
        ),
        patch(
            "terminal.services.maintenance.cleanup_old_uploads",
            return_value=UploadCleanupStats(scanned_files=3, deleted_files=1, pruned_directories=1),
        ),
        patch(
            "terminal.services.maintenance.agent_tools_store.ensure_default",
            return_value={"slug": "codex"},
        ),
        patch(
            "terminal.services.maintenance.summitflow_client.list_projects",
            new=AsyncMock(return_value=[{"id": "terminal"}, {"id": "summitflow"}]),
        ),
        patch(
            "terminal.services.maintenance.project_settings_store.prune_missing_projects",
            return_value=1,
        ) as mock_prune,
    ):
        result = await run_cycle(app, reason="manual")

    assert result["skipped"] is False
    assert result["default_agent_tool"] == "codex"
    assert result["reconciliation"]["purged"] == 2
    assert result["upload_cleanup"]["deleted_files"] == 1
    status = getattr(app.state, MAINTENANCE_STATUS_ATTR)
    assert status["state"] == "idle"
    assert status["runs"] == 1
    assert status["last_success_at"] is not None
    assert status["last_result"] == result
    mock_prune.assert_called_once_with({"terminal", "summitflow"})


@pytest.mark.asyncio
async def test_run_cycle_skips_when_lock_not_acquired() -> None:
    """Maintenance cycles are skipped instead of double-running when locked."""
    app = FastAPI()
    setattr(app.state, MAINTENANCE_STATUS_ATTR, build_initial_status())

    with patch(
        "terminal.services.maintenance.advisory_lock",
        side_effect=lambda _key: _advisory_lock(False),
    ):
        result = await run_cycle(app, reason="interval")

    assert result == {
        "reason": "interval",
        "skipped": True,
        "skip_reason": "lock_not_acquired",
    }
    status = getattr(app.state, MAINTENANCE_STATUS_ATTR)
    assert status["state"] == "idle"
    assert status["last_result"] == result
    assert status["last_success_at"] is None


@pytest.mark.asyncio
async def test_start_scheduler_records_startup_failure_without_task() -> None:
    """Startup failures are surfaced in maintenance status without crashing tests."""
    app = FastAPI()
    app.state = SimpleNamespace()

    with (
        patch("terminal.services.maintenance.run_cycle", new=AsyncMock(side_effect=RuntimeError("boom"))),
        patch("terminal.services.maintenance.MAINTENANCE_ENABLED", False),
    ):
        await start_scheduler(app)

    status = getattr(app.state, MAINTENANCE_STATUS_ATTR)
    assert status["state"] == "idle"
    assert status["last_error"] == "boom"
    assert not hasattr(app.state, "maintenance_task")
