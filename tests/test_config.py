"""Tests for terminal configuration loading.

Verifies that environment variables are correctly parsed into
configuration constants.
"""

from __future__ import annotations

import importlib
from unittest.mock import patch

import pytest


def test_config_database_url_required_raises_on_missing() -> None:
    """Config module -- missing DATABASE_URL raises ValueError."""
    # Arrange & Act & Assert
    with patch.dict("os.environ", {"DATABASE_URL": ""}, clear=False):
        with pytest.raises(ValueError, match="DATABASE_URL"):
            import terminal.config as cfg
            importlib.reload(cfg)


def test_config_terminal_port_default_is_8002() -> None:
    """Config module -- TERMINAL_PORT defaults to 8002."""
    # Arrange & Act
    with patch.dict(
        "os.environ",
        {"DATABASE_URL": "postgresql://test:test@localhost/test"},
        clear=False,
    ):
        import terminal.config as cfg
        importlib.reload(cfg)

    # Assert
    assert cfg.TERMINAL_PORT == 8002


def test_config_terminal_port_custom_from_env() -> None:
    """Config module -- TERMINAL_PORT reads from environment."""
    # Arrange & Act
    with patch.dict(
        "os.environ",
        {
            "DATABASE_URL": "postgresql://test:test@localhost/test",
            "TERMINAL_PORT": "9999",
        },
        clear=False,
    ):
        import terminal.config as cfg
        importlib.reload(cfg)

    # Assert
    assert cfg.TERMINAL_PORT == 9999


def test_config_tmux_dimension_constants() -> None:
    """Config module -- tmux dimension constants are present and valid."""
    # Arrange & Act
    with patch.dict(
        "os.environ",
        {"DATABASE_URL": "postgresql://test:test@localhost/test"},
        clear=False,
    ):
        import terminal.config as cfg
        importlib.reload(cfg)

    # Assert
    assert cfg.TMUX_DEFAULT_COLS == 120
    assert cfg.TMUX_DEFAULT_ROWS == 30
    assert cfg.TMUX_MIN_COLS >= 1
    assert cfg.TMUX_MAX_COLS <= 1024
    assert cfg.TMUX_MIN_ROWS >= 1
    assert cfg.TMUX_MAX_ROWS <= 512


def test_config_cors_origins_splits_comma_separated() -> None:
    """Config module -- CORS_ORIGINS splits comma-separated values."""
    # Arrange & Act
    with patch.dict(
        "os.environ",
        {
            "DATABASE_URL": "postgresql://test:test@localhost/test",
            "CORS_ORIGINS": "http://localhost:3000,http://localhost:3002",
        },
        clear=False,
    ):
        import terminal.config as cfg
        importlib.reload(cfg)

    # Assert
    assert isinstance(cfg.CORS_ORIGINS, list)
    assert len(cfg.CORS_ORIGINS) == 2
    assert "http://localhost:3000" in cfg.CORS_ORIGINS
    assert "http://localhost:3002" in cfg.CORS_ORIGINS
