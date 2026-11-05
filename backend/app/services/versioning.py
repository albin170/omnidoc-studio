from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.schemas.digital_twin import DocumentDigitalTwin

class StructuralDiffItem(BaseModel):
    category: str # paragraph, table_cell, heading, extracted_field
    change_type: str # added, removed, modified, unchanged
    location: str # e.g. "Page 1, Paragraph 3" or "Table 1 [R2:C1]"
    original_value: Optional[str] = None
    updated_value: Optional[str] = None
    impact_level: str = "LOW" # LOW, MEDIUM, HIGH

class VersionDiffReport(BaseModel):
    base_document_id: str
    target_document_id: str
    base_version: str
    target_version: str
    total_modifications: int
    fidelity_retention_score: float
    diffs: List[StructuralDiffItem]

class VersionChangeIntelligenceService:
    @staticmethod
    def compare_digital_twins(
        base_twin: DocumentDigitalTwin,
        target_twin: DocumentDigitalTwin
    ) -> VersionDiffReport:
        diffs: List[StructuralDiffItem] = []

        # 1. Compare Paragraphs
        base_paras = {p.id: p.text for p in base_twin.paragraphs}
        target_paras = {p.id: p.text for p in target_twin.paragraphs}

        # Check modified or removed in base
        for pid, text in base_paras.items():
            if pid in target_paras:
                if text != target_paras[pid]:
                    diffs.append(StructuralDiffItem(
                        category="paragraph",
                        change_type="modified",
                        location=f"Paragraph {pid}",
                        original_value=text,
                        updated_value=target_paras[pid],
                        impact_level="MEDIUM"
                    ))
            else:
                diffs.append(StructuralDiffItem(
                    category="paragraph",
                    change_type="removed",
                    location=f"Paragraph {pid}",
                    original_value=text,
                    impact_level="HIGH"
                ))

        # Check added in target
        for pid, text in target_paras.items():
            if pid not in base_paras:
                diffs.append(StructuralDiffItem(
                    category="paragraph",
                    change_type="added",
                    location=f"Paragraph {pid}",
                    updated_value=text,
                    impact_level="LOW"
                ))

        # 2. Compare Extracted Fields
        base_fields = base_twin.extracted_fields
        target_fields = target_twin.extracted_fields

        for fname, fval in base_fields.items():
            if fname in target_fields:
                tval = target_fields[fname]
                if str(fval.field_value) != str(tval.field_value):
                    diffs.append(StructuralDiffItem(
                        category="extracted_field",
                        change_type="modified",
                        location=f"Field '{fname}'",
                        original_value=str(fval.field_value),
                        updated_value=str(tval.field_value),
                        impact_level="HIGH"
                    ))
            else:
                diffs.append(StructuralDiffItem(
                    category="extracted_field",
                    change_type="removed",
                    location=f"Field '{fname}'",
                    original_value=str(fval.field_value),
                    impact_level="HIGH"
                ))

        for fname, fval in target_fields.items():
            if fname not in base_fields:
                diffs.append(StructuralDiffItem(
                    category="extracted_field",
                    change_type="added",
                    location=f"Field '{fname}'",
                    updated_value=str(fval.field_value),
                    impact_level="MEDIUM"
                ))

        # 3. Compute structural fidelity score
        total_items = max(1, len(base_twin.paragraphs) + len(base_fields))
        mod_count = len(diffs)
        retention_score = max(0.0, round((1.0 - (mod_count / total_items)) * 100.0, 1))

        return VersionDiffReport(
            base_document_id=base_twin.document_id,
            target_document_id=target_twin.document_id,
            base_version=base_twin.version,
            target_version=target_twin.version,
            total_modifications=mod_count,
            fidelity_retention_score=retention_score,
            diffs=diffs
        )

version_intelligence = VersionChangeIntelligenceService()
