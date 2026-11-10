# OmniDoc Studio — Google Cloud Run Production Deployment Guide

## 1. Architecture Overview
- **Service Name:** `omnidoc-backend`
- **Region:** `us-central1` (or desired GCP region)
- **Runtime:** Python 3.11 Slim container
- **Concurrency:** 80 requests per container instance
- **Auto-scaling:** Min instances 0 (scale-to-zero for zero idle cost), Max instances 5
- **CPU / Memory:** 1 vCPU, 512 MiB RAM
- **Ingress:** All (Public internet via HTTPS)

---

## 2. Prerequisites
1. Google Cloud CLI (`gcloud`) installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. Enable required GCP services:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
   ```

---

## 3. Secret Manager Setup (Recommended)
Store your production secrets in GCP Secret Manager:
```bash
echo -n "your_database_pooler_url" | gcloud secrets create omnidoc-database-url --data-file=-
echo -n "your_32_char_secret_key" | gcloud secrets create omnidoc-secret-key --data-file=-
echo -n "https://yourref.supabase.co" | gcloud secrets create omnidoc-supabase-url --data-file=-
echo -n "your_supabase_service_role_key" | gcloud secrets create omnidoc-supabase-service-role-key --data-file=-
```

---

## 4. Production Deployment Sequence

### Step 1: Pre-Release Database Migrations
Always run database migrations prior to deploying a new application revision:
```bash
export DATABASE_URL="postgresql+asyncpg://postgres.yourref:pass@aws-1-region.pooler.supabase.com:5432/postgres"
python scripts/run_migrations.py
```

### Step 2: Deploy Container to Cloud Run
Using PowerShell:
```powershell
$env:DATABASE_URL = "postgresql+asyncpg://postgres.yourref:pass@aws-1-region.pooler.supabase.com:5432/postgres"
$env:SECRET_KEY = "your_secure_secret_key"
$env:SUPABASE_URL = "https://yourref.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key"

.\scripts\deploy_cloudrun.ps1 -ProjectId YOUR_PROJECT_ID -Region us-central1
```

Using Bash:
```bash
export DATABASE_URL="postgresql+asyncpg://postgres.yourref:pass@aws-1-region.pooler.supabase.com:5432/postgres"
export SECRET_KEY="your_secure_secret_key"
export SUPABASE_URL="https://yourref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

./scripts/deploy_cloudrun.sh
```

---

## 5. Post-Deployment Verification
1. Liveness Probe:
   ```bash
   curl -I https://YOUR_SERVICE_URL/health
   # Returns: HTTP/2 200 OK {"status": "ok", "service": "omnidoc-backend"}
   ```
2. Readiness Probe (Checks PostgreSQL and Redis):
   ```bash
   curl https://YOUR_SERVICE_URL/api/v1/ready
   # Returns: {"status": "ready", "database": "up", "redis": "not_configured"}
   ```
3. Update Vercel Frontend:
   Set `VITE_API_URL=https://YOUR_SERVICE_URL/api/v1` in Vercel project environment variables.
