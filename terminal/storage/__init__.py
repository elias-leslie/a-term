"""Storage layer for Terminal Service.

Provides database access functions for:
- Terminal panes (CRUD, ordering, swapping)
- Terminal sessions (CRUD, lifecycle, project queries)
- Project settings (enabled/disabled projects, display order)
"""

from .maintenance_runs import (
    complete_run as complete_maintenance_run,
)
from .maintenance_runs import (
    create_run as create_maintenance_run,
)
from .maintenance_runs import (
    list_recent_runs as list_recent_maintenance_runs,
)
from .pane_crud import (
    PaneId,
    count_panes,
    create_pane,
    create_pane_with_sessions,
    delete_pane,
    get_next_pane_number,
    get_pane,
    get_pane_with_sessions,
    list_panes,
    list_panes_with_sessions,
    swap_pane_positions,
    update_pane,
    update_pane_order,
)
from .project_settings import (
    bulk_update_order,
    get_all_settings,
    set_active_mode,
    upsert_settings,
)
from .terminal import (
    create_session,
    delete_session,
    get_claude_state,
    get_session,
    get_session_by_project,
    list_sessions,
    mark_dead,
    purge_dead_sessions,
    touch_session,
    update_claude_session,
    update_claude_state,
    update_session,
)

__all__ = [
    "PaneId",
    "bulk_update_order",
    "complete_maintenance_run",
    "count_panes",
    "create_maintenance_run",
    "create_pane",
    "create_pane_with_sessions",
    "create_session",
    "delete_pane",
    "delete_session",
    "get_all_settings",
    "get_claude_state",
    "get_next_pane_number",
    "get_pane",
    "get_pane_with_sessions",
    "get_session",
    "get_session_by_project",
    "list_panes",
    "list_panes_with_sessions",
    "list_recent_maintenance_runs",
    "list_sessions",
    "mark_dead",
    "purge_dead_sessions",
    "set_active_mode",
    "swap_pane_positions",
    "touch_session",
    "update_claude_session",
    "update_claude_state",
    "update_pane",
    "update_pane_order",
    "update_session",
    "upsert_settings",
]
