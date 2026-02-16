"""Centralized configuration loading.

Uses pydantic-settings for validated configuration with environment variable support.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Loads from ~/.env.local by default.
    """

    model_config = SettingsConfigDict(
        env_file=str(Path.home() / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = ""

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure database_url is provided."""
        if not v:
            raise ValueError("DATABASE_URL environment variable is required")
        return v

    # Terminal service
    terminal_port: int = 8002

    # CORS
    cors_origins: list[str] = [
        "https://terminal.summitflow.dev",
    ]

    # Terminal dimensions
    tmux_default_cols: int = 120
    tmux_default_rows: int = 30
    tmux_min_cols: int = 1
    tmux_max_cols: int = 512
    tmux_min_rows: int = 1
    tmux_max_rows: int = 256

    # File upload configuration
    max_file_size_mb: int = 10
    upload_dir: Path = Path.home() / "terminal-uploads"

    @property
    def max_file_size(self) -> int:
        """Maximum file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Returns:
        Settings instance (cached for performance)
    """
    return Settings()


# Pre-loaded for modules that need them at import time
# These provide backward compatibility with existing code
settings = get_settings()
DATABASE_URL = settings.database_url
TERMINAL_PORT = settings.terminal_port
CORS_ORIGINS = settings.cors_origins
TMUX_DEFAULT_COLS = settings.tmux_default_cols
TMUX_DEFAULT_ROWS = settings.tmux_default_rows
TMUX_MIN_COLS = settings.tmux_min_cols
TMUX_MAX_COLS = settings.tmux_max_cols
TMUX_MIN_ROWS = settings.tmux_min_rows
TMUX_MAX_ROWS = settings.tmux_max_rows
MAX_FILE_SIZE_MB = settings.max_file_size_mb
MAX_FILE_SIZE = settings.max_file_size
UPLOAD_DIR = settings.upload_dir
