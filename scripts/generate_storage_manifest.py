#!/usr/bin/env python3
"""
OmniDoc Studio — Storage Manifest Generator
Scans storage vault, computes SHA-256 checksums, byte sizes, and metadata
for all documents, generating a canonical storage_manifest.json.
"""
import os
import sys
import json
import hashlib
import mimetypes
from datetime import datetime, timezone
import argparse

def generate_manifest(source_dir: str, output_path: str):
    source_dir = os.path.abspath(source_dir)
    print("==========================================================")
    print("Generating OmniDoc Studio Storage Manifest")
    print(f"Source Directory: {source_dir}")
    print(f"Output Manifest: {output_path}")
    print("==========================================================")

    if not os.path.exists(source_dir):
        print(f"Error: Directory {source_dir} not found.")
        sys.exit(1)

    files_list = []
    total_bytes = 0

    for root, _, files in os.walk(source_dir):
        for f in files:
            if f.endswith(".tmp"):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, source_dir).replace("\\", "/")
            parts = rel_path.split("/")
            
            # Extract org_id, doc_id, filename
            org_id = parts[0] if len(parts) >= 1 else "unknown"
            doc_id = parts[1] if len(parts) >= 2 else "unknown"
            filename = parts[-1]

            size = os.path.getsize(full_path)
            total_bytes += size

            hasher = hashlib.sha256()
            with open(full_path, "rb") as fp:
                while chunk := fp.read(64 * 1024):
                    hasher.update(chunk)
            file_hash = hasher.hexdigest()

            guessed_mime, _ = mimetypes.guess_type(filename)

            files_list.append({
                "storage_path": rel_path,
                "org_id": org_id,
                "document_id": doc_id,
                "filename": filename,
                "size_bytes": size,
                "sha256": file_hash,
                "mime_type": guessed_mime or "application/octet-stream"
            })

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_files": len(files_list),
        "total_bytes": total_bytes,
        "files": files_list
    }

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"[✓] Manifest generated successfully!")
    print(f"    Total files: {len(files_list)}")
    print(f"    Total size:  {total_bytes / (1024 * 1024):.2f} MB")
    print(f"    Manifest:    {output_path}")
    print("==========================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate SHA-256 Storage Manifest.")
    parser.add_argument("--source-dir", default="storage_vault", help="Source storage vault path")
    parser.add_argument("--output", default="backups/storage_manifest.json", help="Output manifest JSON path")
    args = parser.parse_args()

    generate_manifest(args.source_dir, args.output)
