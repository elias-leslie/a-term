#!/bin/bash
#
# Terminal backup project configuration
# Sourced by the canonical backup.sh to customize behavior
#
# Terminal uses the shared summitflow DB but only backs up
# terminal-specific tables.

# Selective table dump (only terminal-specific tables)
BACKUP_TABLES=(
    "terminal_sessions"
    "terminal_panes"
    "terminal_project_settings"
)

# Archive name for the DB dump inside the backup
BACKUP_DB_DUMP_NAME="terminal_tables.sql.gz"

# Terminal-specific exclusions
# (frontend/node_modules and frontend/.next already in base BACKUP_EXCLUDES;
#  terminal has a root-level .venv instead of backend/.venv)
BACKUP_EXTRA_EXCLUDES=(
    ".venv"
)

# No quick mode support
QUICK_MODE_ENABLED=false

# Override DB credentials - terminal uses shared summitflow DB
DB_NAME="summitflow"
DB_USER="summitflow_app"
# DB_PASSWORD is loaded from ~/.env.local by backup-utils.sh (DATABASE_URL)
if [ -f "$HOME/.env.local" ]; then
    _terminal_db_url=$(grep "^DATABASE_URL=" "$HOME/.env.local" 2>/dev/null | cut -d'=' -f2- || true)
    if [ -n "$_terminal_db_url" ]; then
        DB_PASSWORD=$(python3 -c "from urllib.parse import urlparse; print(urlparse('$_terminal_db_url').password or '')" 2>/dev/null || true)
    fi
fi
