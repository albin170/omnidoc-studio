"""
OmniDoc Studio 2.0 — Secure Initial Administrator Provisioning Script
Usage:
    python scripts/create_admin.py --email admin@omnidoc.io --password StrongPassword123! --name "Lead Administrator"
Or set environment variables:
    INITIAL_ADMIN_EMAIL=admin@omnidoc.io
    INITIAL_ADMIN_PASSWORD=StrongPassword123!
"""

import sys
import os
import argparse
import asyncio
import uuid
from datetime import datetime, timezone

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.organization import Organization
from app.core.security import get_password_hash
from app.services.seed_data import seed_initial_plans_and_features

async def provision_admin(email: str, password: str, full_name: str, org_name: str = "OmniDoc Primary Organization"):
    async with AsyncSessionLocal() as session:
        # 1. Seed plans & features
        await seed_initial_plans_and_features(session)

        # 2. Check if user already exists
        existing_user = await session.scalar(select(User).where(User.email == email.lower().strip()))
        if existing_user:
            print(f"[!] User with email {email} already exists. Elevating to 'admin' role...")
            existing_user.role = "admin"
            existing_user.is_active = True
            existing_user.hashed_password = get_password_hash(password)
            await session.commit()
            print(f"[+] Admin account updated successfully! User ID: {existing_user.id}")
            return

        # 3. Create Primary Admin Organization
        org = Organization(
            name=org_name,
            slug=f"admin-org-{uuid.uuid4().hex[:6]}",
            plan_tier="enterprise"
        )
        session.add(org)
        await session.flush()

        # 4. Create Admin User
        admin_user = User(
            email=email.lower().strip(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role="admin",
            is_active=True,
            terms_accepted=True,
            privacy_accepted=True,
            ai_consent=True,
            marketing_consent=False,
            org_id=org.id
        )
        session.add(admin_user)
        await session.commit()
        print(f"[✓] Administrator account provisioned successfully!")
        print(f"    Email:    {admin_user.email}")
        print(f"    User ID:  {admin_user.id}")
        print(f"    Org ID:   {org.id}")
        print(f"    Role:     {admin_user.role}")

def main():
    parser = argparse.ArgumentParser(description="Provision an initial administrator account for OmniDoc Studio.")
    parser.add_argument("--email", default=os.getenv("INITIAL_ADMIN_EMAIL", "admin@omnidoc.io"), help="Administrator email address")
    parser.add_argument("--password", default=os.getenv("INITIAL_ADMIN_PASSWORD", "AdminPass2026!"), help="Administrator password")
    parser.add_argument("--name", default=os.getenv("INITIAL_ADMIN_NAME", "System Administrator"), help="Administrator full name")
    parser.add_argument("--org", default="OmniDoc Global Enterprise", help="Organization name")

    args = parser.parse_args()

    if len(args.password) < 8:
        print("[!] Error: Administrator password must be at least 8 characters long.")
        sys.exit(1)

    asyncio.run(provision_admin(args.email, args.password, args.name, args.org))

if __name__ == "__main__":
    main()
