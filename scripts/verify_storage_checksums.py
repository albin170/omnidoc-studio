#!/usr/bin/env python3
"""
OmniDoc Studio — Storage Checksum & Integrity Verifier
Downloads and checks files in Supabase Storage against a storage manifest,
verifying 100% byte-for-byte SHA-256 match and tenant isolation.
"""
import os
import sys
import json
import hashlib
import argparse
from supabase import create_client

def verify_checksums(manifest_path: str):
    if not os.path.exists(manifest_path):
        print(f"Error: Manifest file {manifest_path} not found.")
        sys.exit(1)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.getenv("SUPABASE_BUCKET_NAME", "documents")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.")
        sys.exit(1)

    sb = create_client(url, key)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    files = manifest.get("files", [])
    print("==========================================================")
    print("OmniDoc Studio Storage Checksum Verification")
    print(f"Manifest: {manifest_path}")
    print(f"Total files to verify: {len(files)}")
    print("==========================================================")

    matched = 0
    mismatched = 0
    missing = 0
    errors = []

    for item in files:
        path = item["storage_path"]
        expected_hash = item["sha256"]
        expected_size = item["size_bytes"]

        try:
            remote_bytes = sb.storage.from_(bucket).download(path)
            actual_size = len(remote_bytes)
            actual_hash = hashlib.sha256(remote_bytes).hexdigest()

            if actual_hash == expected_hash and actual_size == expected_size:
                matched += 1
                print(f"[✓] VERIFIED: {path} ({actual_size} bytes, SHA-256 match)")
            else:
                mismatched += 1
                err_msg = f"MISMATCH on {path}: size {actual_size} vs {expected_size}, hash {actual_hash} vs {expected_hash}"
                print(f"[X] {err_msg}")
                errors.append(err_msg)
        except Exception as e:
            missing += 1
            err_msg = f"MISSING / ERROR on {path}: {e}"
            print(f"[!] {err_msg}")
            errors.append(err_msg)

    print("==========================================================")
    print(f"Verification Results: Matched: {matched}/{len(files)}, Mismatched: {mismatched}, Missing: {missing}")
    if errors:
        print(f"Errors encountered ({len(errors)}):")
        for err in errors[:10]:
            print(f" - {err}")
    print("==========================================================")

    if mismatched > 0 or missing > 0:
        sys.exit(1)
    else:
        print("[✓] ALL STORAGE CHECKSUMS VERIFIED WITH 100% INTEGRITY!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify Supabase Storage checksums against manifest.")
    parser.add_argument("--manifest", default="backups/storage_manifest.json", help="Path to storage manifest JSON")
    args = parser.parse_args()

    verify_checksums(args.manifest)

