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

## Test Verification Baseline
- **Frontend Test Suite (Vitest)**: 84/84 tests passed across 9 test suites.
- **Backend Test Suite (Pytest)**: 6/6 tests passed (100%).
- **TypeScript & Production Build**: 0 errors.
