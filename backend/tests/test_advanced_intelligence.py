import pytest
from app.schemas.digital_twin import (
    DocumentDigitalTwin, DocumentMetadata, ParagraphBlock,
    ExtractedField, SourceEvidenceRef, BoundingBox
)
from app.services.intelligence import cross_doc_intelligence
from app.services.search import semantic_search_service
from app.services.versioning import version_intelligence
from app.services.durable_engine import durable_engine
from app.schemas.job import PlanNode

def build_test_digital_twin(doc_id: str, filename: str, total_val: str, invoice_num: str = "INV-100") -> DocumentDigitalTwin:
    return DocumentDigitalTwin(
        document_id=doc_id,
        filename=filename,
        metadata=DocumentMetadata(
            title=filename,
            page_count=1,
            detected_mime_type="application/pdf",
            content_hash_sha256=f"hash_{doc_id}",
            created_at=None
        ),
        paragraphs=[
            ParagraphBlock(
                id=f"{doc_id}_p1",
                order_index=1,
                page_number=1,
                text="The aggregate liability cap shall not exceed $1,000,000 for all claims."
            ),
            ParagraphBlock(
                id=f"{doc_id}_p2",
                order_index=2,
                page_number=1,
                text=f"Total Amount payable to vendor under invoice {invoice_num} is {total_val}."
            )
        ],
        extracted_fields={
            "invoice_number": ExtractedField(
                field_name="Invoice Number",
                field_value=invoice_num,
                status="confirmed",
                confidence=0.99
            ),
            "total": ExtractedField(
                field_name="Grand Total",
                field_value=total_val,
                status="confirmed",
                confidence=0.98,
                evidence=SourceEvidenceRef(
                    evidence_id="ev_1",
                    page_number=1,
                    bbox=BoundingBox(x=100.0, y=200.0, width=150.0, height=20.0),
                    extracted_text=total_val,
                    confidence=0.98
                )
            )
        }
    )

def test_cross_document_duplicate_and_contradiction():
    # Twin A and Twin B have same invoice number but differing total amounts -> CONTRADICTION!
    twin_a = build_test_digital_twin("doc_a", "Invoice_A.pdf", "$15,000.00", "INV-8899")
    twin_b = build_test_digital_twin("doc_b", "Invoice_B.pdf", "$18,500.00", "INV-8899")

    report = cross_doc_intelligence.analyze_cross_documents([twin_a, twin_b])
    assert report.documents_analyzed == 2
    assert len(report.contradictions) == 1
    contra = report.contradictions[0]
    assert contra.field_name == "total"
    assert contra.value_a == "$15,000.00"
    assert contra.value_b == "$18,500.00"
    assert contra.severity == "CRITICAL"

    # Evidence graph must contain document nodes and contradiction edge
    edge_types = [e.relation for e in report.evidence_graph.edges]
    assert "contradicts" in edge_types

def test_semantic_document_search():
    twin = build_test_digital_twin("doc_search_1", "Contract_Agreement.pdf", "$50,000.00")
    
    # Query for liability
    res = semantic_search_service.search_documents([twin], "liability aggregate cap")
    assert res.total_matches >= 1
    assert "liability" in res.matches[0].matched_text.lower()
    assert res.matches[0].score > 0.5

    # Query for exact field
    res_field = semantic_search_service.search_documents([twin], "Grand Total")
    assert res_field.total_matches >= 1
    assert res_field.matches[0].score >= 0.95

def test_version_change_intelligence():
    twin_v1 = build_test_digital_twin("doc_base", "v1.pdf", "$10,000.00")
    twin_v2 = build_test_digital_twin("doc_base", "v2.pdf", "$12,500.00")

    diff = version_intelligence.compare_digital_twins(twin_v1, twin_v2)
    assert diff.total_modifications >= 1
    mod_fields = [d for d in diff.diffs if d.category == "extracted_field"]
    assert len(mod_fields) >= 1
    assert mod_fields[0].original_value == "$10,000.00"
    assert mod_fields[0].updated_value == "$12,500.00"

@pytest.mark.asyncio
async def test_durable_workflow_engine_idempotency_and_retry(db_session: AsyncSession):
    node = PlanNode(
        id="step_inspect_1",
        tool_name="inspect_file",
        description="Inspect file",
        arguments={"document_id": "doc_sample", "deep_forensics": True}
    )

    # First execution with DB session persistence
    res1 = await durable_engine.execute_node_with_retry(
        job_id="job_dur_1",
        plan_id="plan_dur_1",
        node=node,
        org_id="org_test",
        session=db_session
    )
    assert res1["status"] == "VALID"

    # Second execution must return cached idempotent result
    res2 = await durable_engine.execute_node_with_retry(
        job_id="job_dur_1",
        plan_id="plan_dur_1",
        node=node,
        org_id="org_test",
        session=db_session
    )
    assert res2 == res1

    # Checkpoints must be recorded
    checkpoints = durable_engine.get_checkpoints("job_dur_1")
    assert len(checkpoints) >= 1

    # Clear in-memory caches to simulate server restart / crash recovery
    durable_engine._idempotency_store.clear()
    durable_engine._checkpoints.clear()

    # Must recover checkpoints from database
    recovered_checkpoints = await durable_engine.get_checkpoints_async("job_dur_1", session=db_session)
    assert len(recovered_checkpoints) >= 1
    assert recovered_checkpoints[-1].status == "completed"

    # Must recover idempotent result from database
    recovered_res = await durable_engine.get_idempotent_result_async("plan_dur_1_step_inspect_1", session=db_session)
    assert recovered_res == res1
