import time
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.schemas.job import ExecutionPlan, PlanNode
from app.services.tool_registry import tool_registry

class WorkflowCheckpoint(BaseModel):
    job_id: str
    plan_id: str
    step_id: str
    status: str # started, completed, failed, paused
    attempt: int = 1
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = datetime.utcnow()

class DurableWorkflowEngine:
    def __init__(self, max_retries: int = 3, initial_backoff_sec: float = 0.5):
        self.max_retries = max_retries
        self.initial_backoff_sec = initial_backoff_sec
        # Idempotency registry: key -> result
        self._idempotency_store: Dict[str, Dict[str, Any]] = {}
        # Persistent checkpoints
        self._checkpoints: Dict[str, List[WorkflowCheckpoint]] = {}

    def get_idempotent_result(self, key: str) -> Optional[Dict[str, Any]]:
        return self._idempotency_store.get(key)

    def record_idempotent_result(self, key: str, result: Dict[str, Any]):
        self._idempotency_store[key] = result

    def get_checkpoints(self, job_id: str) -> List[WorkflowCheckpoint]:
        return self._checkpoints.get(job_id, [])

    def record_checkpoint(self, checkpoint: WorkflowCheckpoint):
        if checkpoint.job_id not in self._checkpoints:
            self._checkpoints[checkpoint.job_id] = []
        self._checkpoints[checkpoint.job_id].append(checkpoint)

    async def execute_node_with_retry(
        self,
        job_id: str,
        plan_id: str,
        node: PlanNode,
        org_id: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        idempotency_key = f"{plan_id}_{node.id}"

        # 1. Idempotency Check
        cached = self.get_idempotent_result(idempotency_key)
        if cached:
            return cached

        # 2. Execution with Exponential Backoff Retries
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            self.record_checkpoint(WorkflowCheckpoint(
                job_id=job_id,
                plan_id=plan_id,
                step_id=node.id,
                status="started",
                attempt=attempt
            ))

            try:
                res = await tool_registry.execute_tool(
                    name=node.tool_name,
                    arguments=node.arguments,
                    org_id=org_id,
                    user_id=user_id,
                    idempotency_key=idempotency_key
                )

                if res.success:
                    self.record_checkpoint(WorkflowCheckpoint(
                        job_id=job_id,
                        plan_id=plan_id,
                        step_id=node.id,
                        status="completed",
                        attempt=attempt,
                        result=res.data
                    ))
                    self.record_idempotent_result(idempotency_key, res.data or {})
                    return res.data or {}
                else:
                    last_error = res.error
            except Exception as e:
                last_error = str(e)

            # Backoff before next attempt
            if attempt < self.max_retries:
                await asyncio.sleep(self.initial_backoff_sec * (2 ** (attempt - 1)))

        # If all retries exhausted:
        self.record_checkpoint(WorkflowCheckpoint(
            job_id=job_id,
            plan_id=plan_id,
            step_id=node.id,
            status="failed",
            attempt=self.max_retries,
            error=last_error
        ))
        raise RuntimeError(f"Step '{node.id}' ({node.tool_name}) failed after {self.max_retries} attempts: {last_error}")

durable_engine = DurableWorkflowEngine()

