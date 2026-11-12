# Deploy OmniDoc Studio Backend to Google Cloud Run (PowerShell).
# Store production credentials in Google Secret Manager before running this script.
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
    throw "GCP_PROJECT_ID is not set and no active gcloud project was found."
}

$requiredSecrets = @(
    "omnidoc-secret-key",
    "omnidoc-database-url",
    "omnidoc-supabase-url",
    "omnidoc-supabase-service-role-key"
)
foreach ($secret in $requiredSecrets) {
    gcloud secrets describe $secret --project $ProjectId *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Missing Secret Manager secret '$secret'. Create it and grant the Cloud Run service identity access before deploying."
    }
}

Write-Host "Deploying OmniDoc Studio backend to Cloud Run"
Write-Host "Project: $ProjectId"
Write-Host "Region:  $Region"
Write-Host "Service: $ServiceName"

gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5 `
    --concurrency 80 `
    --timeout 300 `
    --set-env-vars "ENVIRONMENT=production,STORAGE_PROVIDER=supabase,SUPABASE_BUCKET_NAME=documents,FRONTEND_URL=https://omnidoc-studio-jet.vercel.app,ENABLE_STRIPE=false,TRUST_PROXY_HEADERS=true" `
    --set-secrets "SECRET_KEY=omnidoc-secret-key:latest,DATABASE_URL=omnidoc-database-url:latest,SUPABASE_URL=omnidoc-supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=omnidoc-supabase-service-role-key:latest"

if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run deployment failed."
}

$serviceUrl = gcloud run services describe $ServiceName --project $ProjectId --region $Region --format "value(status.url)"
Write-Host "Cloud Run deployment completed. Service URL: $serviceUrl"
