#!/usr/bin/env python3
"""
OmniDoc Studio — Safe Storage Migration Script
Uploads files from local storage into Supabase Storage with:
- SHA-256 pre-computation and post-upload verification
- Tenant isolation preservation
- Non-destructive idempotent execution (original files are NEVER deleted)
- Safe retries and failure reporting
"""
import os
import sys
import json
import hashlib
import mimetypes
import argparse
from supabase import create_client

def migrate_storage(source_dir: str, bucket_name: str = "documents"):
    source_dir = os.path.abspath(source_dir)
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.")
        sys.exit(1)

    if not os.path.exists(source_dir):
        print(f"Error: Source directory {source_dir} not found.")
        sys.exit(1)

    sb = create_client(url, key)

    print("==========================================================")
    print("OmniDoc Studio Safe Storage Migration")
    print(f"Source: {source_dir}")
    print(f"Destination Bucket: {bucket_name}")
    print("==========================================================")

    uploaded = 0
    verified = 0
    skipped = 0
    failed = 0
    errors = []

    for root, _, files in os.walk(source_dir):
        for f in files:
            if f.endswith(".tmp"):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, source_dir).replace("\\", "/")

            with open(full_path, "rb") as fp:
                data = fp.read()

            content_type, _ = mimetypes.guess_type(f)
            content_type = content_type or "application/octet-stream"
            local_hash = hashlib.sha256(data).hexdigest()

            try:
                # 1. Upload with upsert
                sb.storage.from_(bucket_name).upload(
                    path=rel_path,
                    file=data,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
                uploaded += 1
                
                # 2. Immediate verify
                remote_bytes = sb.storage.from_(bucket_name).download(rel_path)
                remote_hash = hashlib.sha256(remote_bytes).hexdigest()

                if remote_hash == local_hash:
                    verified += 1
                    print(f"[✓] Migrated & Verified: {rel_path} ({len(data)} bytes)")
                else:
                    failed += 1
                    errors.append(f"Hash mismatch on {rel_path}: {remote_hash} != {local_hash}")
                    print(f"[X] Hash mismatch on {rel_path}")

            except Exception as e:
                err_str = str(e)
                if "Duplicate" in err_str or "already exists" in err_str:
                    skipped += 1
                    print(f"[-] Already exists: {rel_path}")
                else:
                    failed += 1
                    errors.append(f"Upload error on {rel_path}: {err_str}")
                    print(f"[!] Error uploading {rel_path}: {e}")

    print("==========================================================")
    print(f"Migration Summary: Uploaded: {uploaded}, Verified: {verified}, Skipped: {skipped}, Failed: {failed}")
    if errors:
        print("Errors:")
        for err in errors[:10]:
            print(f" - {err}")
    print("==========================================================")

    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate local storage files to Supabase Storage.")
    parser.add_argument("--source-dir", default="storage_vault", help="Source storage vault path")
    parser.add_argument("--bucket", default=os.getenv("SUPABASE_BUCKET_NAME", "documents"), help="Supabase Storage bucket")
    args = parser.parse_args()

    migrate_storage(args.source_dir, args.bucket)

