"""Terminal Panes API - REST endpoints for pane management.

This module provides:
- List terminal panes with their sessions
- Create new pane (atomically creates sessions)
- Update pane metadata (name, order, active_mode)
- Delete pane (cascades to sessions)
- Swap pane positions

Panes are containers for 1-2 sessions:
- Project panes: shell + claude sessions (toggled via active_mode)
- Ad-hoc panes: shell session only
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..rate_limit import limiter
from ..services.lifecycle_core import _kill_tmux_session, create_session, delete_session
from ..services.pane_service import (
    convert_layout_items_to_storage,
    get_layout_update_fields,
    get_update_fields,
    update_layouts_with_retry,
)
from ..storage import agent_tools as agent_tools_store
from ..storage import pane_crud
from ..storage.pane_sessions import fetch_sessions_for_pane
from .models.panes import (
    BulkLayoutUpdateRequest,
    CreatePaneRequest,
    PaneListResponse,
    PaneResponse,
    SwapPanesRequest,
    SwitchAgentToolRequest,
    UpdatePaneLayoutRequest,
    UpdatePaneOrderRequest,
    UpdatePaneRequest,
)
from .pane_responses import build_pane_response
from .validators import (
    require_pane_exists,
    validate_active_mode,
    validate_create_pane_request,
    validate_pane_limit,
    validate_uuid,
)

router = APIRouter(tags=["Terminal Panes"])

MAX_PANES = 4


@router.get("/api/terminal/panes", response_model=PaneListResponse)
async def list_panes() -> PaneListResponse:
    """List all terminal panes with their sessions."""
    panes = pane_crud.list_panes_with_sessions()
    return PaneListResponse(
        items=[build_pane_response(p) for p in panes],
        total=len(panes),
        max_panes=MAX_PANES,
    )


@router.get("/api/terminal/panes/count")
async def get_pane_count() -> dict[str, Any]:
    """Get current pane count and max limit."""
    count = pane_crud.count_panes()
    return {
        "count": count,
        "max_panes": MAX_PANES,
        "at_limit": count >= MAX_PANES,
    }


@router.post("/api/terminal/panes", response_model=PaneResponse)
@limiter.limit("20/minute")
async def create_pane(request: Request, body: CreatePaneRequest) -> PaneResponse:
    """Create a new terminal pane with sessions.

    For project panes: creates shell + claude sessions.
    For adhoc panes: creates shell session only.
    """
    validate_pane_limit(pane_crud.count_panes(), MAX_PANES)
    validate_create_pane_request(body.pane_type, body.project_id)

    try:
        pane = pane_crud.create_pane_with_sessions(
            pane_type=body.pane_type,
            pane_name=body.pane_name,
            project_id=body.project_id,
            working_dir=body.working_dir,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    return build_pane_response(pane)


@router.get("/api/terminal/panes/{pane_id}", response_model=PaneResponse)
async def get_pane(pane_id: str) -> PaneResponse:
    """Get a single terminal pane with its sessions."""
    validate_uuid(pane_id)

    pane = require_pane_exists(pane_crud.get_pane_with_sessions(pane_id), pane_id)
    return build_pane_response(pane)


@router.patch("/api/terminal/panes/{pane_id}", response_model=PaneResponse)
async def update_pane(pane_id: str, request: UpdatePaneRequest) -> PaneResponse:
    """Update terminal pane metadata (pane_name, active_mode)."""
    validate_uuid(pane_id)

    existing = require_pane_exists(pane_crud.get_pane(pane_id), pane_id)

    if request.active_mode is not None:
        validate_active_mode(existing["pane_type"], request.active_mode)

    update_fields = get_update_fields(request.pane_name, request.active_mode)
    if not update_fields:
        pane = pane_crud.get_pane_with_sessions(pane_id)
        return build_pane_response(pane or existing)

    pane = pane_crud.update_pane(pane_id, **update_fields)
    if not pane:
        raise HTTPException(status_code=500, detail="Failed to update pane") from None

    pane_with_sessions = pane_crud.get_pane_with_sessions(pane_id)
    return build_pane_response(pane_with_sessions or pane)


@router.delete("/api/terminal/panes/{pane_id}")
async def delete_pane(pane_id: str) -> dict[str, Any]:
    """Delete a terminal pane and all its sessions.

    Kills tmux sessions first to prevent orphaned processes,
    then deletes DB records (pane + sessions).
    """
    validate_uuid(pane_id)

    # Kill tmux sessions before deleting DB records to prevent orphans
    sessions = fetch_sessions_for_pane(pane_id)
    for session in sessions:
        _kill_tmux_session(session["id"], ignore_missing=True)

    deleted = pane_crud.delete_pane(pane_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Pane {pane_id} not found") from None
    return {"deleted": True, "id": pane_id}


@router.post("/api/terminal/panes/swap")
async def swap_panes(request: SwapPanesRequest) -> dict[str, Any]:
    """Swap positions of two panes."""
    success = pane_crud.swap_pane_positions(request.pane_id_a, request.pane_id_b)
    if not success:
        raise HTTPException(status_code=404, detail="One or both panes not found") from None
    return {
        "swapped": True,
        "pane_id_a": request.pane_id_a,
        "pane_id_b": request.pane_id_b,
    }


@router.put("/api/terminal/panes/order")
async def update_pane_order(request: UpdatePaneOrderRequest) -> dict[str, Any]:
    """Batch update pane ordering."""
    pane_crud.update_pane_order(request.pane_orders)
    return {"updated": True, "count": len(request.pane_orders)}


@router.patch("/api/terminal/panes/{pane_id}/layout", response_model=PaneResponse)
async def update_pane_layout(pane_id: str, request: UpdatePaneLayoutRequest) -> PaneResponse:
    """Update a single pane's layout (position and size)."""
    validate_uuid(pane_id)

    existing = require_pane_exists(pane_crud.get_pane(pane_id), pane_id)

    update_fields = get_layout_update_fields(
        request.width_percent,
        request.height_percent,
        request.grid_row,
        request.grid_col,
    )
    if not update_fields:
        pane = pane_crud.get_pane_with_sessions(pane_id)
        return build_pane_response(pane or existing)

    pane = pane_crud.update_pane(pane_id, **update_fields)
    if not pane:
        raise HTTPException(status_code=500, detail="Failed to update pane layout") from None

    pane_with_sessions = pane_crud.get_pane_with_sessions(pane_id)
    return build_pane_response(pane_with_sessions or pane)


