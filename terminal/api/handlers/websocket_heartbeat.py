"""WebSocket heartbeat management."""

from __future__ import annotations

import asyncio

from fastapi import WebSocket


async def heartbeat_loop(websocket: WebSocket) -> None:
    """Send periodic heartbeat to keep connection alive.

    Sends empty binary messages every 30 seconds to prevent
    proxies/firewalls from closing idle connections.

    Args:
        websocket: WebSocket connection to keep alive
    """
    while True:
        await asyncio.sleep(30)
        try:
            await websocket.send_bytes(b"\x00")
        except Exception:
            break
