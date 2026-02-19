"""Session switch hook handler."""

from __future__ import annotations

import hmac
import uuid
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from ...logging_config import get_logger
from ...storage import terminal as terminal_store
from ...utils.tmux import validate_session_name

logger = get_logger(__name__)

# Prefix for terminal base sessions
BASE_SESSION_PREFIX = "summitflow-"

# Status and reason constants
STATUS_REJECTED = "rejected"
STATUS_IGNORED = "ignored"
STATUS_CLEARED = "cleared"
STATUS_STORED = "stored"

REASON_UNAUTHORIZED = "unauthorized"
REASON_INVALID_SESSION_NAME = "invalid session name"
REASON_NOT_FROM_BASE = "not from base session"

# Log event name constants
LOG_SWITCH_REJECTED = "session_switch_rejected"
LOG_SWITCH_TO_BASE = "session_switch_to_base"
LOG_SWITCH_DETECTED = "session_switch_detected"

# App state attribute name
APP_STATE_TOKEN_ATTR = "internal_token"


def _extract_token(request: Request, query_token: str) -> str:
    """Extract auth token from Authorization header (preferred) or query param (legacy).

    The Authorization header is preferred because the token is not visible
    in tmux hooks or process listings.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return query_token


def _verify_token(request: Request, token: str) -> bool:
    """Verify the internal authentication token.

    Returns True if the token is valid, False otherwise.
    """
    expected_token = (
        request.app.state.internal_token
        if hasattr(request.app.state, APP_STATE_TOKEN_ATTR)
        else ""
    )
    return bool(expected_token) and hmac.compare_digest(token, expected_token)


def _validate_session_names(from_session: str, to_session: str) -> bool:
    """Validate that session names are safe.

    Empty from_session is valid (first connection to a session).
    Returns True if both names are valid, False otherwise.
    """
    if from_session and not validate_session_name(from_session):
        return False
    return bool(validate_session_name(to_session))


def _track_session_switch(terminal_session_id: str, to_session: str) -> dict[str, Any]:
    """Update stored session target for the given terminal session.

    Clears the target if switching back to a base session,
    otherwise stores the new target session name.
    """
    if to_session.startswith(BASE_SESSION_PREFIX):
        logger.info(LOG_SWITCH_TO_BASE, terminal=terminal_session_id)
        terminal_store.update_claude_session(terminal_session_id, None)
        return {"status": STATUS_CLEARED}

    logger.info(LOG_SWITCH_DETECTED, terminal=terminal_session_id, target=to_session)
    terminal_store.update_claude_session(terminal_session_id, to_session)
    return {"status": STATUS_STORED, "target": to_session}


def handle_session_switch(
    request: Request,
    from_session: str,
    to_session: str,
    token: str = "",
) -> dict[str, Any] | JSONResponse:
    """Handle tmux session switch notifications.

    Called by tmux hook when a client switches sessions.
    Extracts terminal session ID from the base session name and stores the target.

    Security: Verifies internal token generated at startup.

    Args:
        request: FastAPI request object
        from_session: Session switching from
        to_session: Session switching to
        token: Internal authentication token

    Returns:
        Status dict indicating action taken
    """
    client_host = request.client.host if request.client else None

    resolved_token = _extract_token(request, token)
    if not _verify_token(request, resolved_token):
        logger.warning(LOG_SWITCH_REJECTED, reason="invalid_token", client=client_host)
        return JSONResponse(
            status_code=403,
            content={"status": STATUS_REJECTED, "reason": REASON_UNAUTHORIZED},
        )

    if not _validate_session_names(from_session, to_session):
        logger.warning(
            LOG_SWITCH_REJECTED,
            reason="invalid_session_name",
            from_session=from_session[:50] if from_session else "",
            to_session=to_session[:50],
        )
        return JSONResponse(
            status_code=400,
            content={"status": STATUS_REJECTED, "reason": REASON_INVALID_SESSION_NAME},
        )

    # Only track switches FROM a terminal base session
    # Empty from_session means initial connection, not a switch
    if not from_session or not from_session.startswith(BASE_SESSION_PREFIX):
        return {"status": STATUS_IGNORED, "reason": REASON_NOT_FROM_BASE}

    terminal_session_id = from_session[len(BASE_SESSION_PREFIX):]
    try:
        uuid.UUID(terminal_session_id)
    except ValueError:
        logger.warning("invalid_session_id", raw=terminal_session_id)
        return JSONResponse(status_code=400, content={"error": "Invalid session ID format"})
    return _track_session_switch(terminal_session_id, to_session)
