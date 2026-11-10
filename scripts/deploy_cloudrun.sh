#!/usr/bin/env bash
# Deploy OmniDoc Studio Backend to Google Cloud Run
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "")}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="omnidoc-backend"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID is not set and no active gcloud project found."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

DATABASE_URL="${DATABASE_URL:-}"
SECRET_KEY="${SECRET_KEY:-}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_BUCKET_NAME="${SUPABASE_BUCKET_NAME:-documents}"
FRONTEND_URL="${FRONTEND_URL:-https://omnidoc-studio-jet.vercel.app}"

if [ -z "$DATABASE_URL" ] || [ -z "$SECRET_KEY" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: Mandatory production secrets (DATABASE_URL, SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) must be provided in the environment."
    exit 1
fi

echo "=========================================================="
echo "Deploying OmniDoc Studio to Google Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Service: $SERVICE_NAME"
echo "=========================================================="

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
    --set-env-vars "ENVIRONMENT=production,STORAGE_PROVIDER=supabase,SUPABASE_BUCKET_NAME=$SUPABASE_BUCKET_NAME,FRONTEND_URL=$FRONTEND_URL,ENABLE_STRIPE=false,TRUST_PROXY_HEADERS=true" \
    --set-env-vars "DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY,SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')
echo ""
echo "=========================================================="
echo "Deployment SUCCESS!"
echo "Cloud Run Service URL: $SERVICE_URL"
echo "Set VITE_API_URL=$SERVICE_URL in Vercel to connect frontend."
echo "=========================================================="
