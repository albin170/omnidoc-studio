import pytest
import io
import openpyxl
from app.services.parser import document_parser
from app.services.tool_registry import tool_registry
from app.services.agent import agent_service
from app.schemas.job import PlanNode

def test_document_digital_twin_excel_parsing():
    # Build a real Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Invoices"
    ws.append(["Vendor", "Invoice #", "Amount"])
    ws.append(["Cloud Computing LLC", "INV-9901", 12500.50])
    ws.append(["CyberSec Guard Inc", "INV-9902", 4300.00])

    buf = io.BytesIO()
    wb.save(buf)
    excel_bytes = buf.getvalue()

    twin = document_parser.parse_document(
        document_id="doc_excel_1",
        filename="invoices.xlsx",
        content=excel_bytes,
        format_type="xlsx"
    )

    assert twin.document_id == "doc_excel_1"
    assert twin.metadata.page_count >= 1
    assert len(twin.tables) == 1
    table = twin.tables[0]
    assert table.row_count == 3
    assert table.column_count == 3
    # Check header cell
    header_cell = [c for c in table.cells if c.row_index == 0 and c.col_index == 0][0]
    assert header_cell.is_header is True
    assert header_cell.text == "Vendor"

@pytest.mark.asyncio
async def test_tool_registry_registration_and_execution():
    tools = tool_registry.list_tools()
    assert len(tools) == 10

    required_tool_names = [
        "inspect_file", "parse_document", "extract_fields",
        "compare_documents", "find_duplicates", "convert_document",
        "edit_document", "generate_report", "verify_output", "request_approval"
    ]
    for name in required_tool_names:
        t = tool_registry.get_tool(name)
        assert t is not None
        assert t.name == name

    # Execute inspect_file
    res = await tool_registry.execute_tool(
        name="inspect_file",
        arguments={"document_id": "doc_sample_1", "deep_forensics": True},
        org_id="test_org"
    )
    assert res.success is True
    assert res.data["status"] == "VALID"
    assert res.data["signature_verified"] is True

@pytest.mark.asyncio
async def test_agent_plan_generation_and_cycle_detection():
    # Generate plan for Invoice Intelligence
    plan = agent_service.generate_plan_for_objective(
        objective="Extract invoice details, reconcile taxes, and generate financial report",
        document_ids=["doc_inv_1", "doc_inv_2"]
    )
    assert plan.is_valid_dag is True
    assert len(plan.nodes) == 6
    assert plan.nodes[0].tool_name == "inspect_file"
    assert plan.nodes[-1].tool_name == "verify_output"

    # Test Cycle Detection
    cyclic_nodes = [
        PlanNode(id="A", tool_name="inspect_file", description="A", depends_on=["B"]),
        PlanNode(id="B", tool_name="parse_document", description="B", depends_on=["A"]),
    ]
    with pytest.raises(ValueError, match="Cycle detected"):
        agent_service._validate_dag(cyclic_nodes)

@pytest.mark.asyncio
async def test_invoice_intelligence_workflow_execution():
    plan = agent_service.generate_plan_for_objective(
        objective="Analyze incoming vendor invoices and verify reconciled amounts",
        document_ids=["doc_inv_101"]
    )

    # Execute plan step
    updated_plan = await agent_service.execute_plan_step(
        plan=plan,
        org_id="org_alpha"
    )

    # Step 1 should be completed
    assert updated_plan.nodes[0].status == "completed"
    assert updated_plan.nodes[0].result["status"] == "VALID"
