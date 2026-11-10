# Deploy OmniDoc Studio Backend to Google Cloud Run (PowerShell)
param (
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = "us-central1",
    [string]$ServiceName = "omnidoc-backend",
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$SecretKey = $env:SECRET_KEY,
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$SupabaseServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
    [string]$SupabaseBucket = ($env:SUPABASE_BUCKET_NAME, "documents")[[string]::IsNullOrEmpty($env:SUPABASE_BUCKET_NAME)],
    [string]$FrontendUrl = ($env:FRONTEND_URL, "https://omnidoc-studio-jet.vercel.app")[[string]::IsNullOrEmpty($env:FRONTEND_URL)]
)

$ErrorActionPreference = "Stop"

if (-not $ProjectId) {
    $ProjectId = gcloud config get-value project 2>$null
}

if (-not $ProjectId) {
    Write-Error "Error: GCP_PROJECT_ID is not set and no active gcloud project found. Set `$env:GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
}

# Verify required production secrets are supplied via environment
$missing = @()
if (-not $DatabaseUrl) { $missing += "DATABASE_URL" }
if (-not $SecretKey) { $missing += "SECRET_KEY" }
if (-not $SupabaseUrl) { $missing += "SUPABASE_URL" }
if (-not $SupabaseServiceRoleKey) { $missing += "SUPABASE_SERVICE_ROLE_KEY" }

if ($missing.Count -gt 0) {
    Write-Error "Error: The following mandatory environment variables must be set before deploying to Cloud Run: $($missing -join ', ')"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Deploying OmniDoc Studio to Google Cloud Run" -ForegroundColor Cyan
Write-Host "Project: $ProjectId"
Write-Host "Region:  $Region"
Write-Host "Service: $ServiceName"
Write-Host "==========================================================" -ForegroundColor Cyan

# Deploy container to Cloud Run with environment secrets passed via secure params
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
    --set-env-vars "ENVIRONMENT=production,STORAGE_PROVIDER=supabase,SUPABASE_BUCKET_NAME=$SupabaseBucket,FRONTEND_URL=$FrontendUrl,ENABLE_STRIPE=false,TRUST_PROXY_HEADERS=true" `
    --set-env-vars "DATABASE_URL=$DatabaseUrl,SECRET_KEY=$SecretKey,SUPABASE_URL=$SupabaseUrl,SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleKey"

$serviceUrl = gcloud run services describe $ServiceName --region $Region --format 'value(status.url)'
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Deployment SUCCESS!" -ForegroundColor Green
Write-Host "Cloud Run Service URL: $serviceUrl" -ForegroundColor Green
Write-Host "Set VITE_API_URL=$serviceUrl in Vercel to connect frontend."
Write-Host "==========================================================" -ForegroundColor Green
