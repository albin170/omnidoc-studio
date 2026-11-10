# OmniDoc Studio — Enterprise Document Intelligence Platform

> **"Every file. Every format. One workspace."**

OmniDoc Studio is an all-in-one, production-grade document and image engineering SaaS platform. It unites an autonomous document converter, full PDF editor, Word document processor, PowerPoint slide builder, spreadsheet data engine, photo/graphics editor with AI background removal, client-side OCR scanner, cryptographic document verification, and cloud-native document vaults into a single, unified workspace.

**Production Frontend**: [https://omnidoc-studio-jet.vercel.app](https://omnidoc-studio-jet.vercel.app)

---

## 🏛️ Production Architecture

```
                  ┌─────────────────────────────────────────┐
                  │          OmniDoc Client Browser          │
                  │       (React 19 + TypeScript + Vite)     │
                  └────────────────────┬────────────────────┘
                                       │ HTTPS / WSS
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                 API Routing / Edge Layer                    │
        │                                                             │
        │  • Direct /api/v1/*   ──► Vercel Serverless (api/index.py)  │
        │  • Custom Backend URL ──► Google Cloud Run Container        │
        └──────────────┬──────────────────────────────┬───────────────┘
                       │                              │
                       ▼                              ▼
        ┌──────────────────────────────┐┌─────────────────────────────┐
        │   FastAPI Core Services      ││   Supabase Cloud Services   │
        │  • JWT Auth & RBAC           ││                             │
        │  • Multi-Tenant Isolation    ││  • PostgreSQL (17.11 Pooler)│
        │  • HMAC Signed Downloads     ││  • Private Storage Buckets  │
        │  • Health & Metrics Probes   ││  • Row-Level Security       │
        └──────────────────────────────┘└─────────────────────────────┘
```

- **Frontend**: Vercel (React 19 + TypeScript + Tailwind CSS + Lucide Icons + Vite)
- **Backend (Dual Deployment Ready)**:
  - **Vercel Serverless Function** (`api/index.py` via Python WSGI/ASGI): Zero-cold-start single-domain hosting on Vercel.
  - **Google Cloud Run** (`Dockerfile` + `cloudrun.yaml`): High-concurrency container deployment with autoscaling (0–10 instances).
- **Database**: Supabase PostgreSQL 17.11 with SSL (`sslmode=require`), async connection pooling, and Alembic migrations decoupled from container startup.
- **File Storage**: Supabase Storage (`documents` private bucket) with tenant isolation path prefixing (`{org_id}/{doc_id}/{filename}`) and tamper-resistant HMAC-SHA256 signed download URLs.
- **Authentication**: FastAPI JWT authentication with tenant/organization context, role-based access control (`superadmin`, `admin`, `user`), and password hashing with bcrypt/argon2.
- **Payments**: Stripe completely disabled (`ENABLE_STRIPE=false`) for sovereign zero-cost community and enterprise deployments.

---

## 🌟 Key Workspaces & Capabilities

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
- **Formula Engine**: Evaluates standard uppercase spreadsheet functions: `=SUM(A1:A5)`, `=AVERAGE(A1:A5)`, `=MIN(A1:A5)`, `=MAX(A1:A5)`, `=COUNT(A1:A5)`, arithmetic expressions e.g. `=(A1+B1)*1.2`.
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
- Ready-to-use presets: *Executive Business Proposal*, *Senior Software Engineer CV*, *Startup Investor Pitch Deck*, *Financial Invoice & Balance Sheet*, *Product Launch Social Graphic*.

---

## 🔒 Security, Session Management & Universal Logout

- **Universal Logout Controls**:
  - Accessible directly on the top header bar of the main Dashboard.
  - Present on the studio breadcrumb bar across all active editors (PDF, Word, Slides, Sheets, Image, etc.).
  - Prominently anchored in the persistent footer of the Account & Studio Panel across every tab (`profile`, `plan`, `security`, `api`).
  - Available on mobile navigation headers and collapsed sidebar state.
- **Tenant Isolation**: Files and database queries are strictly scoped to the user's `organization_id`.
- **Private Buckets**: Supabase Storage buckets are private; unauthenticated direct access is completely blocked.
- **HMAC Signed URLs**: Time-limited download URLs signed with backend secret, preventing token tampering or URL spoofing.
- **Zero Secrets Committed**: All credentials removed from git, deployment YAMLs, and migration scripts. Fully managed through environment variables and Secret Managers.

---

## 📖 Operational Runbooks & Documentation

The repository includes complete production engineering runbooks in the project root:

| Runbook | Description |
| :--- | :--- |
| [`AUDIT_FINDINGS.md`](./AUDIT_FINDINGS.md) | Comprehensive audit of architecture, credentials, storage, and database lifecycle |
| [`SECURITY_REMEDIATION.md`](./SECURITY_REMEDIATION.md) | Credential rotation, secret manager mapping, and BFG history purge instructions |
| [`SUPABASE_STORAGE_SETUP.md`](./SUPABASE_STORAGE_SETUP.md) | Bucket creation, RLS policies, CORS, and adapter configuration |
| [`DATABASE_MIGRATION.md`](./DATABASE_MIGRATION.md) | Safe migration procedures, export/import scripts, and checksum validation |
| [`CLOUD_RUN_DEPLOYMENT.md`](./CLOUD_RUN_DEPLOYMENT.md) | Google Cloud Run container deployment, gcloud commands, and Secret Manager bindings |
| [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) | Automated PostgreSQL dumps, GCS/S3 sync, and point-in-time recovery |
| [`ROLLBACK_PLAN.md`](./ROLLBACK_PLAN.md) | Instant Cloud Run revision traffic rollback and database migration reversal |
| [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) | Pre-flight and post-deployment verification checklist |

---

## 🚀 Quick Start & Local Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Python >= 3.11

### 1. Frontend Setup
```bash
cd omnidoc-studio
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Linux/macOS:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

pip install -r requirements.txt
cp ../.env.example ../.env  # configure your Supabase credentials
uvicorn app.main:app --reload --port 8000
```

### 3. Database Schema Migration
Migrations are decoupled from container boot to prevent race conditions during autoscaling:
```bash
python scripts/run_migrations.py
```

---

## 🧪 Automated Testing

### Frontend Test Suite (117 Vitest tests)
```bash
npm test -- --run
```
Covers:
- Studio upgrades & conversion cancellations (`AbortController`)
- PDF sanitization & destructive redaction
- Sheet formula evaluation & column coordinate conversions
- File validation, storage error resilience, and quota enforcement

### Backend Test Suite (39 Pytest tests)
```bash
python -m pytest backend/tests -v
```
Covers:
- Supabase storage adapter integration & path traversal prevention
- Session management, rollback, and connection cleanup
- Password change & token revocation
- Admin view-as-user isolation and RBAC checks
- Database backup and restore utilities

---

## 🚢 Deploying to Production

### Deploying to Vercel (Frontend & Serverless API)
OmniDoc Studio is pre-configured with `vercel.json`:
```bash
npx vercel --prod
```

### Deploying to Google Cloud Run (Container Backend)
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/omnidoc-backend:latest .
gcloud run deploy omnidoc-backend \
  --image gcr.io/$PROJECT_ID/omnidoc-backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
See [`CLOUD_RUN_DEPLOYMENT.md`](./CLOUD_RUN_DEPLOYMENT.md) for full Secret Manager bindings and flags.

