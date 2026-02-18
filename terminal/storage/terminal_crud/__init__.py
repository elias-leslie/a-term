"""Terminal sessions storage - CRUD operations.

This module handles basic Create, Read, Update, Delete operations
for terminal session persistence.
"""

from __future__ import annotations

from ._helpers import (
    TERMINAL_SESSION_FIELDS,
    _execute_session_query,
    _row_to_dict,
)
from ._operations import (
    create_session,
    delete_session,
    get_session,
    list_sessions,
    update_session,
)

__all__ = [
    "TERMINAL_SESSION_FIELDS",
    "_execute_session_query",
    "_row_to_dict",
    "create_session",
    "delete_session",
    "get_session",
    "list_sessions",
    "update_session",
]
