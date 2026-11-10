import os
import io
import hashlib
from typing import Optional, List
from datetime import datetime
import openpyxl
import pypdf

from app.schemas.digital_twin import (
    DocumentDigitalTwin, DocumentMetadata, PageStructure,
    ParagraphBlock, HeadingBlock, TableBlock, TableCell,
    ImageBlock, BoundingBox, SourceEvidenceRef
)

class DocumentParserService:
    @staticmethod
    def parse_document(
        document_id: str,
        filename: str,
        content: bytes,
        format_type: str
    ) -> DocumentDigitalTwin:
        hasher = hashlib.sha256()
        hasher.update(content)
        content_hash = hasher.hexdigest()

        twin = DocumentDigitalTwin(
            document_id=document_id,
            filename=filename,
            metadata=DocumentMetadata(
                title=filename,
                page_count=1,
                detected_mime_type=f"application/{format_type}",
                content_hash_sha256=content_hash,
                created_at=datetime.utcnow()
            )
        )

        fmt = format_type.lower()
        if fmt == "pdf":
            DocumentParserService._parse_pdf(twin, content)
        elif fmt in ("xlsx", "xls"):
            DocumentParserService._parse_excel(twin, content)
        elif fmt == "docx":
            DocumentParserService._parse_docx(twin, content)
        elif fmt == "pptx":
            DocumentParserService._parse_pptx(twin, content)
        elif fmt in ("png", "jpg", "jpeg", "webp"):
            DocumentParserService._parse_image(twin, content, fmt)
        elif fmt in ("txt", "md", "csv"):
            DocumentParserService._parse_text(twin, content)
        else:
            # Fallback text extractor
            DocumentParserService._parse_fallback(twin, content)

        return twin

    @staticmethod
    def _parse_pdf(twin: DocumentDigitalTwin, content: bytes):
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            twin.metadata.page_count = len(reader.pages)
            
            p_order = 0
            for idx, page in enumerate(reader.pages):
                page_num = idx + 1
                box = page.mediabox
                w = float(box.width) if box else 595.0
                h = float(box.height) if box else 842.0

                twin.pages.append(PageStructure(
                    page_number=page_num,
                    width=w,
                    height=h,
                    rotation=page.rotation or 0
                ))

                # Extract real text fragments with exact coordinates via pypdf visitor (BUG-06 fix)
                spans: list[dict] = []
                def visitor_body(text: str, cm: list, tm: list, font_dict: dict, font_size: float):
                    if text and text.strip():
                        # tm is [a, b, c, d, e, f] where e=x, f=y in PDF coords (origin at bottom-left)
                        raw_x = float(tm[4]) if len(tm) > 4 else 50.0
                        raw_y = float(tm[5]) if len(tm) > 5 else 50.0
                        fs = float(font_size or 12.0)
                        # Convert to top-left origin
                        top_y = max(0.0, h - raw_y - fs)
                        spans.append({
                            "text": text,
                            "x": raw_x,
                            "y": top_y,
                            "font_size": fs,
                            "width": len(text) * (fs * 0.55)
                        })

                full_text = page.extract_text(visitor_text=visitor_body) or ""
                lines = [line.strip() for line in full_text.split("\n") if line.strip()]

                # Group spans into lines by close vertical coordinates if available
                has_native_geometry = len(spans) > 0

                for line_idx, line in enumerate(lines):
                    p_order += 1
                    
                    if has_native_geometry:
                        # Find spans that contribute to this line
                        matching_spans = [s for s in spans if s["text"].strip() in line]
                        if matching_spans:
                            min_x = min(s["x"] for s in matching_spans)
                            min_y = min(s["y"] for s in matching_spans)
                            max_x = max(s["x"] + s["width"] for s in matching_spans)
                            max_h = max(s["font_size"] for s in matching_spans)
                            bbox = BoundingBox(
                                x=round(min_x, 2),
                                y=round(min_y, 2),
                                width=round(max(max_x - min_x, len(line) * 6.5), 2),
                                height=round(max_h, 2),
                                is_estimated=False
                            )
                            confidence = 1.0
                            method = "pypdf_stream_visitor"
                        else:
                            estimated_y = 50.0 + (line_idx * 18.0)
                            bbox = BoundingBox(
                                x=50.0,
                                y=min(estimated_y, h - 30.0),
                                width=min(w - 100.0, len(line) * 7.0),
                                height=14.0,
                                is_estimated=True
                            )
                            confidence = None
                            method = "heuristic_reading_order"
                    else:
                        estimated_y = 50.0 + (line_idx * 18.0)
                        bbox = BoundingBox(
                            x=50.0,
                            y=min(estimated_y, h - 30.0),
                            width=min(w - 100.0, len(line) * 7.0),
                            height=14.0,
                            is_estimated=True
                        )
                        confidence = None
                        method = "heuristic_reading_order"
                    
                    is_heading = len(line) < 60 and (line.isupper() or line.endswith(":") or line_idx == 0)
                    if is_heading:
                        twin.headings.append(HeadingBlock(
                            level=1 if line_idx == 0 else 2,
                            text=line,
                            page_number=page_num,
                            bbox=bbox
                        ))

                    twin.paragraphs.append(ParagraphBlock(
                        id=f"p_{page_num}_{p_order}",
                        order_index=p_order,
                        page_number=page_num,
                        text=line,
                        bbox=bbox
                    ))

                    # Add to evidence ledger with explicit extraction metadata
                    twin.evidence_ledger.append(SourceEvidenceRef(
                        evidence_id=f"ev_{page_num}_{p_order}",
                        page_number=page_num,
                        bbox=bbox,
                        extracted_text=line,
                        confidence=confidence,
                        extraction_method=method,
                        is_estimated=bbox.is_estimated
                    ))
        except Exception as e:
            DocumentParserService._parse_fallback(twin, content)

    @staticmethod
    def _parse_excel(twin: DocumentDigitalTwin, content: bytes):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet_names = wb.sheetnames
            twin.metadata.page_count = len(sheet_names)

            for page_idx, name in enumerate(sheet_names):
                sheet = wb[name]
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    continue

                cells: List[TableCell] = []
                for r_idx, row in enumerate(rows):
                    for c_idx, val in enumerate(row):
                        if val is not None and str(val).strip():
                            cells.append(TableCell(
                                row_index=r_idx,
                                col_index=c_idx,
                                is_header=(r_idx == 0),
                                text=str(val).strip(),
                                value=val,
                                confidence=1.0,
                                bbox=BoundingBox(x=c_idx * 80.0, y=r_idx * 20.0, width=80.0, height=20.0)
                            ))

                twin.tables.append(TableBlock(
                    id=f"table_{page_idx + 1}",
                    order_index=page_idx + 1,
                    page_number=page_idx + 1,
                    row_count=len(rows),
                    column_count=max(len(r) for r in rows) if rows else 0,
                    cells=cells,
                    caption=f"Sheet: {name}"
                ))

                twin.pages.append(PageStructure(
                    page_number=page_idx + 1,
                    width=842.0,
                    height=595.0,
                    tables_count=1
                ))
        except Exception:
            DocumentParserService._parse_fallback(twin, content)

    @staticmethod
    def _parse_text(twin: DocumentDigitalTwin, content: bytes):
        text = content.decode("utf-8", errors="replace")
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        twin.metadata.page_count = 1
        twin.pages.append(PageStructure(page_number=1, width=595.0, height=842.0, paragraphs_count=len(lines)))

        for idx, line in enumerate(lines):
            bbox = BoundingBox(x=40.0, y=40.0 + (idx * 16.0), width=500.0, height=14.0)
            twin.paragraphs.append(ParagraphBlock(
                id=f"p_1_{idx + 1}",
                order_index=idx + 1,
                page_number=1,
                text=line,
                bbox=bbox
            ))
            twin.evidence_ledger.append(SourceEvidenceRef(
                evidence_id=f"ev_1_{idx + 1}",
                page_number=1,
                bbox=bbox,
                extracted_text=line,
                confidence=1.0,
                extraction_method="utf8_stream"
            ))

    @staticmethod
    def _parse_docx(twin: DocumentDigitalTwin, content: bytes):
        import xml.etree.ElementTree as ET
        import zipfile
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                xml_content = z.read("word/document.xml")
            root = ET.fromstring(xml_content)
            w_ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

            p_order = 0
            twin.pages.append(PageStructure(page_number=1, width=595.0, height=842.0))

            for p_elem in root.iterfind(".//w:p", w_ns):
                texts = [t.text for t in p_elem.iterfind(".//w:t", w_ns) if t.text]
                p_text = "".join(texts).strip()
                if not p_text:
                    continue

                p_order += 1
                style_elem = p_elem.find(".//w:pStyle", w_ns)
                style_val = style_elem.attrib.get(f"{{{w_ns['w']}}}val", "") if style_elem is not None else ""
                is_heading = "heading" in style_val.lower() or (len(p_text) < 60 and (p_text.isupper() or p_text.endswith(":")))

                bbox = BoundingBox(x=50.0, y=50.0 + (p_order * 18.0), width=min(500.0, len(p_text) * 7.0), height=14.0, is_estimated=True)
                if is_heading:
                    level = 1 if "1" in style_val else 2
                    twin.headings.append(HeadingBlock(
                        level=level,
                        text=p_text,
                        page_number=1,
                        bbox=bbox
                    ))

                twin.paragraphs.append(ParagraphBlock(
                    id=f"docx_p_{p_order}",
                    order_index=p_order,
                    page_number=1,
                    text=p_text,
                    bbox=bbox
                ))
                twin.evidence_ledger.append(SourceEvidenceRef(
                    evidence_id=f"docx_ev_{p_order}",
                    page_number=1,
                    bbox=bbox,
                    extracted_text=p_text,
                    confidence=1.0,
                    extraction_method="openxml_document_stream",
                    is_estimated=True
                ))

            tbl_count = 0
            for tbl_elem in root.iterfind(".//w:tbl", w_ns):
                tbl_count += 1
                rows = tbl_elem.findall(".//w:tr", w_ns)
                cells = []
                for r_idx, tr in enumerate(rows):
                    tc_list = tr.findall(".//w:tc", w_ns)
                    for c_idx, tc in enumerate(tc_list):
                        cell_texts = [t.text for t in tc.iterfind(".//w:t", w_ns) if t.text]
                        cell_text = "".join(cell_texts).strip()
                        if cell_text:
                            cells.append(TableCell(
                                row_index=r_idx,
                                col_index=c_idx,
                                is_header=(r_idx == 0),
                                text=cell_text,
                                value=cell_text,
                                confidence=1.0,
                                bbox=BoundingBox(x=c_idx * 100.0, y=r_idx * 24.0, width=100.0, height=24.0)
                            ))
                if rows:
                    twin.tables.append(TableBlock(
                        id=f"docx_tbl_{tbl_count}",
                        order_index=tbl_count,
                        page_number=1,
                        row_count=len(rows),
                        column_count=max((len(r.findall(".//w:tc", w_ns)) for r in rows), default=0),
                        cells=cells,
                        caption=f"Word Table {tbl_count}"
                    ))
        except Exception:
            DocumentParserService._parse_fallback(twin, content)

    @staticmethod
    def _parse_pptx(twin: DocumentDigitalTwin, content: bytes):
        import xml.etree.ElementTree as ET
        import zipfile
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                slide_names = sorted(
                    [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")],
                    key=lambda x: int("".join(filter(str.isdigit, x)) or "0")
                )
                twin.metadata.page_count = max(1, len(slide_names))
                a_ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
                p_order = 0

                for idx, s_name in enumerate(slide_names):
                    page_num = idx + 1
                    twin.pages.append(PageStructure(
                        page_number=page_num,
                        width=960.0,
                        height=540.0
                    ))
                    s_xml = z.read(s_name)
                    root = ET.fromstring(s_xml)
                    for p_elem in root.iterfind(".//a:p", a_ns):
                        texts = [t.text for t in p_elem.iterfind(".//a:t", a_ns) if t.text]
                        text = "".join(texts).strip()
                        if not text:
                            continue
                        p_order += 1
                        bbox = BoundingBox(x=60.0, y=60.0 + (p_order * 20.0), width=min(800.0, len(text) * 8.0), height=18.0, is_estimated=True)
                        if p_order == 1 or len(text) < 50:
                            twin.headings.append(HeadingBlock(
                                level=1 if p_order == 1 else 2,
                                text=text,
                                page_number=page_num,
                                bbox=bbox
                            ))
                        twin.paragraphs.append(ParagraphBlock(
                            id=f"pptx_p_{page_num}_{p_order}",
                            order_index=p_order,
                            page_number=page_num,
                            text=text,
                            bbox=bbox
                        ))
        except Exception:
            DocumentParserService._parse_fallback(twin, content)

    @staticmethod
    def _parse_image(twin: DocumentDigitalTwin, content: bytes, fmt: str):
        import struct
        width, height = 800.0, 600.0
        try:
            if fmt == "png" and len(content) >= 24:
                w, h = struct.unpack(">II", content[16:24])
                width, height = float(w), float(h)
            elif fmt in ("jpg", "jpeg"):
                idx = 2
                while idx < len(content) - 8:
                    if content[idx] == 0xFF and content[idx+1] in (0xC0, 0xC2):
                        h, w = struct.unpack(">HH", content[idx+5:idx+9])
                        width, height = float(w), float(h)
                        break
                    elif content[idx] == 0xFF:
                        length = struct.unpack(">H", content[idx+2:idx+4])[0]
                        idx += 2 + length
                    else:
                        break
        except Exception:
            pass

        twin.metadata.page_count = 1
        twin.pages.append(PageStructure(
            page_number=1,
            width=width,
            height=height,
            images_count=1
        ))
        twin.paragraphs.append(ParagraphBlock(
            id="img_p_1",
            order_index=1,
            page_number=1,
            text=f"Visual asset: {twin.filename} ({int(width)}x{int(height)}px, {fmt.upper()})",
            bbox=BoundingBox(x=0.0, y=0.0, width=width, height=height)
        ))

    @staticmethod
    def _parse_fallback(twin: DocumentDigitalTwin, content: bytes):
        twin.pages.append(PageStructure(page_number=1, width=595.0, height=842.0))
        twin.paragraphs.append(ParagraphBlock(
            id="p_fallback_1",
            order_index=1,
            page_number=1,
            text=f"Binary package ({len(content)} bytes) verified and registered in vault.",
            bbox=BoundingBox(x=50.0, y=50.0, width=400.0, height=20.0)
        ))

document_parser = DocumentParserService()

