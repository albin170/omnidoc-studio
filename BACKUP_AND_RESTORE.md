# OmniDoc Studio — Backup & Disaster Recovery Runbook

## 1. Disaster Recovery Strategy
OmniDoc Studio enforces an independent backup strategy ensuring that critical business assets (PostgreSQL relational data + Supabase Storage documents) are backed up off-platform to protect against accidental project deletion, provider outages, or data corruption.

---

## 2. Backup Execution

Run the automated backup script:
```bash
python scripts/backup_production.py \
  --database-url "$DATABASE_URL" \
  --supabase-url "$SUPABASE_URL" \
  --service-key "$SUPABASE_SERVICE_ROLE_KEY" \
  --bucket "documents" \
  --backup-dir "backups"
```

### What this produces:
1. `omnidoc_backup_YYYYMMDD_HHMMSS.tar.gz`: Gzip-compressed archive containing:
   - `database.json`: Full JSON table export with row counts and types.
   - `documents/`: Preserved file hierarchy matching tenant storage paths.
2. `omnidoc_backup_YYYYMMDD_HHMMSS_manifest.json`: Cryptographic manifest containing SHA-256 hashes of the archive, table row counts, and document counts.

---

## 3. Disaster Recovery Restoration Procedure

To restore from a backup archive into a new or recovered environment:

```bash
python scripts/restore_production.py \
  --archive backups/omnidoc_backup_YYYYMMDD_HHMMSS.tar.gz \
  --database-url "$TARGET_DATABASE_URL" \
  --supabase-url "$TARGET_SUPABASE_URL" \
  --service-key "$TARGET_SERVICE_ROLE_KEY" \
  --bucket "documents"
```

### Restoration Sequence:
1. **Integrity Check:** Calculates SHA-256 of the archive and checks bundle sanity.
2. **Extraction:** Safely unpacks records in an isolated temporary directory.
3. **Database Population:** Replays records in foreign-key dependency order (`organizations` -> `users` -> `plans` -> `documents` -> `audit_events`) using `ON CONFLICT DO NOTHING`.
4. **Storage Restoration:** Re-uploads document files into the Supabase bucket with verified SHA-256 hashes.
5. **Reconciliation:** Emits a final report detailing records inserted and files restored.

---

## 4. Retention & Cloud Storage Notice
- **Default Retention:** 7 daily backups locally / offsite.
- **Off-Site Storage Recommendation:** Sync `backups/` directory to an AWS S3 Glacier or Google Cloud Storage bucket with lifecycle rules.
- **Cost Disclaimer:** Cloud storage beyond free tiers (e.g. GCS Standard > 5GB, Supabase Storage > 1GB) will incur provider fees. OmniDoc Studio's free community architecture operates within the 1GB Supabase Storage free allowance.

