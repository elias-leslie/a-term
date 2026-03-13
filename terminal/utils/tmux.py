"""tmux session management utilities.

Provides core tmux operations: session naming, existence checks, creation,
listing, scrollback capture, and window resizing.
"""

from __future__ import annotations

import os
import re
import subprocess
import uuid as _uuid_mod
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

from ..config import TMUX_DEFAULT_COLS, TMUX_DEFAULT_ROWS
from ..logging_config import get_logger

logger = get_logger(__name__)

TMUX_COMMAND_TIMEOUT = 10  # seconds for tmux subprocess calls
_SESSION_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")
_EXTERNAL_AGENT_TOKENS = ("claude", "codex", "opencode", "aider", "gemini")

# Secrets filtered from tmux session environments
FILTERED_ENV_VARS = {
    "DATABASE_URL",
    "CF_ACCESS_CLIENT_ID",
    "CF_ACCESS_CLIENT_SECRET",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "SECRET_KEY",
    "JWT_SECRET",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "GITHUB_TOKEN",
    "GITLAB_TOKEN",
    "SLACK_TOKEN",
    "DISCORD_TOKEN",
}


@dataclass
class _ExternalAttachState:
    refcount: int
    status: str
    mouse: str


_EXTERNAL_ATTACH_LOCK = Lock()
_EXTERNAL_ATTACH_STATES: dict[str, _ExternalAttachState] = {}


class TmuxError(Exception):
    """Error interacting with tmux."""


def validate_session_name(name: str) -> bool:
    """Validate tmux session name to prevent injection attacks."""
    return bool(_SESSION_NAME_PATTERN.match(name)) and len(name) < 256


def run_tmux_command(args: list[str], check: bool = False) -> tuple[bool, str]:
    """Run a tmux command with standardized error handling.

    Returns: (success, output_or_error)
    Raises: TmuxError if check=True and command fails
    """
    cmd = ["tmux", *args]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=TMUX_COMMAND_TIMEOUT)
        if result.returncode == 0:
            return True, result.stdout.strip()

        error_msg = result.stderr.strip() or f"tmux exited with code {result.returncode}"
        logger.debug("tmux_command_failed", cmd=args, error=error_msg)
        if check:
            raise TmuxError(error_msg)
        return False, error_msg
    except subprocess.TimeoutExpired as err:
        error_msg = f"tmux command timed out after {TMUX_COMMAND_TIMEOUT}s"
        logger.error("tmux_command_timeout", cmd=args)
        if check:
            raise TmuxError(error_msg) from err
        return False, error_msg


TMUX_SESSION_PREFIX = "summitflow-"


def get_tmux_session_name(session_id: str) -> str:
    """Convert session ID to tmux session name."""
    return f"{TMUX_SESSION_PREFIX}{session_id}"


def is_managed_tmux_session_name(session_name: str) -> bool:
    """Return True when the tmux session belongs to Terminal-managed UUID sessions."""
    return session_name.startswith(TMUX_SESSION_PREFIX) and _is_valid_uuid(session_name[len(TMUX_SESSION_PREFIX):])


def tmux_session_exists_by_name(session_name: str) -> bool:
    """Check if a tmux session exists by its direct name."""
    success, _ = run_tmux_command(["has-session", "-t", session_name])
    return success


def tmux_session_exists(session_id: str) -> bool:
    """Check if a tmux session exists."""
    return tmux_session_exists_by_name(get_tmux_session_name(session_id))


def _apply_session_options(session_name: str, disable_mouse: bool = True) -> None:
    """Apply session options: mouse off, status off, filter secret env vars.

    Batches all options into a single tmux command using ';' chaining
    to avoid 14+ separate subprocess.run() calls.
    """
    args: list[str] = []
    if disable_mouse:
        args.extend(["set-option", "-t", session_name, "mouse", "off", ";"])
    args.extend(["set-option", "-t", session_name, "status", "off", ";"])
    args.extend(["set-option", "-t", session_name, "history-limit", "50000"])
    for var in FILTERED_ENV_VARS:
        args.extend([";", "set-environment", "-t", session_name, "-u", var])
    run_tmux_command(args)
    logger.debug("session_configured", session=session_name, filtered_vars=len(FILTERED_ENV_VARS))


