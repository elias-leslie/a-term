"""baseline schema from custom migrations

This is an intentionally empty baseline migration marker.
The database schema was created manually before Alembic was introduced.
This migration serves as the starting point for future schema changes.

Revision ID: 9077e7078523
Revises:
Create Date: 2026-02-08 11:59:24.138872

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9077e7078523'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
