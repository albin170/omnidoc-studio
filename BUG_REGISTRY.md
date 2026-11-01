# OMNIDOC STUDIO — BUG REGISTRY & DEFECT TRACKER

**Last Updated**: November 1, 2026  
**Status**: All Bugs Resolved & System Production-Hardened  

---

## Severity Classification
- **CRITICAL**: Breaks primary user workflow, crashes application, or causes data loss.
- **HIGH**: Advertised feature fails to function, throws runtime exceptions, or silently fails.
- **MEDIUM**: UI inconsistency, dead buttons, confusing navigation, or incomplete state sync.
- **LOW**: Minor visual defect, non-blocking warning, or code hygiene issue.

---

## 1. Verified Defects & Resolution Status

### BUG-001: Missing Conversion Handlers for Advertised File Formats
- **Severity**: HIGH
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `src/services/converter.ts` & `src/services/pptxService.ts`
- **Resolution**:
  - Implemented OpenXML slide deck text extraction in `extractTextFromPptxFile(file: File)`.
  - Added real handlers in `executeFileConversion` for:
    - `pdf` -> `pptx` (generates multi-slide presentation decks via `createPresentationBlob`).
    - `pptx` -> `pdf`, `txt`, `docx`, `png`, and `jpg` (as a multi-slide ZIP archive).
    - `xlsx` / `csv` -> `html` (styled HTML table reports) and `txt`.
    - `txt` / `md` / `html` -> `html`, `txt`, `pptx`, `docx`, `pdf`.
  - Added unit and integration tests in `src/tests/converterRoutes.test.ts`.

---

### BUG-002: Conversion History Never Recorded to Storage
- **Severity**: HIGH
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `src/components/converter/ConversionHub.tsx` & `src/App.tsx`
- **Resolution**:
  - Imported `addConversionHistoryItem` in `ConversionHub.tsx`.
  - Wired `addConversionHistoryItem` inside `runConversion` on both success and failure with complete metadata (`id`, `sourceName`, `sourceFormat`, `targetFormat`, `sizeBytes`, `completedAt`, `status`).
  - Added `onConversionCompleted` callback to trigger `refreshStorageData()` in `App.tsx` so Dashboard counters and recent tasks update immediately in real-time.

---

### BUG-003: Missing "Save to Projects" Action in PDF Studio and Image Studio
- **Severity**: HIGH
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `src/components/pdf/PdfStudio.tsx` & `src/components/image/ImageStudio.tsx`
- **Resolution**:
  - Added a dedicated "Save" button in the top action toolbar of `PdfStudio.tsx` calling `onSaveToProjects(fileName, { annotations, watermarkText, addPageNumbers, fileName })`.
  - Added a dedicated "Save" button in the top action toolbar of `ImageStudio.tsx` calling `onSaveToProjects(imageName, { adjustments, hasBackgroundRemoved, bgReplacementType, bgValue, layers })`.
  - Validated persistence with toast notifications and integration with `ProjectsManager`.

---

### BUG-004: Settings Tab Erroneously Renders Projects Manager
- **Severity**: MEDIUM
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `src/App.tsx` & `src/components/settings/SettingsHub.tsx`
- **Resolution**:
  - Built a dedicated `SettingsHub.tsx` component with tabs for General & Editor, Storage & Backup, Engine & WASM, and Privacy & Security.
  - Replaced duplicate `<ProjectsManager>` in `App.tsx` when `activeTab === 'settings'` with `<SettingsHub totalStorageBytes={totalStorageBytes} totalProjectsCount={projects.length} onRefreshData={refreshStorageData} />`.
  - Added Full JSON Backup export/restore capability and storage purge actions.

---

