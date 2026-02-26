"""HTTP client for SummitFlow API.

This module provides async functions to fetch data from the SummitFlow
backend API, primarily for listing projects to populate terminal settings.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from ..logging_config import get_logger

logger = get_logger(__name__)

# SummitFlow API base URL - can be overridden via environment
SUMMITFLOW_API_BASE = os.getenv("SUMMITFLOW_API_BASE", "http://localhost:8001/api")

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    """Return the module-level AsyncClient, creating it on first call."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10.0)
    return _client


async def close_client() -> None:
    """Close and discard the module-level AsyncClient. Call on shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def list_projects() -> list[dict[str, Any]]:
    """Fetch all projects from SummitFlow API.

    Returns:
        List of project dicts with at least: id, name, root_path
        Returns empty list on connection errors (fails gracefully)
    """
    url = f"{SUMMITFLOW_API_BASE}/projects"
    try:
        client = _get_client()
        response = await client.get(url)
        response.raise_for_status()
        result: list[dict[str, Any]] = response.json()
        return result
    except httpx.ConnectError:
        logger.warning("summitflow_api_connect_error", url=url)
        return []
    except httpx.TimeoutException:
        logger.warning("summitflow_api_timeout", url=url)
        return []
    except httpx.HTTPStatusError as e:
        logger.error("summitflow_api_http_error", status_code=e.response.status_code)
        return []
    except Exception as e:
        logger.error("summitflow_api_unexpected_error", error=str(e))
        return []
