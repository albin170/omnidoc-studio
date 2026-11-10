# OmniDoc Studio — Production Go-Live Verification Checklist

## 1. Security & Credentials
- [x] All plaintext credentials removed from source control (`cloudrun.yaml`, `scripts/`, `render.yaml`).
- [x] Obsolete `render.yaml` deleted; Render dependencies eliminated.
- [x] Environment template `.env.example` verified with safe placeholders.
- [x] `.gitignore` verified to block `.env`, `.env.*`, `backups/`, and database dumps.
- [x] Credentials rotated in Supabase Dashboard (Service Role Key and DB Password).
- [x] High-entropy `SECRET_KEY` generated and provisioned.

---

## 2. Database (Supabase PostgreSQL)
- [x] Alembic migrations applied to head (`c92b84f1902e`).
- [x] Session pooler endpoint active: `aws-1-ap-southeast-1.pooler.supabase.com:5432`.
- [x] Database session generator in `backend/app/core/database.py` fixed to single-yield per request.
- [x] Connection pooling configured with `pool_pre_ping=True` and 1800s connection recycling.
- [x] Pre-release migration runner script `scripts/run_migrations.py` configured.

---

## 3. Storage (Supabase Storage)
- [x] Private `documents` bucket created.
- [x] `SupabaseStorageAdapter` implemented with strict tenant isolation (`{org_id}/{doc_id}/{filename}`).
- [x] Path traversal attacks (`..`, sibling-prefix traversal) blocked and verified with tests.
- [x] All 53 existing files migrated from local storage to Supabase Storage with SHA-256 match.
- [x] Document upload, download, and deletion verified live against Supabase Storage.
- [x] Tamper-resistant HMAC signed download URLs active and tested.
- [x] Ephemeral container filesystem fallback assertion active in production.

---

## 4. Compute & Hosting (Cloud Run & Vercel)
- [x] Root `Dockerfile` configured with Python 3.11-slim, PID 1 `exec uvicorn`, and no startup migrations.
- [x] Autoscaling configured (min 0, max 5, concurrency 80) for 100% zero-idle-cost operation.
- [x] Liveness (`/health`) and readiness (`/api/v1/ready`) endpoints active.
- [x] `vercel.json` updated with clean Vite SPA rewrite rules (`/index.html`).
- [x] Obsolete `/api/index.py` serverless proxy deleted.
- [x] CORS origins restricted to approved production URLs (`https://omnidoc-studio-jet.vercel.app`).

---

## 5. Billing & Gateways (Stripe Disablement)
- [x] `ENABLE_STRIPE=false` default configuration active.
- [x] Zero Stripe credentials required for backend startup.
- [x] Checkout sessions return clean 503 informative response.
- [x] Frontend billing UI displays active free Community plan status and disables card checkout buttons.
- [x] Database subscription schema preserved for future zero-downtime reactivation.

---

## 6. Testing & Quality Assurance
- [x] Backend pytest suite: **39 / 39 tests passed (100%)** in 42.40s.
- [x] Frontend Vitest suite: **117 / 117 tests passed (100%)** across 13 test files.
- [x] Frontend production bundle builds cleanly in 2.12s (`npm run build`).
- [x] Live end-to-end API verification on production:
  - Homepage: `200 OK`
  - Plans: `200 OK`
  - User Registration: `201 Created`
  - User Login: `200 OK`
  - Document Upload: `201 Created`
  - Document Download: `200 OK` (Byte-for-byte integrity verified)
