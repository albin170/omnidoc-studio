import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.workflow import Workflow
from app.services.agent import agent_service

router = APIRouter(prefix="/workflows", tags=["Workflow Automation"])

class WorkflowCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

class WorkflowOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    is_active: bool

class ExecuteWorkflowRequest(BaseModel):
    document_ids: List[str]

@router.post("", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    req: WorkflowCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # DAG Cycle Validation
    node_ids = {n.get("id") for n in req.nodes if "id" in n}
    adj: Dict[str, List[str]] = {nid: [] for nid in node_ids}
    for e in req.edges:
        src = e.get("source")
        tgt = e.get("target")
        if src in adj and tgt:
            adj[src].append(tgt)

    visited: Dict[str, int] = {} # 0: unvisited, 1: visiting, 2: visited
    def has_cycle(u: str) -> bool:
        visited[u] = 1
        for v in adj.get(u, []):
            if visited.get(v, 0) == 1:
                return True
            if visited.get(v, 0) == 0 and has_cycle(v):
                return True
        visited[u] = 2
        return False

    for nid in node_ids:
        if visited.get(nid, 0) == 0:
            if has_cycle(nid):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow DAG validation failed: Cycle detected in automation graph."
                )

    wf = Workflow(
        org_id=current_user.org_id,
        user_id=current_user.id,
        name=req.name.strip(),
        description=req.description,
        nodes_json=json.dumps(req.nodes),
        edges_json=json.dumps(req.edges),
        is_active=True
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)

    return WorkflowOut(
        id=wf.id,
        name=wf.name,
        description=wf.description,
        nodes=req.nodes,
        edges=req.edges,
        is_active=wf.is_active
    )

@router.get("", response_model=List[WorkflowOut])
async def list_workflows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Workflow).where(Workflow.org_id == current_user.org_id).order_by(Workflow.created_at.desc())
    res = await db.execute(stmt)
    wfs = res.scalars().all()
    return [
        WorkflowOut(
            id=w.id,
            name=w.name,
            description=w.description,
            nodes=json.loads(w.nodes_json),
            edges=json.loads(w.edges_json),
            is_active=w.is_active
        )
        for w in wfs
    ]
