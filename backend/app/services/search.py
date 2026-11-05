import re
import math
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.schemas.digital_twin import DocumentDigitalTwin, BoundingBox

class SearchMatch(BaseModel):
    document_id: str
    filename: str
    page_number: int
    matched_text: str
    score: float
    bbox: Optional[BoundingBox] = None
    context_snippet: str
    field_reference: Optional[str] = None

class SearchResult(BaseModel):
    query: str
    total_matches: int
    matches: List[SearchMatch]

class SemanticSearchService:
    @staticmethod
    def search_documents(
        twins: List[DocumentDigitalTwin],
        query: str,
        limit: int = 10
    ) -> SearchResult:
        query_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        if not query_terms:
            return SearchResult(query=query, total_matches=0, matches=[])

        matches: List[SearchMatch] = []

        for twin in twins:
            # 1. Search in paragraphs
            for p in twin.paragraphs:
                p_text_lower = p.text.lower()
                term_hits = sum(1 for term in query_terms if term in p_text_lower)
                if term_hits > 0:
                    # BM25-style term frequency score
                    tf = term_hits / max(1, len(query_terms))
                    score = round(min(1.0, tf * (1.0 + math.log10(len(p.text) + 1))), 3)
                    
                    matches.append(SearchMatch(
                        document_id=twin.document_id,
                        filename=twin.filename,
                        page_number=p.page_number,
                        matched_text=p.text,
                        score=score,
                        bbox=p.bbox,
                        context_snippet=p.text[:200]
                    ))

            # 2. Search in extracted fields
            for field_name, field in twin.extracted_fields.items():
                val_str = str(field.field_value).lower()
                name_str = field.field_name.lower()
                if any(term in val_str or term in name_str for term in query_terms):
                    matches.append(SearchMatch(
                        document_id=twin.document_id,
                        filename=twin.filename,
                        page_number=field.evidence.page_number if field.evidence else 1,
                        matched_text=f"{field.field_name}: {field.field_value}",
                        score=0.99, # Exact field hit has highest precedence
                        bbox=field.evidence.bbox if field.evidence else None,
                        context_snippet=f"Confirmed Field '{field.field_name}' = {field.field_value}",
                        field_reference=field_name
                    ))

            # 3. Search in tables
            for tbl in twin.tables:
                for cell in tbl.cells:
                    c_text_lower = cell.text.lower()
                    if any(term in c_text_lower for term in query_terms):
                        matches.append(SearchMatch(
                            document_id=twin.document_id,
                            filename=twin.filename,
                            page_number=tbl.page_number,
                            matched_text=cell.text,
                            score=0.85,
                            bbox=cell.bbox,
                            context_snippet=f"Table cell [R{cell.row_index}:C{cell.col_index}]: {cell.text}"
                        ))

        # Sort matches descending by score
        matches.sort(key=lambda m: m.score, reverse=True)
        top_matches = matches[:limit]

        return SearchResult(
            query=query,
            total_matches=len(matches),
            matches=top_matches
        )

semantic_search_service = SemanticSearchService()
