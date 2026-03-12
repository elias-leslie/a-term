"""Terminal sessions storage layer - Facade for backward compatibility.

This module re-exports session CRUD, lifecycle, and project-specific
functions from their respective submodules. It serves as the main
entry point for terminal session storage operations.

Submodules:
- terminal_crud: Basic CRUD operations
- terminal_lifecycle: Session lifecycle management
- terminal_project: Project-scoped queries
- terminal_claude: Agent state management
"""

from __future__ import annotations

# Claude integration (re-exported from terminal_claude.py)
from .terminal_claude import (
    get_claude_state,
    update_claude_session,
    update_claude_state,
)

# CRUD operations
from .terminal_crud import (
    create_session,
    delete_session,
    get_session,
    list_sessions,
    update_session,
)

# Lifecycle operations
from .terminal_lifecycle import (
    mark_dead,
    purge_dead_sessions,
    touch_session,
)

# Project-specific queries
from .terminal_project import (
    claim_dead_session_by_project,
    get_session_by_project,
)

__all__ = [
    "claim_dead_session_by_project",
    "create_session",
    "delete_session",
    "get_claude_state",
    "get_session",
    "get_session_by_project",
    "list_sessions",
    "mark_dead",
    "purge_dead_sessions",
    "touch_session",
    "update_claude_session",
    "update_claude_state",
    "update_session",
]
