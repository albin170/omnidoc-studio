# OmniDoc Studio — Production Rollback & Incident Response Plan

## 1. Rollback Triggers
Initiate a rollback if any of the following occur after deploying a release:
- Liveness probe (`/health`) or readiness probe (`/api/v1/ready`) fails with 5xx errors for > 2 consecutive minutes.
- Document upload or download requests fail with storage exceptions.
- API error rate exceeds 1% of total traffic.
- Critical authentication regression (users cannot log in or register).

---

## 2. Fast Rollback Procedure (Cloud Run)
Cloud Run maintains historical container revisions. Traffic can be shifted back instantaneously with zero downtime:

```bash
# List previous revisions
gcloud run revisions list --service omnidoc-backend --region us-central1

# Shift 100% of production traffic back to known healthy revision
gcloud run services update-traffic omnidoc-backend \
  --region us-central1 \
  --to-revisions PREVIOUS_HEALTHY_REVISION=100
```

---

## 3. Fast Rollback Procedure (Vercel Frontend)
If a frontend bundle causes client-side rendering errors:
1. In the Vercel Dashboard -> Project `omnidoc-studio` -> **Deployments**.
2. Select the previous stable deployment.
3. Click **...** -> **Promote to Production** (or run `npx vercel rollback`).
4. Production alias `https://omnidoc-studio-jet.vercel.app` is pointed back to the previous deployment within seconds.

---

## 4. Database Rollback Procedure
If a database migration introduced an incompatible column or constraint:
1. Verify database state:
   ```bash
   alembic current
   ```
2. Downgrade one revision:
   ```bash
   alembic downgrade -1
   ```
3. If data corruption occurred, restore from the pre-deployment backup bundle:
   ```bash
   python scripts/restore_production.py --archive backups/omnidoc_backup_PRE_DEPLOYMENT.tar.gz --database-url "$DATABASE_URL"
   ```

---

## 5. Post-Rollback Verification
1. Test health check:
   ```bash
   curl -I https://omnidoc-studio-jet.vercel.app
   curl https://omnidoc-backend-url/api/v1/ready
   ```
2. Test login:
   ```bash
   curl -X POST https://omnidoc-backend-url/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "production_test_user@omnidoc.io", "password": "StrongPassword2026!"}'
   ```
3. Verify document list and download endpoints.

