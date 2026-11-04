import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.schemas.job import ExecutionPlan, PlanNode
from app.services.tool_registry import tool_registry

class AutonomousAgentService:
    @staticmethod
    def generate_plan_for_objective(
        objective: str,
        document_ids: List[str]
    ) -> ExecutionPlan:
        """
        Interprets natural language objective and constructs a verified execution DAG.
        """
        plan_id = f"plan_{uuid.uuid4().hex[:8]}"
        nodes: List[PlanNode] = []

        is_invoice_task = any(term in objective.lower() for term in ["invoice", "receipt", "bill", "vendor", "tax"])

        if is_invoice_task and document_ids:
            # 1. Inspect Files
            nodes.append(PlanNode(
                id="step_1_inspect",
                tool_name="inspect_file",
                description="Validate invoice file headers, formats, and decompression safety limits",
                arguments={"document_id": document_ids[0], "deep_forensics": True},
                depends_on=[]
            ))

            # 2. Parse Documents into Digital Twins
            nodes.append(PlanNode(
                id="step_2_parse",
                tool_name="parse_document",
                description="Parse invoice page structure, reading order, and table boundaries",
                arguments={"document_id": document_ids[0], "extract_tables": True},
                depends_on=["step_1_inspect"]
            ))

            # 3. Extract Invoice Fields with Coordinates
            nodes.append(PlanNode(
                id="step_3_extract",
                tool_name="extract_fields",
                description="Extract vendor, invoice_number, date, tax, and total linked to bounding boxes",
                arguments={"document_id": document_ids[0], "target_fields": ["vendor", "invoice_number", "invoice_date", "tax", "total"]},
                depends_on=["step_2_parse"]
            ))

            # 4. Check Duplicates & Anomalies
            nodes.append(PlanNode(
                id="step_4_check_duplicates",
                tool_name="find_duplicates",
                description="Identify cross-document collisions and duplicate invoice numbers",
                arguments={"document_ids": document_ids, "threshold": 0.90},
                depends_on=["step_3_extract"]
            ))

            # 5. Generate Excel and Summary Reports
            nodes.append(PlanNode(
                id="step_5_generate_report",
                tool_name="generate_report",
                description="Synthesize structured invoice intelligence ledger into Excel workbook",
                arguments={"title": "Invoice Reconciliation Report 2026", "summary_data": {"invoices_processed": len(document_ids)}, "output_format": "xlsx"},
                depends_on=["step_4_check_duplicates"]
            ))

            # 6. Verify Output Files
            nodes.append(PlanNode(
                id="step_6_verify",
                tool_name="verify_output",
                description="Re-open generated Excel report and verify schema, cell formulas, and row count",
                arguments={"document_id": document_ids[0]},
                depends_on=["step_5_generate_report"]
            ))

        else:
            # General Document Intelligence Plan
            nodes.append(PlanNode(
                id="step_1_inspect",
                tool_name="inspect_file",
                description="Inspect and validate file format and integrity",
                arguments={"document_id": document_ids[0] if document_ids else "doc_target", "deep_forensics": True},
                depends_on=[]
            ))
            nodes.append(PlanNode(
                id="step_2_parse",
                tool_name="parse_document",
                description="Construct canonical Document Digital Twin",
                arguments={"document_id": document_ids[0] if document_ids else "doc_target"},
                depends_on=["step_1_inspect"]
            ))
            nodes.append(PlanNode(
                id="step_3_verify",
                tool_name="verify_output",
                description="Verify document structural integrity and checksum consistency",
                arguments={"document_id": document_ids[0] if document_ids else "doc_target"},
                depends_on=["step_2_parse"]
            ))

        # Validate DAG
        AutonomousAgentService._validate_dag(nodes)

        return ExecutionPlan(
            plan_id=plan_id,
            objective=objective,
            nodes=nodes,
            estimated_duration_seconds=len(nodes) * 4,
            is_valid_dag=True
        )

    @staticmethod
    def _validate_dag(nodes: List[PlanNode]):
        """
        Validates that the execution plan is a directed acyclic graph (no cycles)
        and all referenced tools and dependencies exist.
        """
        node_ids = {n.id for n in nodes}
        for n in nodes:
            # Check tool registered
            if not tool_registry.get_tool(n.tool_name):
                raise ValueError(f"Plan references unregistered tool '{n.tool_name}'")
            # Check dependencies exist
            for dep in n.depends_on:
                if dep not in node_ids:
                    raise ValueError(f"Node '{n.id}' depends on non-existent node '{dep}'")

        # Cycle check via topological sort
        in_degree = {n.id: 0 for n in nodes}
        adj: Dict[str, List[str]] = {n.id: [] for n in nodes}
        for n in nodes:
            for dep in n.depends_on:
                adj[dep].append(n.id)
                in_degree[n.id] += 1

        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        visited_count = 0

        while queue:
            curr = queue.pop(0)
            visited_count += 1
            for nxt in adj[curr]:
                in_degree[nxt] -= 1
                if in_degree[nxt] == 0:
                    queue.append(nxt)

        if visited_count != len(nodes):
            raise ValueError("Invalid Plan: Cycle detected in execution dependency graph")

    @staticmethod
    async def execute_plan_step(
        plan: ExecutionPlan,
        org_id: str,
        user_id: Optional[str] = None
    ) -> ExecutionPlan:
        """
        Executes ready pending nodes in the plan. Pauses if a node requires human approval.
        """
        completed_ids = {n.id for n in plan.nodes if n.status == "completed"}

        for node in plan.nodes:
            if node.status == "pending":
                # Check if dependencies are completed
                deps_met = all(dep in completed_ids for dep in node.depends_on)
                if not deps_met:
                    continue

                if node.requires_approval:
                    node.status = "waiting_approval"
                    return plan

                # Execute tool
                node.status = "running"
                node.started_at = datetime.utcnow()
                res = await tool_registry.execute_tool(
                    name=node.tool_name,
                    arguments=node.arguments,
                    org_id=org_id,
                    user_id=user_id,
                    idempotency_key=f"{plan.plan_id}_{node.id}"
                )

                if res.success:
                    node.status = "completed"
                    node.result = res.data
                    node.completed_at = datetime.utcnow()
                    completed_ids.add(node.id)
                else:
                    node.status = "failed"
                    node.error = res.error
                    node.completed_at = datetime.utcnow()
                    # Skip dependent children
                    AutonomousAgentService._skip_dependents(plan, node.id)
                    break

        return plan

    @staticmethod
    def _skip_dependents(plan: ExecutionPlan, failed_node_id: str):
        for n in plan.nodes:
            if failed_node_id in n.depends_on and n.status == "pending":
                n.status = "skipped"
                AutonomousAgentService._skip_dependents(plan, n.id)

agent_service = AutonomousAgentService()
