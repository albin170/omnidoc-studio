# OMNIDOC STUDIO — REPOSITORY AUDIT & BASELINE ASSESSMENT

**Date**: November 1, 2026  
**Repository**: `C:\Users\Dell\Documents\omnidoc-studio`  
**Production URL**: https://omnidoc-studio-jet.vercel.app/  
**Auditor**: Senior Full-Stack Software Architect, Application Security & QA Engineer  

---

## 1. Executive Summary

OmniDoc Studio is an all-in-one client-side document processing, editing, and conversion platform built with modern web technologies. Its core architecture processes documents directly in browser memory (WebAssembly, Web Workers, Canvas, Typed Arrays), offering data privacy without transmitting user files to untrusted third-party servers.

While the foundation is architected with modern libraries (`pdf-lib`, `pdfjs-dist`, `docx`, `pptxgenjs`, `xlsx`, `tesseract.js`), the baseline audit discovered critical conversion gaps, missing persistence hooks, unhandled routing states, and absent administrative/billing controls required for an enterprise-ready SaaS application.

---

## 2. Technology Stack & Environment Discovery

| Dimension | Specification | Notes / Audit Observation |
|---|---|---|
| **Frontend Framework** | React 19.3.1 (`react`, `react-dom`) | Modern concurrent React 19 |
| **Language & Tooling** | TypeScript 5.8 / ~7.0.2 (`tsc -b`) | Strict typing configured |
| **Build Tool & Bundler** | Vite 8.3.5 with `@vitejs/plugin-react` | Fast HMR and static build |
| **CSS Framework** | Tailwind CSS 4.3.3 (`@tailwindcss/vite`) | Modern CSS token engine |
| **Testing Harness** | Vitest 5.0.5 (`vitest run`) | Fast ESM unit testing |
| **Linter** | oxlint 1.89.0 (`oxlint`) | Ultra-fast Rust linter (99 warnings detected) |
| **Document Processing Engines** | `pdf-lib` 1.17.1, `pdfjs-dist` 6.4.299 | Vector PDF rendering & manipulation |
| **Word Processing Engine** | `docx` 9.15.0 | OpenXML Word `.docx` generator |
| **Presentation Engine** | `pptxgenjs` 4.0.1 | 16:9 PowerPoint `.pptx` generator |
| **Spreadsheet Engine** | `xlsx` (SheetJS) 0.18.5 | Tabular parsing, formula calculation & CSV/XLSX export |
| **OCR Engine** | `tesseract.js` 7.0.0 | Client-side WebAssembly Optical Character Recognition |
| **Archive Packaging** | `jszip` 3.10.2 | ZIP packaging for multi-page exports & batches |
| **File Export** | `file-saver` 2.0.5 | Native browser download streams |
| **Client Storage Provider** | Browser `localStorage` & in-memory Blob URLs | Local-first architecture |
| **Deployment Target** | Vercel (`vercel.json`) | Single-page application rewrite rules |

---

## 3. Project Structure Map

```text
C:\Users\Dell\Documents\omnidoc-studio\
├── .github/                       # CI/CD workflows
├── dist/                          # Production build output
├── public/                        # Static assets (favicons, icons)
├── src/
│   ├── assets/                    # Static SVG/PNG graphics
│   ├── components/
│   │   ├── auth/                  # AuthGateway login/signup & guest entry
│   │   ├── common/                # Navigation, Header, Sidebar, CommandPalette, Modals
│   │   ├── converter/             # Universal ConversionHub with batch queue
│   │   ├── dashboard/             # Main Dashboard, KPI sparklines & OnboardingBanner
│   │   ├── docx/                  # Word Document Studio (WYSIWYG & OpenXML export)
│   │   ├── image/                 # Photo Studio with AI background removal
│   │   ├── ocr/                   # Tesseract OCR scanner & side-by-side proofreader
│   │   ├── pdf/                   # PDF Studio (thumbnails, signatures, redaction)
│   │   ├── projects/              # ProjectsManager, History & Storage retention
│   │   ├── sheets/                # Spreadsheet Studio (cell grid & formula parser)
│   │   ├── slides/                # PowerPoint Studio (16:9 slides & presenter mode)
│   │   ├── templates/             # Starter templates gallery
│   │   └── user/                  # UserPanel, identity, storage quota & settings
│   ├── services/
│   │   ├── converter.ts           # Central multi-format conversion pipeline
│   │   ├── docxService.ts         # DOCX parser & builder
│   │   ├── formatDetector.ts      # Magic bytes & extension detector
│   │   ├── imageService.ts        # Canvas raster operations & background removal
│   │   ├── ocrService.ts          # Tesseract.js worker controller
│   │   ├── pdfService.ts          # PDF.js & pdf-lib vector operations
│   │   ├── pptxService.ts         # PowerPoint slide builder & PDF export
│   │   ├── sheetService.ts        # Formula engine & SheetJS parser
│   │   ├── storageService.ts      # LocalStorage & project persistence
│   │   ├── templatesData.ts       # Preset templates content
│   │   └── toastService.tsx       # Toast notifications provider
│   ├── tests/
│   │   └── converter.test.ts      # Existing Vitest test suite (8 tests)
│   ├── types/
│   │   └── index.ts               # Core TypeScript definitions & interfaces
│   ├── App.tsx                    # Root application component & workspace router
│   ├── main.tsx                   # React root mount
│   └── index.css                  # Global styles & glassmorphic tokens
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript compiler options
├── vercel.json                    # Vercel deployment configuration
└── vite.config.ts                 # Vite bundler configuration
```