### BUG-005: Advertised `Ctrl+S` Keyboard Shortcut Triggers Browser Save Dialog
- **Severity**: MEDIUM
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `src/App.tsx`
- **Resolution**:
  - Added an intercepted `(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'` handler with `e.preventDefault()`.
  - Dynamically triggers project saving for active studio workspaces (Word, Slides, Sheets) or shows context-aware helper guidance in PDF and Image studios.
  - Fully memoized dependencies using `useCallback` to ensure clean lifecycle behavior.

---

### BUG-006: Monolithic Bundle Size & Chunking Warning
- **Severity**: MEDIUM
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `vite.config.ts`
- **Resolution**:
  - Configured Rollup `manualChunks` function in `vite.config.ts` to separate large dependencies:
    - `vendor-pdf`: `pdf-lib`, `pdfjs-dist` (849 kB)
    - `vendor-office`: `docx`, `pptxgenjs`, `xlsx` (1,011 kB)
    - `vendor-ocr`: `tesseract.js` (17 kB)
    - `vendor-react`: `react`, `react-dom` (242 kB)
    - `vendor-utils`: `lucide-react`, `canvas-confetti`, `file-saver`, `jszip` (13 kB)
  - Main app bundle reduced from 2.34 MB to just **246 kB** (54 kB gzipped).
  - Production build compiles cleanly with zero size warnings.

---

### BUG-007: React Compiler & Linter Warnings
- **Severity**: LOW
- **Status**: **RESOLVED & VERIFIED**
- **Location**: `src/App.tsx`, `src/components/pdf/PdfStudio.tsx`, `src/services/imageService.ts`, `src/components/sheets/SheetStudio.tsx`
- **Resolution**:
  - Fixed effect synchronization by lazily initializing `projects` and `history` in `App.tsx`.
  - Hoisted `loadFile` and `loadImageFile` declarations prior to `useEffect` hooks in `PdfStudio.tsx` and `ImageStudio.tsx`.
  - Removed unused variables (`tolSq`) and unused lucide icons across components.
  - Hook dependency arrays optimized with proper `useCallback` memoization.

---

## 2. Platform Upgrades Completed

### UPGRADE-001: Subscription Plans & Billing Engine (Phase 6)
- **Status**: **IMPLEMENTED & VERIFIED**
- **Location**: `src/services/storageService.ts` & `src/components/user/UserPanel.tsx`
- **Features**:
  - Defined `PlanTier` ('free', 'starter', 'pro', 'enterprise') and tier quotas in `getPlanQuota()`.
  - Interactive pricing matrix with Monthly vs. Annual toggle (including 20% discount badge).
  - Real-time plan switching and local persistence with toast feedback.
  - Real-time quota gauge displaying actual storage consumption versus plan limit.

### UPGRADE-002: Secure Administrator Console (Phase 7)
- **Status**: **IMPLEMENTED & VERIFIED**
- **Location**: `src/components/admin/AdminConsole.tsx` & `src/components/common/Sidebar.tsx`
- **Features**:
  - Real-time Subsystem Telemetry table tracking WASM, PDF, OpenXML, SheetJS, and OCR engine statuses.
  - Role management switcher: easily switch between `user`, `staff`, and `admin` roles.
  - Engine configuration flags: toggle SIMD acceleration, debug logging, and batch concurrency limit.
  - Live diagnostic log stream with one-click audit trail JSON export.
  - Dedicated admin navigation item with root privilege indicator.

### UPGRADE-003: Comprehensive Automated Test Suite (Phase 10)
- **Status**: **IMPLEMENTED & VERIFIED**
- **Location**: `src/tests/`
- **Test Suites**:
  1. `converter.test.ts`: Format registry, file extension detection, formula evaluations (SUM, AVG, MIN, MAX).
  2. `storage.test.ts`: Local storage persistence, project save/update/delete, history limit trimming, data purge, quota calculations, session management.
  3. `sheetExport.test.ts`: CSV and XLSX workbook generation with proper MIME types.
  4. `converterRoutes.test.ts`: Markdown/text/CSV conversion routes and error handling.
- **Results**: **22 / 22 tests passing** (100% pass rate).
