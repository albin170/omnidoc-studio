# OmniDoc Studio — Supabase Storage Architecture & Configuration

## 1. Bucket Configuration
- **Bucket Name:** `documents`
- **Visibility:** Private (Public access disabled for enterprise security)
- **Encryption:** Server-side AES-256 standard on Supabase Storage
- **Max File Size:** 500 MB (Enforced both by Supabase policy and FastAPI layer)
- **MIME Types Allowed:** PDF, DOCX, XLSX, PPTX, PNG, JPG, JPEG, WEBP, CSV, TXT, MD, HTML

---

## 2. Object Path Structure
To ensure strict multi-tenant isolation, every document object path follows:
```text
{org_id}/{document_id}/{filename}
```
Example:
```text
babc354a-681d-4157-b202-a1552d8bf4c1/8f75dbbc-a736-4436-83c8-a558648dcfe6/quarterly_audit.pdf
```

### Security Defenses Enforced:
1. **Path Traversal Defense:** Rejects `..`, `//`, `\`, and absolute root paths.
2. **Tenant Boundary Defense:** The storage adapter validates that `storage_path.startswith(f"{org_id}/")` before executing any download or delete. Sibling prefix attacks (e.g. `org-1-attacker` vs `org-1`) are blocked.
3. **Magic Byte Signature Inspection:** Validates file magic headers (`%PDF-`, `PK\x03\x04`, `\x89PNG`, etc.) before persisting.
4. **Zero Ephemeral Disk Fallback:** In production mode (`ENVIRONMENT=production` or Cloud Run `K_SERVICE`), if Supabase is unreachable, the API returns a controlled `HTTP 503` rather than silently writing to the container filesystem.

---

## 3. Storage Operations API

### Upload
```python
from app.services.storage import storage_vault

storage_path, content_hash, file_size = await storage_vault.save_file(
    org_id=user.org_id,
    document_id=doc_id,
    filename=filename,
    content=file_bytes,
    content_type="application/pdf"
)
```

### Download (Streamed Bytes)
```python
file_bytes = storage_vault.read_file(org_id=user.org_id, storage_path=doc.storage_path)
```

### Signed Download URL (Cryptographically Tamper-Resistant)
```python
signed_url = storage_vault.generate_signed_download_url(
    org_id=user.org_id,
    document_id=doc.id,
    filename=doc.filename,
    expires_seconds=900
)
```
Generates a signed URL bound to `SECRET_KEY` that expires automatically and audits every retrieval.
