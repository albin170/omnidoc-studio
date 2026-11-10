# OmniDoc Studio — Complete Source Code & Infrastructure Audit Findings

## Executive Summary
This document details the comprehensive security, architectural, and operational audit performed on **OmniDoc Studio 2.0** during the migration from Render to Google Cloud Run, Supabase PostgreSQL, and Supabase Storage.

---

## 1. High-Priority Issues & Bugs Identified

### Bug 1: Hardcoded Secrets in Deployment and Migration Files
- **Severity:** Critical (P0)
- **Files Affected:** `cloudrun.yaml`, `render.yaml`, `scripts/deploy_cloudrun.ps1`, `scripts/deploy_cloudrun.sh`, `scripts/migrate_local_files_to_supabase.py`
- **Root Cause:** Plaintext PostgreSQL pooler credentials (`postgresql+asyncpg://postgres.kflqymlcrtqepwjeulpb:...@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`), Supabase service role keys, and application `SECRET_KEY` values were committed directly in source control.
- **Remediation:** Removed all hardcoded secrets; converted `cloudrun.yaml` to reference GCP Secret Manager via `secretKeyRef`; updated scripts to mandate environment variables; updated `.gitignore` and `.env.example`; removed obsolete `render.yaml`.

### Bug 2: Database Session Double-Yield in `get_db()`
- **Severity:** Critical (P0)
- **File Affected:** `backend/app/core/database.py` (lines 66–78)
- **Root Cause:** The async generator contained two consecutive `yield session` statements inside separate try/finally blocks:
  ```python
  async with AsyncSessionLocal() as session:
      try:
          yield session
      finally:
          await session.close()
      try:
          yield session
          await session.commit()
  ```
  After the first consumer finished, `await session.close()` ran, followed immediately by yielding a closed session.
- **Remediation:** Standardized `get_db()` to a single `yield session` per request lifecycle with automatic rollback on exception and guaranteed session closure in `finally`. Added pool pre-ping, 1800s connection recycling, and SSL enforcement.

### Bug 3: Supabase Storage Provider Ignored in `storage.py`
- **Severity:** High (P1)
- **File Affected:** `backend/app/services/storage.py`
- **Root Cause:** The `StorageVaultService` implementation only verified `if self.is_s3_enabled:`. When `STORAGE_PROVIDER=supabase`, it silently fell through to local filesystem writes (`open(temp_path, "wb")`). On ephemeral containers (Cloud Run, Vercel Serverless), documents saved to the ephemeral local filesystem were lost upon instance shutdown.
- **Remediation:** Implemented `SupabaseStorageAdapter` with tenant isolation (`{org_id}/{doc_id}/{filename}`), retry with exponential backoff, SHA-256 integrity verification, signed URL generation, and an explicit fail-closed safety assertion in production.

### Bug 4: Database Migrations Running on Every Cloud Run Instance Startup
- **Severity:** High (P1)
- **File Affected:** `Dockerfile` (line 25)
- **Root Cause:** Container CMD executed `sh -c "python -m alembic upgrade head && uvicorn ..."`. When Cloud Run autoscaled to multiple instances simultaneously, concurrent Alembic migration locks caused deployment deadlocks and transient 500 errors.
- **Remediation:** Removed Alembic from container `CMD`; created `scripts/run_migrations.py` to run migrations strictly as a controlled pre-release deployment operation; updated container entrypoint to `exec uvicorn` for proper PID 1 signal handling.

### Bug 5: Obsolete Vercel API Routing
- **Severity:** Medium (P2)
- **Files Affected:** `vercel.json`, `api/index.py`
- **Root Cause:** `vercel.json` rewrote `/api/v1/:path*` to `/api/index.py`. In the target decoupled architecture, Vercel hosts the React Vite SPA, while Google Cloud Run serves the FastAPI backend.
- **Remediation:** Removed obsolete `api/index.py`; configured `vercel.json` with pure Vite SPA fallback routing; updated SDK and frontend components to use `VITE_API_URL`.

### Bug 6: Stripe Payment Dependencies in Free-Tier Mode
- **Severity:** Medium (P2)
- **Files Affected:** `backend/app/core/config.py`, `backend/app/services/billing_service.py`, `PricingPage.tsx`, `UserPanel.tsx`
- **Root Cause:** Potential startup dependency on Stripe API keys even when payment processing is out of scope.
- **Remediation:** Added `ENABLE_STRIPE=false` default feature flag; made billing service fail closed gracefully with 503 informative notices; updated frontend to display free Community plan status and disable card checkout actions.

---

## 2. Test Verification Matrix

| Test Suite | Tests Total | Result | Execution Time |
| :--- | :---: | :---: | :---: |
| Backend Pytest (`backend/tests/`) | 39 | **39 Passed (100%)** | 42.40s |
| Frontend Vitest (`src/tests/`) | 117 | **117 Passed (100%)** | 11.81s |
| Frontend Production Build (`tsc -b && vite build`) | — | **Success (0 errors)** | 2.12s |
| Live Production Deployment (`omnidoc-studio-jet.vercel.app`) | 6 | **6 Verified (100%)** | ~8.0s |
