# OMNIDOC STUDIO — FEATURE & FORMAT COMPATIBILITY MATRIX

**Specification**: Comprehensive Capability & Input/Output Mapping  
**Execution Environment**: 100% Client-Side WebAssembly / Canvas / Browser RAM  

---

## 1. Workspaces & Studio Capabilities

| Studio Workspace | Primary Formats | Key Capabilities | Engine / Dependencies |
|---|---|---|---|
| **Universal Conversion Hub** | All 11 Formats | Multi-file queue, batch conversion, progress reporting, 1-click ZIP archive packaging, quality & orientation settings | `converter.ts`, `jszip`, `file-saver` |
| **PDF Studio** | `.pdf` | High-DPI canvas rendering, multi-level zoom (50%–250%), page thumbnails, rotate 90° CW, reorder, duplicate, delete, split by page range, merge multiple PDFs, text boxes, highlighter overlays, true black redaction, transparent digital signature drawing pad | `pdf-lib`, `pdfjs-dist` |
| **Word Document Studio** | `.docx`, `.txt`, `.html` | Rich markdown-compatible editing, Headings (H1–H3), Paragraphs, Bold, Italic, Bullets, Tables, Find & Replace, live word count, character count, reading time, OpenXML `.docx` export, clean `.pdf` export, `.html` export | `docx`, `pdf-lib` |
| **PowerPoint Studio** | `.pptx` | 16:9 Widescreen slide deck builder, slide strip navigation, Add/Duplicate/Delete/Reorder slides, visual themes (Dark Navy, Indigo, Emerald, Slate), Fullscreen presentation slideshow mode with keyboard navigation, OpenXML `.pptx` export, presentation `.pdf` export | `pptxgenjs`, `pdf-lib` |
| **Spreadsheet Studio** | `.xlsx`, `.csv` | Tabular data grid, cell selection, row/column addition and removal, formula bar, calculation engine (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, arithmetic expressions), Excel `.xlsx` export, `.csv` export, formatted PDF table reports | `xlsx` (SheetJS), `pdf-lib` |
| **Photo & Graphics Studio** | `.png`, `.jpg`, `.webp` | High-fidelity raster manipulation, Euclidean color-distance edge-aware background removal, transparent PNG export, solid color & gradient background replacement, adjustments (brightness, contrast, saturation, blur, grayscale, sepia, invert), text overlays, watermarks, sticker badges, A4 PDF export | HTML5 Canvas, `pdf-lib` |
| **OCR Scanner** | Images (`.png`, `.jpg`, `.webp`) & Scanned PDFs | Multilingual text recognition (English, Spanish, French, German, Italian), side-by-side proofreading view, confidence scoring, 1-click send to Word Studio, export to Searchable PDF, DOCX, TXT | `tesseract.js`, `docx`, `pdf-lib` |
| **Starter Templates Gallery** | `.docx`, `.pptx`, `.xlsx`, `.png` | Curated professional presets: Executive Business Proposal, Senior Software Engineer CV, Startup Investor Pitch Deck, Financial Analysis & Budget, Product Launch Graphic | `templatesData.ts` |
| **Projects & History** | All Stored Types | Offline-first local project storage, project categorization by type, update timestamps, memory footprint calculator, full conversion history audit log, JSON backup export, permanent data purge | `storageService.ts` |
| **User & Billing Portal** | SaaS Workspace | User profile management, role identification (User / Administrator), plan tiers (Free, Starter, Pro, Enterprise), storage quota tracking, feature entitlement checks, billing ledger | `storageService.ts` |
| **Administrator Console** | Enterprise Management | System telemetry, engine status monitoring, conversion error log inspection, capacity utilization gauges, audit log stream | Admin Services |

---

## 2. Multi-Format Conversion Compatibility Matrix

The matrix below documents the exact verified input/output conversion routes:

| Input \ Output | PDF | DOCX | PPTX | XLSX | CSV | PNG | JPG | WebP | TXT | HTML | MD |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **PDF** | — | ✅ Full Text | ✅ Slides Deck | ⚠️ Text Table | ⚠️ Text CSV | ✅ High-DPI | ✅ High-DPI | ✅ Via Canvas | ✅ Raw Text | ✅ Styled | ✅ Markdown |
| **DOCX** | ✅ Standard A4 | — | ⚠️ Summary | ❌ | ❌ | ✅ Via PDF | ✅ Via PDF | ✅ Via PDF | ✅ Extracted | ✅ Semantic | ✅ Markdown |
| **PPTX** | ✅ 16:9 Deck | ⚠️ Outline | — | ❌ | ❌ | ✅ Slide Images | ✅ Slide Images | ✅ Via Canvas | ✅ Speaker Notes | ⚠️ Outline | ⚠️ Outline |
| **XLSX** | ✅ Table Report | ⚠️ Data Table | ❌ | — | ✅ Full CSV | ❌ | ❌ | ❌ | ✅ Delimited | ✅ Table HTML | ⚠️ Markdown Table |
| **CSV** | ✅ Table Report | ⚠️ Data Table | ❌ | ✅ OpenXML | — | ❌ | ❌ | ❌ | ✅ Plain Text | ✅ Table HTML | ⚠️ Markdown Table |
| **PNG** | ✅ Image Embed | ⚠️ Embedded | ⚠️ Embedded | ❌ | ❌ | — | ✅ Transcode | ✅ Transcode | ✅ Via OCR | ❌ | ❌ |
| **JPG** | ✅ Image Embed | ⚠️ Embedded | ⚠️ Embedded | ❌ | ❌ | ✅ Transcode | — | ✅ Transcode | ✅ Via OCR | ❌ | ❌ |
| **WebP** | ✅ Image Embed | ⚠️ Embedded | ⚠️ Embedded | ❌ | ❌ | ✅ Transcode | ✅ Transcode | — | ✅ Via OCR | ❌ | ❌ |
| **TXT** | ✅ Standard A4 | ✅ Word Doc | ⚠️ Text Deck | ❌ | ⚠️ CSV Lines | ❌ | ❌ | ❌ | — | ✅ HTML Doc | ✅ Markdown |
| **HTML** | ✅ Formatted A4 | ✅ Word Doc | ❌ | ⚠️ Tables | ⚠️ Tables | ❌ | ❌ | ❌ | ✅ Strip Tags | — | ✅ Markdown |
| **MD** | ✅ Formatted A4 | ✅ Word Doc | ⚠️ Text Deck | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Raw Text | ✅ Rendered | — |

**Legend**:
- ✅ **Fully Supported & Verified**: Native conversion engine handles layout, structures, and content fidelity.
- ⚠️ **Supported with Text/Structure Extraction**: Converts textual, tabular, or raster contents with simplified styling.
- ❌ **Incompatible / Unsupported**: Fundamentally incompatible data models (e.g. raster graphics to spreadsheet cells). Excluded from selection dropdowns to prevent user errors.

---

## 3. Plan & Quota Entitlements Matrix

| Feature / Limit | Free Explorer | Starter Pro | Enterprise Elite |
|---|---|---|---|
| **Max Single File Size** | 25 MB | 100 MB | 500 MB |
| **Max Concurrent Queue Items** | 3 files | 15 files | Unlimited (50+) |
| **OCR Text Extraction** | 5 pages / session | Unlimited | Unlimited + Batch |
| **Background Removal Quality** | Standard (35 tolerance) | High-Res + Custom Feathering | Ultra-HD + Presets |
| **Offline Project Storage** | 25 MB | 100 MB | 500 MB (IndexedDB) |
| **ZIP Batch Download** | Up to 5 files | Unlimited | Unlimited |
| **Digital Signature Stamps** | Yes | Yes | Yes (Vector + SVG) |
| **Redaction Tool** | Standard Blackout | Standard Blackout | True Redaction + Metadata Purge |
| **Admin Console Access** | No | Optional | Full Telemetry & Audit Logs |