def create_tmux_session(
    session_id: str,
    working_dir: str | None = None,
    disable_mouse: bool = True,
) -> str:
    """Create or reconfigure a tmux session.

    Returns: tmux session name
    Raises: TmuxError if session creation fails
    """
    session_name = get_tmux_session_name(session_id)

    # If session exists, reconfigure and return
    if tmux_session_exists(session_id):
        logger.info("tmux_session_exists", session=session_name)
        _apply_session_options(session_name, disable_mouse)
        return session_name

    # Create new session
    effective_working_dir = working_dir or os.path.expanduser("~")
    args = [
        "new-session",
        "-d",
        "-s",
        session_name,
        "-x",
        str(TMUX_DEFAULT_COLS),
        "-y",
        str(TMUX_DEFAULT_ROWS),
        "-c",
        effective_working_dir,
    ]

    success, output = run_tmux_command(args)
    if not success:
        logger.error("tmux_create_failed", session=session_name, error=output)
        raise TmuxError(f"Failed to create tmux session: {output}")

    _apply_session_options(session_name, disable_mouse)
    logger.info("tmux_session_created", session=session_name, working_dir=effective_working_dir)
    return session_name


def _is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID."""
    try:
        _uuid_mod.UUID(value)
        return True
    except ValueError:
        return False


def _infer_external_mode(session_name: str, current_command: str) -> tuple[str, str]:
    label = f"{session_name} {current_command}".lower()
    for token in _EXTERNAL_AGENT_TOKENS:
        if token in label:
            return token, "running"
    return "shell", "not_started"


def _infer_project_id(working_dir: str | None) -> str | None:
    if not working_dir:
        return None
    try:
        root = subprocess.run(
            ["git", "-C", working_dir, "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=TMUX_COMMAND_TIMEOUT,
            check=False,
        ).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return None
    if not root:
        return None
    return Path(root).name


def list_external_agent_tmux_sessions() -> list[dict[str, object]]:
    """List externally created tmux agent sessions that Terminal can attach to."""
    success, output = run_tmux_command(
        [
            "list-panes",
            "-a",
            "-F",
            "#{session_name}\t#{pane_id}\t#{pane_current_path}\t#{pane_current_command}",
        ]
    )
    if not success:
        return []

    sessions: dict[str, dict[str, object]] = {}
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) != 4:
            continue
        session_name, pane_id, working_dir, current_command = parts
        if not session_name or is_managed_tmux_session_name(session_name):
            continue
        mode, claude_state = _infer_external_mode(session_name, current_command)
        if mode == "shell":
            continue
        existing = sessions.get(session_name)
        if existing and existing.get("working_dir"):
            continue
        sessions[session_name] = {
            "id": session_name,
            "name": session_name,
            "user_id": None,
            "project_id": _infer_project_id(working_dir or None),
            "working_dir": working_dir or None,
            "display_order": 0,
            "mode": mode,
            "session_number": 0,
            "is_alive": True,
            "created_at": None,
            "last_accessed_at": None,
            "claude_state": claude_state,
            "tmux_session_name": session_name,
            "tmux_pane_id": pane_id or None,
            "is_external": True,
            "source": "tmux_external",
        }
    return sorted(sessions.values(), key=lambda row: str(row.get("name") or ""))


def get_external_agent_tmux_session(session_ref: str) -> dict[str, object] | None:
    """Return one external tmux agent session by its synthetic id or tmux session name."""
    for session in list_external_agent_tmux_sessions():
        if session.get("id") == session_ref or session.get("tmux_session_name") == session_ref:
            return session
    return None


def list_tmux_sessions() -> set[str]:
    """List all summitflow tmux sessions (returns session IDs without prefix).

    Only includes sessions whose extracted ID is a valid UUID,
    preventing non-terminal sessions from polluting reconciliation.
    """
    success, output = run_tmux_command(["list-sessions", "-F", "#{session_name}"])

    if not success:
        return set()

    result: set[str] = set()
    for line in output.split("\n"):
        if not line.startswith(TMUX_SESSION_PREFIX):
            continue
        session_id = line[len(TMUX_SESSION_PREFIX):]
        if _is_valid_uuid(session_id):
            result.add(session_id)
        else:
            logger.debug("skipping_non_uuid_tmux_session", session_name=line)
    return result


def get_scrollback(session_name: str, max_lines: int = 5000) -> str | None:
    """Capture recent tmux scrollback with color attributes and joined wrapped lines.

    The -e flag adds only SGR (color/attribute) escape sequences — no cursor
    positioning, scroll regions, or mode changes — so it's safe for xterm.js.

    Args:
        session_name: tmux session to capture from
        max_lines: Max lines of history to capture. Limits reconnect payload size
            while providing enough context for meaningful scroll-back on reconnect.
    """
    success, output = run_tmux_command(
        ["capture-pane", "-t", session_name, "-S", f"-{max_lines}", "-e", "-J", "-p"]
    )

    if not success:
        logger.warning("tmux_scrollback_capture_failed", session=session_name)
        return None

    return output


def resize_tmux_window(session_name: str, cols: int, rows: int) -> bool:
    """Resize tmux window to match frontend dimensions."""
    success, _ = run_tmux_command(
        ["resize-window", "-t", session_name, "-x", str(cols), "-y", str(rows)]
    )

    if success:
        logger.debug("tmux_window_resized", session=session_name, cols=cols, rows=rows)
    else:
        logger.warning("tmux_window_resize_failed", session=session_name, cols=cols, rows=rows)
    return success


def reset_tmux_window_size_policy(session_name: str) -> bool:
    """Return a tmux window to client-driven sizing.

    External shared sessions should not remain pinned to a manual geometry after
    Terminal disconnects. `window-size latest` lets the active tmux client
    reclaim its own size instead of preserving a stale manual resize.
    """
    success, _ = run_tmux_command(
        ["set-window-option", "-t", session_name, "window-size", "latest"]
    )
    if success:
        logger.debug("tmux_window_size_policy_reset", session=session_name, policy="latest")
    else:
        logger.warning("tmux_window_size_policy_reset_failed", session=session_name)
    return success


def _normalize_tmux_toggle(value: str) -> str | None:
    normalized = value.strip().lower()
    if normalized in {"on", "1", "yes"}:
        return "on"
    if normalized in {"off", "0", "no"}:
        return "off"
    return None


def get_tmux_session_option(session_name: str, option: str) -> str | None:
    """Return the effective session option value normalized to on/off."""
    commands = (
        ["show-options", "-qv", "-t", session_name, option],
        ["show-options", "-gqv", option],
    )
    for args in commands:
        success, output = run_tmux_command(args)
        if not success or not output.strip():
            continue
        normalized = _normalize_tmux_toggle(output)
        if normalized:
            return normalized

    logger.warning("tmux_option_read_failed", session=session_name, option=option)
    return None


def set_tmux_session_option(session_name: str, option: str, value: str) -> bool:
    """Set a tmux session option to a normalized on/off value."""
    success, _ = run_tmux_command(["set-option", "-t", session_name, option, value])
    if success:
        logger.debug("tmux_option_set", session=session_name, option=option, value=value)
    else:
        logger.warning("tmux_option_set_failed", session=session_name, option=option, value=value)
    return success


def apply_external_attach_options(session_name: str) -> bool:
    """Normalize external tmux UI while Terminal is attached."""
    with _EXTERNAL_ATTACH_LOCK:
        existing = _EXTERNAL_ATTACH_STATES.get(session_name)
        if existing:
            existing.refcount += 1
            logger.debug(
                "tmux_external_attach_reused",
                session=session_name,
                refcount=existing.refcount,
            )
            return True

        status = get_tmux_session_option(session_name, "status")
        mouse = get_tmux_session_option(session_name, "mouse")
        if status is None or mouse is None:
            return False

        changed_options: list[tuple[str, str]] = []
        for option, original_value in (("status", status), ("mouse", mouse)):
            if original_value == "off":
                continue
            if not set_tmux_session_option(session_name, option, "off"):
                for changed_option, restore_value in reversed(changed_options):
                    set_tmux_session_option(session_name, changed_option, restore_value)
                return False
            changed_options.append((option, original_value))

        _EXTERNAL_ATTACH_STATES[session_name] = _ExternalAttachState(
            refcount=1,
            status=status,
            mouse=mouse,
        )
        logger.debug(
            "tmux_external_attach_applied",
            session=session_name,
            status=status,
            mouse=mouse,
        )
        return True


def restore_external_attach_options(session_name: str) -> bool:
    """Restore external tmux UI after the last Terminal attachment ends."""
    with _EXTERNAL_ATTACH_LOCK:
        existing = _EXTERNAL_ATTACH_STATES.get(session_name)
        if not existing:
            return True

        if existing.refcount > 1:
            existing.refcount -= 1
            logger.debug(
                "tmux_external_attach_released",
                session=session_name,
                refcount=existing.refcount,
            )
            return True

        success = True
        for option, original_value in (("mouse", existing.mouse), ("status", existing.status)):
            if original_value == "off":
                continue
            success = set_tmux_session_option(session_name, option, original_value) and success

        _EXTERNAL_ATTACH_STATES.pop(session_name, None)
        if success:
            logger.debug("tmux_external_attach_restored", session=session_name)
        else:
            logger.warning("tmux_external_attach_restore_failed", session=session_name)
        return success
