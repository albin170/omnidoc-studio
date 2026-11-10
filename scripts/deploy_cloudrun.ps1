# Deploy OmniDoc Studio Backend to Google Cloud Run (PowerShell)
param (
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = "us-central1",
    [string]$ServiceName = "omnidoc-backend"
)

$ErrorActionPreference = "Stop"

if (-not $ProjectId) {
    $ProjectId = gcloud config get-value project 2>$null
}

if (-not $ProjectId) {
    Write-Error "Error: GCP_PROJECT_ID is not set and no active gcloud project found. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Deploying OmniDoc Studio to Google Cloud Run" -ForegroundColor Cyan
Write-Host "Project: $ProjectId"
Write-Host "Region:  $Region"
Write-Host "Service: $ServiceName"
Write-Host "==========================================================" -ForegroundColor Cyan

# Deploy directly from source
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5 `
    --concurrency 80 `
    --timeout 300 `
    --set-env-vars @"
ENVIRONMENT=production,
SECRET_KEY=omnidoc_prod_sec_key_d92f8a1103c8479e2bc91e7041a384f5_supabase_ready,
DATABASE_URL=postgresql+asyncpg://postgres:OmniDoc_Db_2026_SecureKey!@db.kflqymlcrtqepwjeulpb.supabase.co:5432/postgres,
STORAGE_PROVIDER=supabase,
SUPABASE_URL=https://kflqymlcrtqepwjeulpb.supabase.co,
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbHF5bWxjcnRxZXB3amV1bHBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDMwNDI3MywiZXhwIjoyMTA5ODgwMjczfQ.-hrU9vqXaPVsf9PwBVNCefQjWIpL_Rfm5RGUftsS7i8,
SUPABASE_BUCKET_NAME=documents,
FRONTEND_URL=https://omnidoc-studio-jet.vercel.app,
ENABLE_STRIPE=false,
TRUST_PROXY_HEADERS=true
"@.Replace("`r`n", "").Replace("`n", "")

$serviceUrl = gcloud run services describe $ServiceName --region $Region --format 'value(status.url)'
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Deployment SUCCESS!" -ForegroundColor Green
Write-Host "Cloud Run Service URL: $serviceUrl" -ForegroundColor Green
Write-Host "Set VITE_API_URL=$serviceUrl in Vercel to connect frontend."
Write-Host "==========================================================" -ForegroundColor Green
