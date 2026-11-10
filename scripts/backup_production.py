#!/usr/bin/env python3
"""
OmniDoc Studio — Independent Backup Utility
Performs independent backup of both Supabase PostgreSQL database and Supabase Storage documents.
Creates timestamped, checksummed backup bundles stored independently of Supabase.
"""
import os
import sys
import json
import tarfile
import hashlib
import asyncio
from datetime import datetime, timezone
import argparse
from supabase import create_client
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

TABLES = [
    "organizations", "users", "consent_records", "password_reset_tokens",
    "revoked_tokens", "plans", "features", "plan_features",
    "user_entitlement_overrides", "organization_subscriptions",
    "documents", "jobs", "audit_events", "developer_api_keys", "ui_configurations"
]

def serialize(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, bytes):
        return v.hex()
    return v

async def backup(database_url: str, supabase_url: str, service_key: str, bucket_name: str, backup_dir: str, retention_days: int = 7):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    bundle_name = f"omnidoc_backup_{timestamp}"
    work_dir = os.path.join(backup_dir, bundle_name)
    os.makedirs(work_dir, exist_ok=True)

    print("==========================================================")
    print("OmniDoc Studio Production Backup")
    print(f"Timestamp:  {timestamp}")
    print(f"Bundle Dir: {work_dir}")
    print("==========================================================")

    # 1. Database Backup
    print("\n[1/3] Exporting PostgreSQL Database...")
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    db_dump = {"metadata": {"exported_at": datetime.now(timezone.utc).isoformat()}, "tables": {}}

    async with async_session() as session:
        for tbl in TABLES:
            try:
                res = await session.execute(text(f"SELECT * FROM {tbl}"))
                keys = res.keys()
                rows = [{k: serialize(v) for k, v in zip(keys, row)} for row in res.fetchall()]
                db_dump["tables"][tbl] = rows
                print(f"  - Table '{tbl}': {len(rows)} records")
            except Exception as e:
                print(f"  ! Table '{tbl}' error: {e}")
                db_dump["tables"][tbl] = []

    await engine.dispose()
    db_file = os.path.join(work_dir, "database.json")
    with open(db_file, "w", encoding="utf-8") as f:
        json.dump(db_dump, f, indent=2)

    # 2. Document Storage Backup
    print("\n[2/3] Downloading Document Storage...")
    docs_dir = os.path.join(work_dir, "documents")
    os.makedirs(docs_dir, exist_ok=True)
    sb = create_client(supabase_url, service_key)
    
    docs_count = 0
    try:
        # Query documents from db_dump to know all active files
        doc_records = db_dump["tables"].get("documents", [])
        for doc in doc_records:
            spath = doc.get("storage_path")
            if not spath:
                continue
            try:
                file_bytes = sb.storage.from_(bucket_name).download(spath)
                local_target = os.path.join(docs_dir, spath)
                os.makedirs(os.path.dirname(local_target), exist_ok=True)
                with open(local_target, "wb") as fp:
                    fp.write(file_bytes)
                docs_count += 1
            except Exception as e:
                print(f"  ! Error downloading {spath}: {e}")
        print(f"  - Downloaded {docs_count} storage documents.")
    except Exception as e:
        print(f"  ! Storage backup error: {e}")

    # 3. Create Compressed Archive and SHA-256 Checksum Manifest
    print("\n[3/3] Compressing and Generating SHA-256 Manifest...")
    tar_path = os.path.join(backup_dir, f"{bundle_name}.tar.gz")
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(work_dir, arcname=bundle_name)

    # Compute tar SHA-256
    hasher = hashlib.sha256()
    with open(tar_path, "rb") as fp:
        while chunk := fp.read(64 * 1024):
            hasher.update(chunk)
    archive_hash = hasher.hexdigest()

    manifest = {
        "timestamp": timestamp,
        "archive_file": os.path.basename(tar_path),
        "sha256": archive_hash,
        "size_bytes": os.path.getsize(tar_path),
        "tables_backed_up": {tbl: len(rows) for tbl, rows in db_dump["tables"].items()},
        "documents_backed_up": docs_count
    }
    manifest_file = os.path.join(backup_dir, f"{bundle_name}_manifest.json")
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    # Cleanup temporary work directory
    import shutil
    shutil.rmtree(work_dir)

    print("==========================================================")
    print(f"Backup SUCCESS!")
    print(f"Archive:  {tar_path} ({manifest['size_bytes'] / (1024 * 1024):.2f} MB)")
    print(f"SHA-256:  {archive_hash}")
    print(f"Manifest: {manifest_file}")
    print("==========================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create independent OmniDoc Studio backup archive.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL"))
    parser.add_argument("--service-key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    parser.add_argument("--bucket", default=os.getenv("SUPABASE_BUCKET_NAME", "documents"))
    parser.add_argument("--backup-dir", default="backups")
    args = parser.parse_args()

    if not args.database_url or not args.supabase_url or not args.service_key:
        print("Error: DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.")
        sys.exit(1)

    asyncio.run(backup(args.database_url, args.supabase_url, args.service_key, args.bucket, args.backup_dir))
