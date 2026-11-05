from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    x: float = Field(..., description="Left coordinate in points/pixels")
    y: float = Field(..., description="Top coordinate in points/pixels")
    width: float = Field(..., description="Box width")
    height: float = Field(..., description="Box height")
    unit: str = "pt"
    is_estimated: bool = False

class SourceEvidenceRef(BaseModel):
    evidence_id: str
    page_number: int
    bbox: BoundingBox
    extracted_text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    extraction_method: str = "native_text" # native_text, docling_ocr, rule_extractor
    is_estimated: bool = False

class HeadingBlock(BaseModel):
    level: int = 1
    text: str
    page_number: int
    bbox: Optional[BoundingBox] = None

class ParagraphBlock(BaseModel):
    id: str
    order_index: int
    page_number: int
    text: str
    bbox: Optional[BoundingBox] = None
    language: str = "en"

class TableCell(BaseModel):
    row_index: int
    col_index: int
    row_span: int = 1
    col_span: int = 1
    is_header: bool = False
    text: str
    value: Optional[Any] = None
    confidence: float = 1.0
    bbox: Optional[BoundingBox] = None

class TableBlock(BaseModel):
    id: str
    order_index: int
    page_number: int
    row_count: int
    column_count: int
    cells: List[TableCell] = []
    caption: Optional[str] = None
    bbox: Optional[BoundingBox] = None

class ImageBlock(BaseModel):
    id: str
    order_index: int
    page_number: int
    image_hash_sha256: str
    caption: Optional[str] = None
    bbox: Optional[BoundingBox] = None

class PageStructure(BaseModel):
    page_number: int
    width: float
    height: float
    rotation: int = 0
    paragraphs_count: int = 0
    tables_count: int = 0
    images_count: int = 0

class DocumentMetadata(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    creator: Optional[str] = None
    created_at: Optional[datetime] = None
    page_count: int
    language: str = "en"
    detected_mime_type: str
    content_hash_sha256: str

class ExtractedField(BaseModel):
    field_name: str
    field_value: Any
    status: str = "confirmed" # confirmed, inferred, missing
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: Optional[SourceEvidenceRef] = None
    validation_flags: List[str] = []

class DocumentDigitalTwin(BaseModel):
    version: str = "2.0.0"
    document_id: str
    filename: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    metadata: DocumentMetadata
    pages: List[PageStructure] = []
    
    # Document content hierarchy & reading sequence
    headings: List[HeadingBlock] = []
    paragraphs: List[ParagraphBlock] = []
    tables: List[TableBlock] = []
    images: List[ImageBlock] = []
    
    # Structured intelligence and field extractions
    extracted_fields: Dict[str, ExtractedField] = {}
    
    # Traceability and evidence graph
    evidence_ledger: List[SourceEvidenceRef] = []
    parent_version_hash: Optional[str] = None

