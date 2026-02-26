"""Terminal Service - FastAPI Application.

Independent microservice for web terminal functionality.
Runs on port 8002, separate from main SummitFlow backend.
"""

import os
import secrets
import subprocess
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .api import agent, agent_tools, files, panes, projects, sessions, terminal
from .config import CORS_ORIGINS, TERMINAL_PORT
from .logging_config import SyslogPrefixFormatter, configure_logging, get_logger
from .rate_limit import limiter
from .services import lifecycle
from .services.summitflow_client import close_client
from .services.upload_cleanup import cleanup_old_uploads
from .storage.connection import close_pool, get_connection
from .utils.tmux import run_tmux_command

# Configure structured logging (skip in test mode - tests configure their own logging)
if not os.getenv("PYTEST_CURRENT_TEST"):
    configure_logging()

    # Configure uvicorn loggers to use syslog prefixes for journald
    import logging

    uvicorn_access_logger = logging.getLogger("uvicorn.access")
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    uvicorn_logger = logging.getLogger("uvicorn")

    # Apply syslog formatter to all uvicorn handlers
    for _uvicorn_log in [uvicorn_access_logger, uvicorn_error_logger, uvicorn_logger]:
        for _handler in _uvicorn_log.handlers:
            _handler.setFormatter(
                SyslogPrefixFormatter(
                    "%(levelname)s:     %(message)s"  # Match uvicorn's format
                )
            )

logger = get_logger(__name__)


def _setup_tmux_options(token: str) -> None:
    """Set up tmux options and hooks for terminal service.

    Configures:
    - client-session-changed hook: Notify backend when sessions switch

    NOTE: We intentionally do NOT set global tmux options like detach-on-destroy
    to avoid affecting non-web-terminal sessions (e.g., MobaXterm, other clients).
    Each summitflow-* session manages its own options in create_tmux_session().

    Security: Token is written to a file (mode 0600) instead of embedded in the
    hook command, so it is not visible via `tmux show-hooks -g` or `ps`.
    """
    # Write token to a file readable only by the service user
    from pathlib import Path

    token_file = Path.home() / ".cache" / "summitflow-terminal" / "hook-token"
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(token)
    token_file.chmod(0o600)

    hook_cmd = (
        f'run-shell "curl -s -H \'Authorization: Bearer \'$(cat {token_file})'
        f" 'http://localhost:{TERMINAL_PORT}/api/internal/session-switch"
        f"?from=#{{client_last_session}}&to=#{{client_session}}' >/dev/null 2>&1 &\""
    )

    # Set global hook (applies to all sessions)
    result = subprocess.run(
        ["tmux", "set-hook", "-g", "client-session-changed", hook_cmd],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        logger.info("tmux_options_configured")
    else:
        # tmux might not be running yet - that's OK
        logger.warning("tmux_setup_failed", error=result.stderr.strip())


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler."""
    # Startup: reconcile DB with tmux state
    logger.info("terminal_service_starting", port=TERMINAL_PORT)
    try:
        stats = lifecycle.reconcile_on_startup()
        logger.info("startup_reconciliation_complete", **stats)
    except Exception as e:
        logger.error("startup_reconciliation_failed", error=str(e))

    # Clean up stale uploaded files
    try:
        deleted = cleanup_old_uploads()
        if deleted > 0:
            logger.info("startup_upload_cleanup", deleted=deleted)
    except Exception as e:
        logger.warning("startup_upload_cleanup_failed", error=str(e))

    # Set up tmux options and hooks
    app.state.internal_token = secrets.token_urlsafe(32)
    _setup_tmux_options(app.state.internal_token)

    yield

    # Shutdown
    logger.info("terminal_service_stopping")
    await close_client()
    close_pool()
    logger.info("terminal_service_shutdown_complete")


app = FastAPI(
    title="SummitFlow Terminal",
    description="Web terminal service for SummitFlow",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,  # type: ignore[arg-type]  # slowapi handler has narrower type than starlette expects
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,  # type: ignore[arg-type]
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Include routers
app.include_router(terminal.router)
app.include_router(sessions.router)
app.include_router(panes.router)
app.include_router(projects.router)
app.include_router(agent.router)
app.include_router(agent_tools.router)
app.include_router(files.router)


@app.get("/health", response_model=None)
async def health() -> dict[str, str] | JSONResponse:
    """Health check endpoint."""
    checks: dict[str, str] = {"service": "terminal"}

    # Check database
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        checks["db"] = "ok"
    except Exception as e:
        logger.error("health_check_db_failed", error=str(e))
        checks["db"] = "down"
        return JSONResponse(status_code=503, content={**checks, "status": "unhealthy"})

    # Check tmux server
    tmux_ok, _ = run_tmux_command(["list-sessions"])
    # tmux returns failure when there are no sessions, which is fine
    # We just need the server to respond (not hang or crash)
    checks["tmux"] = "ok" if tmux_ok else "no_sessions"

    checks["status"] = "healthy"
    return checks


def main() -> None:
    """Run the terminal service."""
    uvicorn.run(
        "terminal.main:app",
        host="127.0.0.1",
        port=TERMINAL_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