---

## 4. Baseline Audit Findings

### 4.1 Build & Typecheck Baseline
- `npm run build` (`tsc -b && vite build`): **Passes with 0 errors**, but issues a warning about a monolithic chunk of **2,345 kB** (`dist/assets/index-av8aYH8p.js`), slowing down initial page loads on slower mobile networks.
- `npm test` (`vitest run`): **8 tests pass** in `src/tests/converter.test.ts`. Test coverage is limited to basic format detection and a few spreadsheet formulas.

### 4.2 Linter Baseline
- `npm run lint` (`oxlint`): **99 warnings, 0 errors**.
- Key issues identified:
  - 14 unused imports and variables (`tolSq` in `imageService.ts`, unused icon components).
  - Synchronous `setState` inside `useEffect` in `App.tsx:90`.
  - Self-referencing initialization in `PdfStudio.tsx:74` (`loadFile` invoked before declaration).
  - Non-component export in `toastService.tsx:90` breaking React fast refresh.

### 4.3 Functional & Architectural Defects
1. **Critical Conversion Pipeline Gaps**:
   - `FORMAT_REGISTRY` advertises conversions that throw unhandled exceptions in `executeFileConversion` (`converter.ts`):
     - PDF to PPTX
     - PPTX to PDF and PNG
     - XLSX to HTML
     - CSV to TXT
     - Markdown/HTML to TXT
   - Converting these formats leads directly to `Unsupported conversion route` runtime errors.
2. **Missing Persistence Hook**:
   - `addConversionHistoryItem()` is defined in `storageService.ts` but never called anywhere in the app upon conversion completion. Users' conversion history is never saved.
3. **Dead / Missing Action Handlers**:
   - `PdfStudio.tsx` and `ImageStudio.tsx` receive `onSaveToProjects` in their props, but render NO "Save to Projects" button in the UI.
   - `App.tsx` global hotkey listener advertises `Ctrl+S` in documentation, but lacks an event listener, causing standard browser save dialogs instead of saving projects.
   - `Settings` tab in `App.tsx` erroneously renders the `ProjectsManager` component instead of settings.
   - `Header.tsx` is completely unused / dead code.
4. **Subscription & Billing System**:
   - Currently absent: only static mock text in `UserPanel.tsx` declaring "Pro Plan: LIFETIME FREE" with fake hardcoded tokens. Real tier management, quota limits, checkout workflow, and billing history are missing.
5. **Admin Console & Role-Based Access Control**:
   - No administrative monitoring, job telemetry, error rate tracking, or user role distinction exists.

---

## 5. Security & Privacy Audit

1. **Client-Side Data Privacy**:
   - Excellent compliance with zero-server-upload principles. Documents are manipulated entirely inside browser memory (WebAssembly, Canvas, and TypedArray buffers).
2. **Blob Memory Leak Risks**:
   - Several components create `URL.createObjectURL(blob)` without calling `URL.revokeObjectURL(url)` upon unmount or replacement, leading to cumulative memory usage during large batch conversions.
3. **Local Encryption & Quota Safety**:
   - `localStorage` has a ~5–10MB browser limit. Saving large multi-page documents as base64 strings in `localStorage` can trigger `QuotaExceededError`. Structured persistence with IndexedDB or quota checks is essential.
4. **Formula Evaluation Security**:
   - `evaluateCellFormula` in `sheetService.ts` executes arithmetic expressions via `Function('return (' + substituted + ')')`. While protected by regex `/^[0-9+\-*/. ()]+$/`, it must strictly maintain safe parsing to prevent arbitrary code execution.

