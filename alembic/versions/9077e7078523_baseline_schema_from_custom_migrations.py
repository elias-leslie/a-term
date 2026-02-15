"""baseline schema from custom migrations

Defines the full terminal schema as of the initial Alembic adoption.
Uses IF NOT EXISTS / IF EXISTS guards so it is safe to run against
databases where the tables were already created manually.

Tables:
  - terminal_sessions
  - terminal_project_settings
  - terminal_panes

Revision ID: 9077e7078523
Revises:
Create Date: 2026-02-08 11:59:24.138872

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9077e7078523"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all terminal tables, indexes, and constraints."""

    # ------------------------------------------------------------------
    # 1. terminal_sessions
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS terminal_sessions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name            VARCHAR(255) NOT NULL,
            user_id         VARCHAR(255),
            project_id      VARCHAR(64),
            working_dir     TEXT,
            display_order   INTEGER DEFAULT 0,
            mode            VARCHAR(16) DEFAULT 'shell'
                            CHECK (mode IN ('shell', 'claude')),
            session_number  INTEGER DEFAULT 1,
            is_alive        BOOLEAN DEFAULT true,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
            last_claude_session VARCHAR(255),
            claude_state    VARCHAR(16) DEFAULT 'not_started'
                            CHECK (claude_state IN (
                                'not_started', 'starting', 'running',
                                'stopped', 'error'
                            ))
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_terminal_sessions_alive
            ON terminal_sessions(is_alive) WHERE is_alive = true;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_terminal_sessions_project
            ON terminal_sessions(project_id) WHERE project_id IS NOT NULL;
    """)

    # ------------------------------------------------------------------
    # 2. terminal_project_settings
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS terminal_project_settings (
            project_id   VARCHAR(64) PRIMARY KEY,
            enabled      BOOLEAN NOT NULL DEFAULT false,
            active_mode  VARCHAR(16) NOT NULL DEFAULT 'shell'
                         CHECK (active_mode IN ('shell', 'claude')),
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ DEFAULT NOW(),
            updated_at   TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tps_enabled
            ON terminal_project_settings(enabled) WHERE enabled = true;
    """)

    op.execute("""
        COMMENT ON TABLE terminal_project_settings
            IS 'Terminal settings per SummitFlow project';
    """)

    # ------------------------------------------------------------------
    # 3. terminal_panes
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS terminal_panes (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pane_type    VARCHAR(10) NOT NULL
                         CHECK (pane_type IN ('project', 'adhoc')),
            project_id   VARCHAR(64),
            pane_order   INTEGER NOT NULL DEFAULT 0,
            pane_name    VARCHAR(255) NOT NULL,
            active_mode  VARCHAR(16) NOT NULL DEFAULT 'shell'
                         CHECK (active_mode IN ('shell', 'claude')),
            created_at   TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT chk_project_pane_id CHECK (
                (pane_type = 'adhoc'   AND project_id IS NULL) OR
                (pane_type = 'project' AND project_id IS NOT NULL)
            )
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_terminal_panes_project_id
            ON terminal_panes(project_id) WHERE project_id IS NOT NULL;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_terminal_panes_order
            ON terminal_panes(pane_order);
    """)

    op.execute("""
        COMMENT ON TABLE terminal_panes
            IS 'Terminal panes - containers for 1-2 sessions (shell/claude)';
    """)


def downgrade() -> None:
    """Drop all terminal tables in reverse dependency order."""

    # Drop indexes explicitly first (they go away with the tables, but
    # being explicit makes partial rollback clearer).

    # terminal_panes
    op.execute("DROP INDEX IF EXISTS idx_terminal_panes_order;")
    op.execute("DROP INDEX IF EXISTS idx_terminal_panes_project_id;")
    op.execute("DROP TABLE IF EXISTS terminal_panes;")

    # terminal_project_settings
    op.execute("DROP INDEX IF EXISTS idx_tps_enabled;")
    op.execute("DROP TABLE IF EXISTS terminal_project_settings;")

    # terminal_sessions
    op.execute("DROP INDEX IF EXISTS idx_terminal_sessions_project;")
    op.execute("DROP INDEX IF EXISTS idx_terminal_sessions_alive;")
    op.execute("DROP TABLE IF EXISTS terminal_sessions;")
