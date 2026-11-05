from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class ToolDefinition(BaseModel):
    name: str
    description: str
    version: str = "1.0.0"
    required_role: str = "user"
    timeout_seconds: int = 60
    max_memory_mb: int = 512
    idempotent: bool = True
    requires_approval: bool = False
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]

class ToolInvocationRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    idempotency_key: Optional[str] = None
    dry_run: bool = False

class ToolInvocationResult(BaseModel):
    tool_name: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: int
    idempotency_key: Optional[str] = None
    audit_event_id: Optional[str] = None

