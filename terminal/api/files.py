"""Terminal Files API - File upload endpoint.

Allows users to upload files via the terminal UI.
Files are stored server-side and the path is returned for use in terminal commands.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel

from ..rate_limit import limiter

from ..config import MAX_FILE_SIZE, MAX_FILE_SIZE_MB, UPLOAD_DIR
from ..logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Terminal Files"])

# Allowed MIME types for upload
ALLOWED_MIME_TYPES = {
    # Images
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    # Documents
    "text/markdown",
    "text/plain",
    "application/json",
    "application/pdf",
}

# Extension mapping for MIME types
MIME_TO_EXTENSION = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "text/markdown": ".md",
    "text/plain": ".txt",
    "application/json": ".json",
    "application/pdf": ".pdf",
}


# Magic byte signatures for allowed binary types
_MAGIC_SIGNATURES: dict[bytes, str] = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"RIFF": "image/webp",  # WebP starts with RIFF....WEBP
    b"%PDF": "application/pdf",
}

# Text-based types that don't have magic bytes — validated by content_type only
_TEXT_MIME_TYPES = {"text/markdown", "text/plain", "application/json"}


def _detect_mime_type(content: bytes, claimed_type: str) -> str | None:
    """Detect actual MIME type from file content magic bytes.

    Returns the detected MIME type if it matches an allowed type,
    or None if the content doesn't match any known signature.

    For text-based types (markdown, plain text, JSON), falls back to
    the claimed type since these have no reliable magic bytes.
    """
    # Text types have no magic bytes — trust content_type for these
    if claimed_type in _TEXT_MIME_TYPES:
        return claimed_type

    # Check binary signatures
    for signature, mime_type in _MAGIC_SIGNATURES.items():
        if content[:len(signature)] == signature:
            # Special case: WebP requires WEBP at offset 8
            if mime_type == "image/webp" and content[8:12] != b"WEBP":
                continue
            return mime_type

    return None


class FileUploadResponse(BaseModel):
    """Response for file upload."""

    path: str
    filename: str
    size: int
    mime_type: str


@router.post("/api/terminal/files", response_model=FileUploadResponse)
@limiter.limit("10/minute")
async def upload_file(request: Request, file: UploadFile) -> FileUploadResponse:
    """Upload a file for use in terminal commands.

    Files are stored in ~/terminal-uploads/ with UUID naming.
    Returns the absolute path to the uploaded file.

    Allowed types: png, jpg, gif, webp, md, txt, json, pdf
    Max size: 10MB (configurable via MAX_FILE_SIZE_MB env var)
    """
    # Read file content in chunks to enforce size limit before loading entire file
    chunks: list[bytes] = []
    total_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB",
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # Validate MIME type from client header
    claimed_type = file.content_type or "application/octet-stream"
    if claimed_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{claimed_type}' not allowed. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )

    # Validate actual content via magic bytes (prevents MIME spoofing)
    content_type = _detect_mime_type(content, claimed_type)
    if content_type is None:
        raise HTTPException(
            status_code=400,
            detail=f"File content does not match claimed type '{claimed_type}'",
        )

    # Create upload directory if needed
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Generate UUID filename with appropriate extension
    extension = MIME_TO_EXTENSION.get(content_type, "")
    filename = f"{uuid.uuid4()}{extension}"
    file_path = UPLOAD_DIR / filename

    # Write file
    file_path.write_bytes(content)

    logger.info(
        "file_uploaded",
        filename=filename,
        size=len(content),
        mime_type=content_type,
        original_name=file.filename,
    )

    return FileUploadResponse(
        path=str(file_path),
        filename=filename,
        size=len(content),
        mime_type=content_type,
    )
