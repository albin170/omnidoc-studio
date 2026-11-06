import time
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.workflow import WorkflowCheckpointModel, IdempotencyRecordModel
from app.schemas.job import ExecutionPlan, PlanNode
from app.services.tool_registry import tool_registry

def utcnow():
    return datetime.now(timezone.utc)

class WorkflowCheckpoint(BaseModel):
    job_id: str
    plan_id: str
    step_id: str
    status: str # started, completed, failed, paused
    attempt: int = 1
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=utcnow)

class DurableWorkflowEngine:
    def __init__(self, max_retries: int = 3, initial_backoff_sec: float = 0.5):
        self.max_retries = max_retries
        self.initial_backoff_sec = initial_backoff_sec
        # Idempotency registry: key -> result (memory cache)
        self._idempotency_store: Dict[str, Dict[str, Any]] = {}
        # Persistent checkpoints (memory cache)
        self._checkpoints: Dict[str, List[WorkflowCheckpoint]] = {}

    def get_idempotent_result(self, key: str) -> Optional[Dict[str, Any]]:
        return self._idempotency_store.get(key)

    async def get_idempotent_result_async(self, key: str, session: Optional[Any] = None) -> Optional[Dict[str, Any]]:
        if key in self._idempotency_store:
            return self._idempotency_store[key]

        # Check database
        try:
            if session is not None:
                stmt = select(IdempotencyRecordModel).where(IdempotencyRecordModel.key == key)
                res = await session.execute(stmt)
                row = res.scalar_one_or_none()
                if row:
                    data = json.loads(row.result_json)
                    self._idempotency_store[key] = data
                    return data
            else:
                async with AsyncSessionLocal() as db:
                    stmt = select(IdempotencyRecordModel).where(IdempotencyRecordModel.key == key)
                    res = await db.execute(stmt)
                    row = res.scalar_one_or_none()
                    if row:
                        data = json.loads(row.result_json)
                        self._idempotency_store[key] = data
                        return data
        except Exception:
            pass
        return None

    def record_idempotent_result(self, key: str, result: Dict[str, Any]):
        self._idempotency_store[key] = result

    async def record_idempotent_result_async(self, key: str, result: Dict[str, Any], session: Optional[Any] = None):
        self.record_idempotent_result(key, result)
        try:
            payload = json.dumps(result)
            if session is not None:
                record = IdempotencyRecordModel(key=key, result_json=payload)
                await session.merge(record)
                await session.commit()
            else:
                async with AsyncSessionLocal() as db:
                    record = IdempotencyRecordModel(key=key, result_json=payload)
                    await db.merge(record)
                    await db.commit()
        except Exception:
            pass

    def get_checkpoints(self, job_id: str) -> List[WorkflowCheckpoint]:
        return self._checkpoints.get(job_id, [])

    async def get_checkpoints_async(self, job_id: str, session: Optional[Any] = None) -> List[WorkflowCheckpoint]:
        if job_id in self._checkpoints and len(self._checkpoints[job_id]) > 0:
            return self._checkpoints[job_id]

        try:
            items: List[WorkflowCheckpoint] = []
            if session is not None:
                stmt = select(WorkflowCheckpointModel).where(WorkflowCheckpointModel.job_id == job_id).order_by(WorkflowCheckpointModel.created_at.asc())
                res = await session.execute(stmt)
                rows = res.scalars().all()
                for r in rows:
                    items.append(WorkflowCheckpoint(
                        job_id=r.job_id,
                        plan_id=r.plan_id,
                        step_id=r.step_id,
                        status=r.status,
                        attempt=r.attempt,
                        result=json.loads(r.result_json) if r.result_json else None,
                        error=r.error,
                        timestamp=r.created_at
                    ))
            else:
                async with AsyncSessionLocal() as db:
                    stmt = select(WorkflowCheckpointModel).where(WorkflowCheckpointModel.job_id == job_id).order_by(WorkflowCheckpointModel.created_at.asc())
                    res = await db.execute(stmt)
                    rows = res.scalars().all()
                    for r in rows:
                        items.append(WorkflowCheckpoint(
                            job_id=r.job_id,
                            plan_id=r.plan_id,
                            step_id=r.step_id,
                            status=r.status,
                            attempt=r.attempt,
                            result=json.loads(r.result_json) if r.result_json else None,
                            error=r.error,
                            timestamp=r.created_at
                        ))
            if items:
                self._checkpoints[job_id] = items
            return items
        except Exception:
            return self._checkpoints.get(job_id, [])

    def record_checkpoint(self, checkpoint: WorkflowCheckpoint):
        if checkpoint.job_id not in self._checkpoints:
            self._checkpoints[checkpoint.job_id] = []
        self._checkpoints[checkpoint.job_id].append(checkpoint)

    async def record_checkpoint_async(self, checkpoint: WorkflowCheckpoint, session: Optional[Any] = None):
        self.record_checkpoint(checkpoint)
        try:
            res_json = json.dumps(checkpoint.result) if checkpoint.result is not None else None
            model = WorkflowCheckpointModel(
                job_id=checkpoint.job_id,
                plan_id=checkpoint.plan_id,
                step_id=checkpoint.step_id,
                status=checkpoint.status,
                attempt=checkpoint.attempt,
                result_json=res_json,
                error=checkpoint.error,
            )
            if session is not None:
                session.add(model)
                await session.commit()
            else:
                async with AsyncSessionLocal() as db:
                    db.add(model)
                    await db.commit()
        except Exception:
            pass

    async def execute_node_with_retry(
        self,
        job_id: str,
        plan_id: str,
        node: PlanNode,
        org_id: str,
        user_id: Optional[str] = None,
        session: Optional[Any] = None
    ) -> Dict[str, Any]:
        idempotency_key = f"{plan_id}_{node.id}"

        # 1. Idempotency Check (checks cache then DB)
        cached = await self.get_idempotent_result_async(idempotency_key, session=session)
        if cached:
            return cached

        # 2. Execution with Exponential Backoff Retries
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            await self.record_checkpoint_async(WorkflowCheckpoint(
                job_id=job_id,
                plan_id=plan_id,
                step_id=node.id,
                status="started",
                attempt=attempt
            ), session=session)

            try:
                res = await tool_registry.execute_tool(
                    name=node.tool_name,
                    arguments=node.arguments,
                    org_id=org_id,
                    user_id=user_id,
                    idempotency_key=idempotency_key
                )

                if res.success:
                    await self.record_checkpoint_async(WorkflowCheckpoint(
                        job_id=job_id,
                        plan_id=plan_id,
                        step_id=node.id,
                        status="completed",
                        attempt=attempt,
                        result=res.data
                    ), session=session)
                    await self.record_idempotent_result_async(idempotency_key, res.data or {}, session=session)
                    return res.data or {}
                else:
                    last_error = res.error
            except Exception as e:
                last_error = str(e)

            # Backoff before next attempt
            if attempt < self.max_retries:
                await asyncio.sleep(self.initial_backoff_sec * (2 ** (attempt - 1)))

        # If all retries exhausted:
        await self.record_checkpoint_async(WorkflowCheckpoint(
            job_id=job_id,
            plan_id=plan_id,
            step_id=node.id,
            status="failed",
            attempt=self.max_retries,
            error=last_error
        ), session=session)
        raise RuntimeError(f"Step '{node.id}' ({node.tool_name}) failed after {self.max_retries} attempts: {last_error}")

durable_engine = DurableWorkflowEngine()
