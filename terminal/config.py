"""Terminal service configuration."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment from ~/.env.local
env_file = Path.home() / ".env.local"
if env_file.exists():
    load_dotenv(env_file)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Terminal service port
TERMINAL_PORT = int(os.getenv("TERMINAL_PORT", "8002"))

# CORS origins - environment-dependent for security
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://terminal.summitflow.dev"
).split(",")

# Terminal dimensions
TMUX_DEFAULT_COLS = 120
TMUX_DEFAULT_ROWS = 30
TMUX_MIN_COLS = 1
TMUX_MAX_COLS = 512
TMUX_MIN_ROWS = 1
TMUX_MAX_ROWS = 256

# File upload configuration
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(Path.home() / "terminal-uploads")))
