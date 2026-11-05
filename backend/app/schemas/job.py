from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class PlanNode(BaseModel):
    id: str
    tool_name: str
    description: str
    arguments: Dict[str, Any] = {}
    depends_on: List[str] = [] # Parent node IDs
    status: str = "pending" # pending, running, waiting_approval, completed, failed, skipped
    requires_approval: bool = False
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class ExecutionPlan(BaseModel):
    plan_id: str
    objective: str
    nodes: List[PlanNode]
    estimated_duration_seconds: int = 30
    is_valid_dag: bool = True

class JobCreate(BaseModel):
    title: str = Field(..., min_length=2)
    objective: str = Field(..., min_length=5)
    document_ids: List[str] = []
    mode: str = "hybrid" # local, hybrid, cloud

class JobApprovalRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None
    modified_arguments: Optional[Dict[str, Any]] = None

class JobOut(BaseModel):
    id: str
    org_id: str
    user_id: Optional[str]
    title: str
    objective: str
    status: str
    mode: str
    plan: Optional[ExecutionPlan] = None
    current_step_index: int
    total_steps: int
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

