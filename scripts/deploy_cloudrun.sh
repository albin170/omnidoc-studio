#!/usr/bin/env bash
# Deploy OmniDoc Studio Backend to Google Cloud Run
set -euo pipefail

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo '')}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="omnidoc-backend"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID is not set and no active gcloud project found."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "=========================================================="
echo "Deploying OmniDoc Studio to Google Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Service: $SERVICE_NAME"
echo "=========================================================="

# Build and deploy from source directly using Google Cloud Build
gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5 \
    --concurrency 80 \
    --timeout 300 \
    --set-env-vars "\
ENVIRONMENT=production,\
SECRET_KEY=omnidoc_prod_sec_key_d92f8a1103c8479e2bc91e7041a384f5_supabase_ready,\
DATABASE_URL=postgresql+asyncpg://postgres:OmniDoc_Db_2026_SecureKey!@db.kflqymlcrtqepwjeulpb.supabase.co:5432/postgres,\
STORAGE_PROVIDER=supabase,\
SUPABASE_URL=https://kflqymlcrtqepwjeulpb.supabase.co,\
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbHF5bWxjcnRxZXB3amV1bHBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDMwNDI3MywiZXhwIjoyMTA5ODgwMjczfQ.-hrU9vqXaPVsf9PwBVNCefQjWIpL_Rfm5RGUftsS7i8,\
SUPABASE_BUCKET_NAME=documents,\
FRONTEND_URL=https://omnidoc-studio-jet.vercel.app,\
ENABLE_STRIPE=false,\
TRUST_PROXY_HEADERS=true"

# Print Service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')
echo ""
echo "=========================================================="
echo "Deployment SUCCESS!"
echo "Cloud Run Service URL: $SERVICE_URL"
echo "Set VITE_API_URL=$SERVICE_URL in Vercel to connect frontend."
echo "=========================================================="
