# OMNIDOC STUDIO — MASTER UPGRADE & IMPLEMENTATION PLAN

**Target**: Comprehensive Debugging, Feature Completion, Security Hardening & Production Release  
**Execution Strategy**: Phased, incremental delivery with automated verification at every step  

---

## Phase Breakdown & Milestone Schedule

### Phase 1: Repository Audit & Baseline Verification (Completed)
- [x] Map project architecture, dependencies, routes, and components.
- [x] Run baseline build (`tsc -b && vite build`) and unit tests (`vitest run`).
- [x] Run baseline linter (`oxlint`) and catalog all 99 warnings.
- [x] Create `AUDIT_REPORT.md`, `BUG_REGISTRY.md`, `FEATURE_MATRIX.md`, and `IMPLEMENTATION_PLAN.md`.

---

### Phase 2: Systematic Debugging & Core Engine Repair
- [ ] **Fix BUG-001 (Conversion Pipeline Gaps)**:
  - Add missing handlers in `src/services/converter.ts` for PPTX, PDF->PPTX, XLSX->HTML, CSV->TXT, MD/HTML conversions.
  - Align `allowedConversions` in `src/services/formatDetector.ts` to match real implementations.
- [ ] **Fix BUG-002 (Conversion History Never Recorded)**:
  - Call `addConversionHistoryItem()` upon job completion in `src/components/converter/ConversionHub.tsx`.
  - Connect history stream updates directly into `Dashboard.tsx` and `ProjectsManager.tsx`.
- [ ] **Fix BUG-003 (Missing Save Buttons in PDF & Image Studios)**:
  - Add "Save Project" button in `PdfStudio.tsx` header to persist annotations and state to `onSaveToProjects`.
  - Add "Save Project" button in `ImageStudio.tsx` header to persist edited images to `onSaveToProjects`.
- [ ] **Fix BUG-004 (Settings Tab Routing Glitch)**:
  - Implement a dedicated Settings & Privacy management view for `activeTab === 'settings'` or open UserPanel on the Settings tab.
- [ ] **Fix BUG-005 (Global Keyboard Shortcuts)**:
  - Implement `Ctrl+S` / `Cmd+S` interceptor in `App.tsx` to save the active studio document without opening browser HTML save dialogs.
- [ ] **Fix BUG-007 (Linter Warnings & React Warnings)**:
  - Clean up unused imports, resolve synchronous `setState` inside `useEffect`, fix `loadFile` declaration order in `PdfStudio.tsx`, and export hooks safely.

---

### Phase 3: Reliable Document Processing Core Upgrade
- [ ] Enforce job validation, cancellation states, progress reporting, and detailed error mapping in `ConversionHub.tsx`.
- [ ] Ensure automatic Blob URL cleanup (`URL.revokeObjectURL`) to eliminate client memory leaks during batch operations.
- [ ] Add conversion retry logic for failed jobs.

---

### Phase 4: Office, PDF & Image Tools Polish
- [ ] Enhance PDF Studio with page numbering, thumbnail jumping, and smooth rotation.
- [ ] Ensure PPTX Studio exports clean multi-slide `.pptx` decks and PDF slide decks.
- [ ] Verify Spreadsheet Studio formula calculation and tabular PDF reports.
- [ ] Enhance Photo Studio smart background removal and transparent PNG export.
- [ ] Enhance OCR Studio with text copy, export to DOCX/PDF/TXT, and confidence indicators.

---

### Phase 5: User Workspace & Offline-First Persistence
- [ ] Expand `storageService.ts` to manage user roles (`user`, `admin`, `guest`), custom preferences, and project tags/search.
- [ ] Add project search and filter by type in `ProjectsManager.tsx`.
- [ ] Add JSON backup import and export for user peace of mind.

---

### Phase 6: Subscriptions, Tiers & Quota Management
- [ ] Build a robust client-side plan and quota enforcement system:
  - **Free Explorer**: 25 MB max file size, 3 files concurrent queue.
  - **Starter Pro**: 100 MB max file size, 15 files queue, full OCR.
  - **Enterprise Elite**: 500 MB max file size, unlimited queue, priority WebAssembly threads.
- [ ] Provide an interactive Plan Upgrade / Pricing modal with transparent billing cycles (Monthly / Annual).
- [ ] Enforce real file size and queue limits based on the active plan tier.

---

### Phase 7: Secure Administrator Console
- [ ] Create an Administrator Console workspace (`activeTab === 'admin'`):
  - Real-time system health metrics (WebAssembly status, Worker pool, Memory usage).
  - Telemetry for conversion throughput, format popularity, and failure rates.
  - Recent audit log stream recording user actions and security events.
  - Ability to toggle features and view error logs.
- [ ] Add role toggle in user session (`ADMIN` vs `USER`) with role-based access guards.

---

### Phase 8: File Security & Memory Safety
- [ ] Validate file magic bytes against extension spoofing.
- [ ] Enforce maximum file size guards before reading buffers into RAM.
- [ ] Guarantee temporary object URLs are properly revoked.
- [ ] Ensure sensitive files are never dispatched to external third parties.

---

### Phase 9: UI/UX & Responsive Optimization
- [ ] Verify responsive layout across mobile, tablet, and desktop viewports.
- [ ] Ensure accessible keyboard focus and contrast ratios across dark navy and glassmorphic cards.
- [ ] Clean up redundant code in `Header.tsx` or integrate top-level breadcrumb controls.

---

### Phase 10: Automated Testing & Verification
- [ ] Expand Vitest test suite (`src/tests/`):
  - Format detection tests (magic bytes & edge cases).
  - Formula engine tests (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, complex arithmetic).
  - Conversion pipeline tests (TXT->PDF, DOCX->PDF, XLSX->CSV, CSV->XLSX, etc.).
  - Storage service tests (save, load, delete, history, purge).
  - Quota and plan tier enforcement tests.
- [ ] Ensure 100% test pass rate with clean test output.

---

### Phase 11: Production Build & Bundle Optimization
- [ ] Configure `vite.config.ts` manual chunks to split monolithic vendor libraries into separate chunks.
- [ ] Verify `npm run build` succeeds without warning of chunks > 500 kB.
- [ ] Verify `npm run lint` finishes with 0 errors and clean output.
