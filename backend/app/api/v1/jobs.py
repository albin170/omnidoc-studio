import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.job import Job
from app.schemas.job import JobCreate, JobOut, JobApprovalRequest, ExecutionPlan
from app.services.agent import agent_service

router = APIRouter(prefix="/jobs", tags=["Autonomous Workflows & Jobs"])

@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def submit_autonomous_job(
    data: JobCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    job_id = str(uuid.uuid4())

    # Generate verified DAG plan
    try:
        plan = agent_service.generate_plan_for_objective(
            objective=data.objective,
            document_ids=data.document_ids
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Initial execution run of ready nodes
    updated_plan = await agent_service.execute_plan_step(
        plan=plan,
        org_id=current_user.org_id,
        user_id=current_user.id
    )

    # Determine job status
    any_waiting = any(n.status == "waiting_approval" for n in updated_plan.nodes)
    any_failed = any(n.status == "failed" for n in updated_plan.nodes)
    all_completed = all(n.status in ("completed", "skipped") for n in updated_plan.nodes)

    if any_waiting:
        job_status = "awaiting_approval"
    elif any_failed:
        job_status = "failed"
    elif all_completed:
        job_status = "completed"
    else:
        job_status = "running"

    new_job = Job(
        id=job_id,
        org_id=current_user.org_id,
        user_id=current_user.id,
        title=data.title,
        objective=data.objective,
        status=job_status,
        mode=data.mode,
        plan_json=updated_plan.model_dump_json(),
        current_step_index=sum(1 for n in updated_plan.nodes if n.status == "completed"),
        total_steps=len(updated_plan.nodes),
        result_json=None
    )

    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)

    return JobOut(
        id=new_job.id,
        org_id=new_job.org_id,
        user_id=new_job.user_id,
        title=new_job.title,
        objective=new_job.objective,
        status=new_job.status,
        mode=new_job.mode,
        plan=updated_plan,
        current_step_index=new_job.current_step_index,
        total_steps=new_job.total_steps,
        created_at=new_job.created_at,
        updated_at=new_job.updated_at
    )

@router.get("", response_model=List[JobOut])
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.org_id == current_user.org_id).order_by(Job.created_at.desc())
    res = await db.execute(stmt)
    jobs = res.scalars().all()
    
    results = []
    for j in jobs:
        plan_obj = None
        if j.plan_json:
            try:
                plan_obj = ExecutionPlan.model_validate_json(j.plan_json)
            except Exception:
                pass
        results.append(JobOut(
            id=j.id,
            org_id=j.org_id,
            user_id=j.user_id,
            title=j.title,
            objective=j.objective,
            status=j.status,
            mode=j.mode,
            plan=plan_obj,
            current_step_index=j.current_step_index,
            total_steps=j.total_steps,
            created_at=j.created_at,
            updated_at=j.updated_at
        ))
    return results

@router.get("/{job_id}", response_model=JobOut)
async def get_job_details(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.id == job_id, Job.org_id == current_user.org_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    plan_obj = None
    if job.plan_json:
        try:
            plan_obj = ExecutionPlan.model_validate_json(job.plan_json)
        except Exception:
            pass

    return JobOut(
        id=job.id,
        org_id=job.org_id,
        user_id=job.user_id,
        title=job.title,
        objective=job.objective,
        status=job.status,
        mode=job.mode,
        plan=plan_obj,
        current_step_index=job.current_step_index,
        total_steps=job.total_steps,
        created_at=job.created_at,
        updated_at=job.updated_at
    )

@router.post("/{job_id}/approve", response_model=JobOut)
async def approve_job_step(
    job_id: str,
    approval: JobApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.id == job_id, Job.org_id == current_user.org_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if not job.plan_json:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No plan associated with job")

    plan = ExecutionPlan.model_validate_json(job.plan_json)
    waiting_nodes = [n for n in plan.nodes if n.status == "waiting_approval"]
    if not waiting_nodes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job has no steps awaiting approval")

    target_node = waiting_nodes[0]
    if approval.approved:
        target_node.requires_approval = False
        target_node.status = "pending"
        # Continue execution
        updated_plan = await agent_service.execute_plan_step(plan, current_user.org_id, current_user.id)
    else:
        target_node.status = "failed"
        target_node.error = f"Rejected by human reviewer: {approval.rejection_reason or 'No reason provided'}"
        agent_service._skip_dependents(plan, target_node.id)
        updated_plan = plan

    # Re-evaluate status
    any_waiting = any(n.status == "waiting_approval" for n in updated_plan.nodes)
    any_failed = any(n.status == "failed" for n in updated_plan.nodes)
    all_completed = all(n.status in ("completed", "skipped") for n in updated_plan.nodes)

    if any_waiting:
        job.status = "awaiting_approval"
    elif any_failed:
        job.status = "failed"
    elif all_completed:
        job.status = "completed"
    else:
        job.status = "running"

    job.plan_json = updated_plan.model_dump_json()
    job.current_step_index = sum(1 for n in updated_plan.nodes if n.status == "completed")
    await db.commit()
    await db.refresh(job)

    return JobOut(
        id=job.id,
        org_id=job.org_id,
        user_id=job.user_id,
        title=job.title,
        objective=job.objective,
        status=job.status,
        mode=job.mode,
        plan=updated_plan,
        current_step_index=job.current_step_index,
        total_steps=job.total_steps,
        created_at=job.created_at,
        updated_at=job.updated_at
    )

@router.post("/{job_id}/cancel", response_model=JobOut)
async def cancel_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.id == job_id, Job.org_id == current_user.org_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    job.status = "cancelled"
    if job.plan_json:
        plan = ExecutionPlan.model_validate_json(job.plan_json)
        for n in plan.nodes:
            if n.status in ("pending", "waiting_approval"):
                n.status = "skipped"
        job.plan_json = plan.model_dump_json()

    await db.commit()
    await db.refresh(job)

    plan_obj = None
    if job.plan_json:
        try:
            plan_obj = ExecutionPlan.model_validate_json(job.plan_json)
        except Exception:
            pass

    return JobOut(
        id=job.id,
        org_id=job.org_id,
        user_id=job.user_id,
        title=job.title,
        objective=job.objective,
        status=job.status,
        mode=job.mode,
        plan=plan_obj,
        current_step_index=job.current_step_index,
        total_steps=job.total_steps,
        created_at=job.created_at,
        updated_at=job.updated_at
    )

