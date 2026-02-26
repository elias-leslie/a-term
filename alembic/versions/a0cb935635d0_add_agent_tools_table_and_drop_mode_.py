"""add agent_tools table and drop mode check constraints

Creates the agent_tools table for CRUD-able CLI agent tools, seeds Claude Code
as the default tool, and drops the CHECK constraints on mode columns so they
can accept any agent tool slug (not just 'shell'|'claude').

Revision ID: a0cb935635d0
Revises: a1b2c3d4e5f6
Create Date: 2026-02-26 09:27:16.560843

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a0cb935635d0"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create agent_tools table, seed Claude Code, drop mode CHECK constraints."""

    # 1. Create agent_tools table
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_tools (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name            VARCHAR(100) NOT NULL,
            slug            VARCHAR(50) NOT NULL UNIQUE,
            command         TEXT NOT NULL,
            process_name    VARCHAR(100) NOT NULL,
            description     TEXT,
            color           VARCHAR(20),
            display_order   INTEGER NOT NULL DEFAULT 0,
            is_default      BOOLEAN NOT NULL DEFAULT false,
            enabled         BOOLEAN NOT NULL DEFAULT true,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    # 2. Indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_tools_slug
        ON agent_tools(slug);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_tools_enabled
        ON agent_tools(enabled) WHERE enabled = true;
    """)

    # 3. Seed common agent tools (Claude Code as default)
    op.execute("""
        INSERT INTO agent_tools (name, slug, command, process_name, description, is_default, display_order, color)
        VALUES
            ('Claude Code', 'claude', 'claude --dangerously-skip-permissions', 'claude', 'Anthropic Claude coding agent', true, 0, '#00FF9F'),
            ('OpenCode', 'opencode', 'opencode', 'opencode', 'AI coding assistant with TUI', false, 1, '#7C3AED'),
            ('Gemini CLI', 'gemini', 'gemini', 'gemini', 'Google Gemini coding agent', false, 2, '#4285F4'),
            ('Codex', 'codex', 'codex', 'codex', 'OpenAI Codex coding agent', false, 3, '#10A37F')
        ON CONFLICT (slug) DO NOTHING;
    """)

    # 4. Drop CHECK constraints on mode columns so they accept any slug
    # terminal_sessions.mode
    op.execute("""
        ALTER TABLE terminal_sessions DROP CONSTRAINT IF EXISTS terminal_sessions_mode_check;
    """)
    # terminal_panes.active_mode
    op.execute("""
        ALTER TABLE terminal_panes DROP CONSTRAINT IF EXISTS terminal_panes_active_mode_check;
    """)
    # terminal_project_settings.active_mode
    op.execute("""
        ALTER TABLE terminal_project_settings DROP CONSTRAINT IF EXISTS terminal_project_settings_active_mode_check;
    """)


def downgrade() -> None:
    """Restore CHECK constraints, drop agent_tools table."""

    # Restore CHECK constraints (only valid if all data is 'shell' or 'claude')
    op.execute("""
        ALTER TABLE terminal_sessions
        ADD CONSTRAINT terminal_sessions_mode_check
        CHECK (mode IN ('shell', 'claude'));
    """)
    op.execute("""
        ALTER TABLE terminal_panes
        ADD CONSTRAINT terminal_panes_active_mode_check
        CHECK (active_mode IN ('shell', 'claude'));
    """)
    op.execute("""
        ALTER TABLE terminal_project_settings
        ADD CONSTRAINT terminal_project_settings_active_mode_check
        CHECK (active_mode IN ('shell', 'claude'));
    """)

    # Drop agent_tools
    op.execute("DROP INDEX IF EXISTS idx_agent_tools_enabled;")
    op.execute("DROP INDEX IF EXISTS idx_agent_tools_slug;")
    op.execute("DROP TABLE IF EXISTS agent_tools;")
