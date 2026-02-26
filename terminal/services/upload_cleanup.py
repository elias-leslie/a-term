"""Cleanup service for uploaded files.

Removes files from the upload directory that are older than a configured TTL.
Called during application startup to prevent unbounded disk usage.
"""

from __future__ import annotations

import time
from pathlib import Path

from ..config import UPLOAD_DIR
from ..logging_config import get_logger

logger = get_logger(__name__)

# Default: 24 hours
DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60


def cleanup_old_uploads(
    upload_dir: Path = UPLOAD_DIR,
    max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
) -> int:
    """Delete uploaded files older than max_age_seconds.

    Args:
        upload_dir: Directory containing uploaded files
        max_age_seconds: Maximum file age in seconds (default: 24 hours)

    Returns:
        Number of files deleted
    """
    if not upload_dir.exists():
        return 0

    cutoff = time.time() - max_age_seconds
    deleted = 0

    for file_path in upload_dir.iterdir():
        if not file_path.is_file():
            continue
        try:
            if file_path.stat().st_mtime < cutoff:
                file_path.unlink()
                deleted += 1
        except OSError as e:
            logger.warning("upload_cleanup_error", file=str(file_path), error=str(e))

    if deleted > 0:
        logger.info("upload_cleanup_complete", deleted=deleted, max_age_hours=max_age_seconds // 3600)

    return deleted
