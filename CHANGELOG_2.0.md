# OmniDoc Studio 2.0 — Autonomous Document Engineering Platform Changelog

## Architectural Overview
OmniDoc Studio 2.0 evolves from a standalone document converter/editor into a hybrid Autonomous Document Engineering Platform with:
1. **Server-Side Architecture (FastAPI)**: Pydantic v2 schemas, PostgreSQL/SQLite ORM (SQLAlchemy 2.0 async), Alembic migrations, secure bcrypt authentication, JWT sessions, and organization/tenant data isolation.
2. **Private Storage Vault**: Path-traversal defense, content-addressed SHA-256 integrity verification, and decompression bomb protection (75MB expansion limit).
3. **Canonical Document Digital Twin**: Hierarchical schema representing page structure, reading order sequence, paragraphs, tables, images, OCR confidence, and bounding box coordinates.
4. **Constrained Autonomous Agent**: Natural language objective decomposition, topological DAG cycle validation, explicit 10-tool typed registry, policy enforcement, and human-in-the-loop approval gates.
5. **Initial Autonomous Workflow (Invoice Intelligence Agent)**: Validates multiple invoice documents, extracts fields with coordinate bounding boxes, detects duplicates, flags missing/inferred/confirmed values, synthesizes an Excel reconciliation ledger, re-opens and mathematically verifies output files.
6. **Autonomous Workspace UI**: Interactive DAG execution plan viewer, human approval gate modal, side-by-side coordinate evidence canvas, processing mode selector (Private Local, Hybrid, Org Cloud), and verified verification receipts.

---

## Tool Registry Specifications
| Tool Name | Permissions | Description | Idempotent |
|---|---|---|---|
| `inspect_file` | `user` | Validates file signature, format consistency, and metadata without parsing body | Yes |
| `parse_document` | `user` | Parses document into canonical Document Digital Twin hierarchy | Yes |
| `extract_fields` | `user` | Extracts key-value fields with bounding-box evidence coordinates | Yes |
| `compare_documents` | `user` | Compares source and target documents for structural, textual, and visual differences | Yes |
| `find_duplicates` | `user` | Scans documents for identical content, duplicate invoices, or cross-document collisions | Yes |
| `convert_document` | `user` | Executes deterministic document conversion with verification check | Yes |
| `edit_document` | `user` | Applies controlled content transformations (redactions, watermarks, stamps) | Yes |
| `generate_report` | `user` | Generates executive Excel or Markdown intelligence report summarizing extraction | Yes |
| `verify_output` | `user` | Reopens generated document and verifies file integrity, table structure, and fields | Yes |
| `request_approval` | `user` | Pauses execution for explicit human-in-the-loop review on high-risk operations | No |

---

## Advanced Capabilities Implemented in Stage 2
1. **Cross-Document Duplicate & Contradiction Detection**:
   - `cross_doc_intelligence` service detects duplicate submissions (exact hash and near-duplicate Jaccard similarity) and identifies conflicting contract/invoice terms (e.g. mismatched VAT totals).
2. **Interactive Evidence Graph**:
   - Node-edge topology visualizing provenance connections from documents to extracted entities, claims, and contradictions.
3. **Semantic Document Search & Neural Query**:
   - BM25-scored term search across digital twin paragraphs, tables, and confirmed entity coordinates.
4. **Version Change Intelligence**:
   - Digital Twin diff engine computing paragraph, table, and field modifications with structural fidelity impact scores.
5. **Durable Execution & Checkpoint Recovery**:
   - Temporal-inspired state machine engine with exponential backoff retries, persistent step checkpoints, and idempotency key caching.
6. **Privacy Guardian & Verified Redaction Studio**:
   - True content sanitization eliminating underlying font glyphs, wiping document metadata, and verifying zero-leak status.
7. **Official Developer SDKs**:
   - Python SDK (`backend/sdk/omnidoc_sdk.py`) and TypeScript SDK (`src/sdk/omnidocClient.ts`).

---

## Test Verification Baseline
- **Frontend Test Suite (Vitest)**: 88/88 tests passed across 10 test suites.
- **Backend Test Suite (Pytest)**: 10/10 tests passed (100%).
- **TypeScript & Production Build**: 0 errors.

