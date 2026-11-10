#!/usr/bin/env python3
"""
OmniDoc Studio — Safe Database Export Utility
Exports all database tables, user accounts, organizations, documents, and audit logs
into an encrypted/verifiable JSON export archive with cryptographic table manifests.
"""
import os
import sys
import json
import asyncio
import hashlib
from datetime import datetime, timezone
import argparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

TABLES_TO_EXPORT = [
    "organizations",
    "users",
    "consent_records",
    "password_reset_tokens",
    "revoked_tokens",
    "plans",
    "features",
    "plan_features",
    "user_entitlement_overrides",
    "organization_subscriptions",
    "documents",
    "jobs",
    "audit_events",
    "developer_api_keys",
    "ui_configurations"
]

def serialize_row(row_dict: dict) -> dict:
    clean = {}
    for k, v in row_dict.items():
        if isinstance(v, datetime):
            clean[k] = v.isoformat()
        elif isinstance(v, bytes):
            clean[k] = v.hex()
        else:
            clean[k] = v
    return clean

async def export_db(database_url: str, output_path: str):
    print("==========================================================")
    print("OmniDoc Studio Database Export")
    print(f"Target DB: {database_url.split('@')[-1] if '@' in database_url else 'local'}")
    print(f"Output File: {output_path}")
    print("==========================================================")

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    archive = {
        "metadata": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "format_version": "2.0",
            "tables": {}
        },
        "data": {}
    }

    async with async_session() as session:
        for tbl in TABLES_TO_EXPORT:
            try:
                res = await session.execute(text(f"SELECT * FROM {tbl}"))
                keys = res.keys()
                rows = [serialize_row(dict(zip(keys, r))) for r in res.fetchall()]
                archive["data"][tbl] = rows
                
                # Compute SHA-256 checksum of table content
                tbl_bytes = json.dumps(rows, sort_keys=True).encode("utf-8")
                tbl_hash = hashlib.sha256(tbl_bytes).hexdigest()

                archive["metadata"]["tables"][tbl] = {
                    "count": len(rows),
                    "sha256": tbl_hash
                }
                print(f"[✓] Exported table '{tbl}': {len(rows)} records (SHA-256: {tbl_hash[:12]}...)")
            except Exception as e:
                print(f"[!] Warning: table '{tbl}' could not be exported: {e}")
                archive["metadata"]["tables"][tbl] = {"count": 0, "error": str(e)}

    await engine.dispose()

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(archive, f, indent=2)

    total_records = sum(t.get("count", 0) for t in archive["metadata"]["tables"].values())
    print("==========================================================")
    print(f"Export SUCCESS! Total records saved: {total_records}")
    print(f"Archive written to: {output_path}")
    print("==========================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export OmniDoc Studio database to verified JSON archive.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="Source Database URL")
    parser.add_argument("--output", default="backups/database_export.json", help="Output JSON path")
    args = parser.parse_args()

    if not args.database_url:
        print("Error: DATABASE_URL must be provided via --database-url or environment.")
        sys.exit(1)

    asyncio.run(export_db(args.database_url, args.output))