@router.put("/api/terminal/layout", response_model=list[PaneResponse])
async def update_all_pane_layouts(
    request: BulkLayoutUpdateRequest,
) -> list[PaneResponse]:
    """Bulk update layout for all panes at once."""
    if not request.layouts:
        return []

    layouts_data = convert_layout_items_to_storage([item.model_dump() for item in request.layouts])

    try:
        await update_layouts_with_retry(layouts_data)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from None

    all_panes = pane_crud.list_panes_with_sessions()
    return [build_pane_response(p) for p in all_panes]


@router.put("/api/terminal/panes/{pane_id}/agent-tool", response_model=PaneResponse)
async def switch_agent_tool(pane_id: str, body: SwitchAgentToolRequest) -> PaneResponse:
    """Switch the agent tool on a pane.

    Finds the agent session on the pane, kills its tmux session,
    updates the session mode, recreates tmux, and returns the updated pane.
    """
    validate_uuid(pane_id)

    pane = require_pane_exists(pane_crud.get_pane_with_sessions(pane_id), pane_id)
    if pane["pane_type"] != "project":
        raise HTTPException(status_code=400, detail="Only project panes support agent tools") from None

    # Validate the target agent tool exists and is enabled
    tool = agent_tools_store.get_by_slug(body.agent_tool_slug)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Agent tool '{body.agent_tool_slug}' not found") from None
    if not tool["enabled"]:
        raise HTTPException(status_code=400, detail=f"Agent tool '{tool['name']}' is disabled") from None

    # Find the current agent session (non-shell session)
    agent_session = next(
        (s for s in pane.get("sessions", []) if s.get("mode") != "shell"),
        None,
    )

    if agent_session:
        # Kill old tmux session and delete old agent session
        _kill_tmux_session(agent_session["id"], ignore_missing=True)
        delete_session(agent_session["id"])

    # Create new agent session with the new tool's slug as mode
    working_dir = pane.get("sessions", [{}])[0].get("working_dir")
    project_id = pane.get("project_id")
    session_name = f"Project: {project_id}" if project_id else pane.get("pane_name", "Terminal")
    create_session(
        name=session_name,
        project_id=project_id,
        working_dir=working_dir,
        mode=body.agent_tool_slug,
        pane_id=pane_id,
    )

    # Update pane's active_mode
    pane_crud.update_pane(pane_id, active_mode=body.agent_tool_slug)

    pane_with_sessions = pane_crud.get_pane_with_sessions(pane_id)
    return build_pane_response(pane_with_sessions or pane)
