from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.core.rate_limit import rate_limiter
from app.models.user import User
from app.schemas.tool import ToolDefinition, ToolInvocationRequest, ToolInvocationResult
from app.services.tool_registry import tool_registry

router = APIRouter(prefix="/tools", tags=["Tool Registry"])

@router.get("", response_model=List[ToolDefinition])
async def list_registered_tools(
    current_user: User = Depends(get_current_user)
):
    return tool_registry.list_tools()

@router.get("/{tool_name}", response_model=ToolDefinition)
async def get_tool_definition(
    tool_name: str,
    current_user: User = Depends(get_current_user)
):
    tool = tool_registry.get_tool(tool_name)
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{tool_name}' not found in registry"
        )
    return tool

@router.post("/invoke", response_model=ToolInvocationResult, dependencies=[Depends(rate_limiter(max_requests=60, window_seconds=60))])
async def invoke_tool(
    request: ToolInvocationRequest,
    current_user: User = Depends(get_current_user)
):
    tool_def = tool_registry.get_tool(request.tool_name)
    if not tool_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{request.tool_name}' is not registered"
        )

    # Policy check: permissions (admin or superadmin required for admin tools)
    if tool_def.required_role == "admin" and current_user.role not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tool requires administrator privileges"
        )

    return await tool_registry.execute_tool(
        name=request.tool_name,
        arguments=request.arguments,
        org_id=current_user.org_id,
        user_id=current_user.id,
        idempotency_key=request.idempotency_key
    )

