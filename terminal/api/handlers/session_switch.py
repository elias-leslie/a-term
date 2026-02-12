"""Session switch hook handler."""

from __future__ import annotations

from typing import Any

from fastapi import Request

from ...logging_config import get_logger
from ...storage import terminal as terminal_store
from ...utils.tmux import validate_session_name

logger = get_logger(__name__)

# Prefix for terminal base sessions
BASE_SESSION_PREFIX = "summitflow-"


def handle_session_switch(
    request: Request,
    from_session: str,
    to_session: str,
) -> dict[str, Any]:
    """Handle tmux session switch notifications.

    Called by tmux hook when a client switches sessions.
    Extracts terminal session ID from the base session name and stores the target.

    Security: Only accepts requests from localhost (tmux hooks).

    Args:
        request: FastAPI request object
        from_session: Session switching from
        to_session: Session switching to

    Returns:
        Status dict indicating action taken
    """
    # Security: Only allow localhost
    client_host = request.client.host if request.client else None
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        logger.warning(
            "session_switch_rejected",
            reason="not_localhost",
            client=client_host,
        )
        return {"status": "rejected", "reason": "unauthorized"}

    # Validate session names to prevent injection
    # Empty from_session is valid (first connection to a session)
    if (from_session and not validate_session_name(from_session)) or not validate_session_name(
        to_session
    ):
        logger.warning(
            "session_switch_rejected",
            reason="invalid_session_name",
            from_session=from_session[:50] if from_session else "",
            to_session=to_session[:50],
        )
        return {"status": "rejected", "reason": "invalid session name"}

    # Only track switches FROM a terminal base session
    # Empty from_session means initial connection, not a switch
    if not from_session or not from_session.startswith(BASE_SESSION_PREFIX):
        return {"status": "ignored", "reason": "not from base session"}

    # Extract terminal session ID from "summitflow-{uuid}"
    terminal_session_id = from_session[len(BASE_SESSION_PREFIX) :]

    # Don't store if switching back to base session
    if to_session.startswith(BASE_SESSION_PREFIX):
        logger.info("session_switch_to_base", terminal=terminal_session_id)
        terminal_store.update_claude_session(terminal_session_id, None)
        return {"status": "cleared"}

    # Store the target session
    logger.info("session_switch_detected", terminal=terminal_session_id, target=to_session)
    terminal_store.update_claude_session(terminal_session_id, to_session)

    return {"status": "stored", "target": to_session}
