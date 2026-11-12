#!/usr/bin/env bash
# Deploy OmniDoc Studio Backend to Google Cloud Run.
# Store production credentials in Google Secret Manager before running this script.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-omnidoc-backend}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: Set GCP_PROJECT_ID or configure an active gcloud project." >&2
  exit 1
fi

for secret in omnidoc-secret-key omnidoc-database-url omnidoc-supabase-url omnidoc-supabase-service-role-key; do
  if ! gcloud secrets describe "$secret" --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo "Missing Secret Manager secret: $secret" >&2
    echo "Create it and grant the Cloud Run service identity access before deploying." >&2
    exit 1
  fi
done

echo "Deploying OmniDoc Studio backend to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Service: $SERVICE_NAME"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "ENVIRONMENT=production,STORAGE_PROVIDER=supabase,SUPABASE_BUCKET_NAME=documents,FRONTEND_URL=https://omnidoc-studio-jet.vercel.app,ENABLE_STRIPE=false,TRUST_PROXY_HEADERS=true" \
  --set-secrets "SECRET_KEY=omnidoc-secret-key:latest,DATABASE_URL=omnidoc-database-url:latest,SUPABASE_URL=omnidoc-supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=omnidoc-supabase-service-role-key:latest"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)')"
echo "Cloud Run deployment completed. Service URL: $SERVICE_URL"
