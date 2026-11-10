# OmniDoc Studio — Security Remediation & Credential Rotation Guide

## 1. Remediation Summary
All hardcoded credentials, connection strings, and service role keys have been removed from tracked source code, deployment templates, and scripts in the repository.

### Remediated Files
- `cloudrun.yaml`: Plaintext env values replaced with GCP Secret Manager `secretKeyRef` declarations.
- `render.yaml`: Completely deleted; Render is removed from architecture.
- `scripts/deploy_cloudrun.ps1` & `scripts/deploy_cloudrun.sh`: Updated to require environment variables or Secret Manager parameters.
- `scripts/migrate_local_files_to_supabase.py`: Updated to read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment.
- `.gitignore`: Added watertight rules for `.env`, `.env.*`, `*.dump`, `*.sql`, `*.tar.gz`, `backups/`.
- `.env.example`: Sanitized template with safe placeholders only.

---

## 2. Mandatory Credential Rotation Procedure
Because historical commits contained database passwords and Supabase service-role keys, the following manual credential rotations must be performed:

### A. Supabase Service Role Key Rotation
1. Navigate to **Supabase Dashboard** -> Select Project `omnidoc-studio` (`kflqymlcrtqepwjeulpb`).
2. Go to **Project Settings** -> **API**.
3. Under **Project API keys**, click **Reset** for the `service_role` key (secret).
4. Update the new key in your deployment environment:
   - In Vercel / Cloud Run: update `SUPABASE_SERVICE_ROLE_KEY`.

### B. Supabase Database Password Rotation
1. In Supabase Dashboard -> **Project Settings** -> **Database**.
2. Scroll to **Database Password** and click **Reset Database Password**.
3. Set a strong 32+ character random password.
4. Update `DATABASE_URL` in Cloud Run / Vercel with the new password.

### C. Application `SECRET_KEY` Rotation
1. Generate a new high-entropy 48-byte secret key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
2. Update `SECRET_KEY` in Cloud Run and Vercel environment variables.
3. Users with active JWT sessions will need to re-login once rotated.

---

## 3. Git History Cleansing Procedure (Optional but Recommended)
If you wish to purge historical commits from the repository history:

1. Install `git-filter-repo`:
   ```bash
   pip install git-filter-repo
   ```
2. Create an expressions file `replace_secrets.txt`:
   ```text
   OmniDoc_Db_2026_SecureKey! ==> REDACTED_DB_PASSWORD
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS... ==> REDACTED_SERVICE_ROLE_KEY
   omnidoc_prod_sec_key_d92f8a1103c8479e2bc91e7041a384f5_supabase_ready ==> REDACTED_SECRET_KEY
   ```
3. Run:
   ```bash
   git filter-repo --replace-text replace_secrets.txt
   ```
4. Force push the sanitized branches:
   ```bash
   git push origin --force --all
   ```

