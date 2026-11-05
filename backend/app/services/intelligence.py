from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.schemas.digital_twin import DocumentDigitalTwin

class EvidenceGraphNode(BaseModel):
    id: str
    type: str # document, page, entity, claim, contradiction
    label: str
    metadata: Dict[str, Any] = {}

class EvidenceGraphEdge(BaseModel):
    source: str
    target: str
    relation: str # contains, extracted_from, contradicts, duplicates, supports
    weight: float = 1.0

class EvidenceGraph(BaseModel):
    nodes: List[EvidenceGraphNode] = []
    edges: List[EvidenceGraphEdge] = []

class CrossDocumentContradiction(BaseModel):
    document_a_id: str
    document_b_id: str
    field_name: str
    value_a: Any
    value_b: Any
    explanation: str
    severity: str = "HIGH" # LOW, MEDIUM, HIGH, CRITICAL

class CrossDocumentReport(BaseModel):
    documents_analyzed: int
    duplicates: List[Dict[str, Any]] = []
    contradictions: List[CrossDocumentContradiction] = []
    evidence_graph: EvidenceGraph

class CrossDocumentIntelligenceService:
    @staticmethod
    def analyze_cross_documents(
        twins: List[DocumentDigitalTwin],
        similarity_threshold: float = 0.85
    ) -> CrossDocumentReport:
        duplicates: List[Dict[str, Any]] = []
        contradictions: List[CrossDocumentContradiction] = []
        graph_nodes: List[EvidenceGraphNode] = []
        graph_edges: List[EvidenceGraphEdge] = []

        # 1. Build document nodes in Evidence Graph
        for twin in twins:
            graph_nodes.append(EvidenceGraphNode(
                id=twin.document_id,
                type="document",
                label=twin.filename,
                metadata={"pages": twin.metadata.page_count, "hash": twin.metadata.content_hash_sha256}
            ))

            # Add extracted field nodes and link to document
            for field_name, field in twin.extracted_fields.items():
                node_id = f"{twin.document_id}_{field_name}"
                graph_nodes.append(EvidenceGraphNode(
                    id=node_id,
                    type="entity",
                    label=f"{field.field_name}: {field.field_value}",
                    metadata={"status": field.status, "confidence": field.confidence}
                ))
                graph_edges.append(EvidenceGraphEdge(
                    source=twin.document_id,
                    target=node_id,
                    relation="extracted_from"
                ))

        # 2. Pairwise cross-document comparison
        n = len(twins)
        for i in range(n):
            for j in range(i + 1, n):
                twin_a = twins[i]
                twin_b = twins[j]

                # Check exact or near duplicate
                if twin_a.metadata.content_hash_sha256 == twin_b.metadata.content_hash_sha256:
                    duplicates.append({
                        "doc_a": twin_a.document_id,
                        "doc_b": twin_b.document_id,
                        "type": "EXACT_HASH_MATCH",
                        "similarity": 1.0
                    })
                    graph_edges.append(EvidenceGraphEdge(
                        source=twin_a.document_id,
                        target=twin_b.document_id,
                        relation="duplicates",
                        weight=1.0
                    ))
                else:
                    # Token similarity across paragraphs
                    text_a = " ".join([p.text.lower() for p in twin_a.paragraphs])
                    text_b = " ".join([p.text.lower() for p in twin_b.paragraphs])
                    tokens_a = set(text_a.split())
                    tokens_b = set(text_b.split())
                    if tokens_a and tokens_b:
                        intersection = len(tokens_a.intersection(tokens_b))
                        union = len(tokens_a.union(tokens_b))
                        jaccard = intersection / max(1, union)
                        if jaccard >= similarity_threshold:
                            duplicates.append({
                                "doc_a": twin_a.document_id,
                                "doc_b": twin_b.document_id,
                                "type": "NEAR_DUPLICATE",
                                "similarity": round(jaccard, 3)
                            })
                            graph_edges.append(EvidenceGraphEdge(
                                source=twin_a.document_id,
                                target=twin_b.document_id,
                                relation="duplicates",
                                weight=jaccard
                            ))

                # Check field contradictions
                # e.g., if both have 'invoice_number' and they match, but 'total' is different!
                fields_a = twin_a.extracted_fields
                fields_b = twin_b.extracted_fields

                inv_a = fields_a.get("invoice_number")
                inv_b = fields_b.get("invoice_number")
                total_a = fields_a.get("total")
                total_b = fields_b.get("total")

                if inv_a and inv_b and str(inv_a.field_value) == str(inv_b.field_value):
                    if total_a and total_b and str(total_a.field_value) != str(total_b.field_value):
                        contra = CrossDocumentContradiction(
                            document_a_id=twin_a.document_id,
                            document_b_id=twin_b.document_id,
                            field_name="total",
                            value_a=total_a.field_value,
                            value_b=total_b.field_value,
                            explanation=f"Conflicting grand total detected for matching invoice {inv_a.field_value}: '{total_a.field_value}' vs '{total_b.field_value}'",
                            severity="CRITICAL"
                        )
                        contradictions.append(contra)

                        # Add contradiction edge in evidence graph
                        node_a_id = f"{twin_a.document_id}_total"
                        node_b_id = f"{twin_b.document_id}_total"
                        graph_edges.append(EvidenceGraphEdge(
                            source=node_a_id,
                            target=node_b_id,
                            relation="contradicts",
                            weight=1.0
                        ))

        return CrossDocumentReport(
            documents_analyzed=len(twins),
            duplicates=duplicates,
            contradictions=contradictions,
            evidence_graph=EvidenceGraph(nodes=graph_nodes, edges=graph_edges)
        )

cross_doc_intelligence = CrossDocumentIntelligenceService()
