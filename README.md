# OmniDoc Studio — Convert, Edit & Create Any Document

> **"Every file. Every format. One workspace."**

OmniDoc Studio is an all-in-one, production-ready document and image platform. It unites a comprehensive document converter, full PDF editor, Word document processor, PowerPoint slide builder, spreadsheet data engine, photo/graphics editor with AI background removal, and client-side OCR scanner into a single, unified workspace.

---

## 🌟 Key Features & Dedicated Workspaces

### 1. 🔄 Universal Conversion Hub
- **Multi-Format Matrix**: Real conversion paths between **PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG, WebP, Markdown, and TXT**.
- **Batch Processing**: Convert multiple heterogeneous files in one queue with real-time progress indicators.
- **1-Click ZIP Packaging**: Automatically packages multi-page and batch conversions into a compressed `.zip` archive via `jszip`.
- **Conversion Controls**: Image quality slider (40% to 100%), page orientation (Portrait / Landscape), and OCR language selection.

### 2. 📑 Complete PDF Studio
- **Viewing & Navigation**: High-resolution rendering using `pdfjs-dist` with multi-level zoom (50% to 250%) and page thumbnails.
- **Page Manipulation**: Rotate pages (90° CW), duplicate pages, reorder pages, and delete pages via `pdf-lib`.
- **Split & Merge**: Extract custom page ranges into standalone PDFs or merge multiple external PDFs.
- **Annotations & Content Overlay**: Add draggable text boxes, translucent highlighter blocks, custom watermarks, and automated page numbers.
- **True Redaction**: Burns true black redaction rectangles over sensitive content before export.
- **Interactive Digital Signature Pad**: Draw your signature directly with touch/mouse on a canvas and embed it as a high-res transparent digital signature stamp.

### 3. 📝 Word Document Studio (DOCX)
- **Rich Document Toolbar**: Headings (H1, H2, H3), Paragraph formatting, Bold, Italic, Bullet lists, and Table creation.
- **Find & Replace**: Real-time search with match highlight and replace-all capability.
- **Document Statistics**: Live word count, character count, and estimated reading time.
- **Import & Multi-Format Export**: Open existing `.docx` or `.txt` files; export to OpenXML compliant `.docx`, `.pdf`, `.txt`, and semantic `.html`.

### 4. 📊 PowerPoint Studio (PPTX 16:9)
- **Slide Deck Builder**: Slide strip on the left with Add Slide, Duplicate, Delete, and Reorder (Up / Down) controls.
- **Themes & Palettes**: Curated color palettes (Dark Navy, Deep Indigo, Executive Emerald, Minimal Slate, Midnight).
- **Presentation Mode**: Fullscreen slideshow presentation mode with Next/Previous slide controls and keyboard navigation.
- **Real Export**: Generates true PowerPoint `.pptx` files using `pptxgenjs` and multi-page presentation `.pdf` files.

### 5. 📈 Spreadsheet Studio (XLSX & CSV)
- **Tabular Data Grid**: Interactive cells with column headers (A, B, C...) and row numbers.
- **Formula Engine**: Evaluates standard uppercase spreadsheet functions:
  - `=SUM(A1:A5)`
  - `=AVERAGE(A1:A5)`
  - `=MIN(A1:A5)`
  - `=MAX(A1:A5)`
  - `=COUNT(A1:A5)`
  - Arithmetic expressions e.g. `=(A1+B1)*1.2`
- **Import / Export**: Parse `.xlsx` and `.csv` files via SheetJS; export directly to `.xlsx`, `.csv`, or formatted PDF table reports.

### 6. 🎨 Photo & Graphics Studio
- **Canvas Image Engine**: High-fidelity client-side raster manipulation for PNG, JPG, and WebP.
- **Smart Background Remover**: Edge-aware Euclidean color distance segmentation with alpha feathering that produces instant transparent PNGs locally in browser RAM without cloud uploads.
- **Background Replacement**: Swap transparent backgrounds with Solid White, Black, or Sunset gradients.
- **Adjustments Panel**: Live sliders for Brightness, Contrast, Saturation, Grayscale, Blur, and Sepia.
- **Overlays & Layers**: Draggable text overlays, watermarks, and customizable sticker badges.
- **Multi-Format Export**: Download as `.png` (with transparency), `.jpg`, `.webp`, or convert to an A4 PDF.

### 7. 🔍 OCR Scanner (Tesseract.js)
- **Text Extraction**: Recognizes text from scanned PDFs, photographs, certificates, invoices, and handwritten notes.
- **Multi-Language Support**: English, Spanish, French, German, and Italian models.
- **Side-by-Side Proofreading**: Inspect original image on the left; edit and correct recognized text on the right with a real-time confidence score.
- **1-Click Send**: Send recognized text directly into Word Document Studio, or export as Searchable PDF, DOCX, or TXT.

### 8. 📚 Starter Templates Gallery
- **Ready-to-use Presets**:
  - *Executive Business Proposal* (opens in Word Studio)
  - *Senior Software Engineer CV* (opens in Word Studio)
  - *Startup Investor Pitch Deck* (opens in PowerPoint Studio)
  - *Financial Invoice & Balance Sheet* (opens in Spreadsheet Studio)
  - *Product Launch Social Graphic* (opens in Image Studio)

### 9. 🛡️ Privacy, Projects & History
- **100% Client-Side Architecture**: Sensitive files are processed locally in RAM; zero document data is leaked to external servers.
- **Local Persistence**: Save projects and version snapshots to browser IndexedDB / LocalStorage.
- **Data Export & Danger Zone**: Export your entire project collection as a JSON backup or permanently purge all local memory in one click.

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
cd omnidoc-studio
npm install
```

### Running Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Automated Tests
```bash
npm test
```

### Production Build & Typecheck
```bash
npm run build
npm run preview
```

---

## 🧪 Automated Testing
OmniDoc Studio includes automated tests covering:
- Format detection & magic byte identification (`src/tests/converter.test.ts`)
- Human-readable file size calculations
- Spreadsheet formula evaluation (`SUM`, `AVERAGE`, `MIN`, `MAX`, arithmetic substitutions)
- Bidirectional spreadsheet column letter-to-index conversions (`A` <-> `0`, `Z` <-> `25`, `AA` <-> `26`)

---

## 🔒 Security & Privacy Notice
- OmniDoc Studio processes documents, presentations, spreadsheets, and photos entirely inside client-side WebAssembly, Canvas, and browser memory.
- No documents are sent to external third-party training pipelines.
- Temporary blobs and object URLs are revoked upon download or component unmount to prevent browser memory leaks.
