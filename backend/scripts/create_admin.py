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

        # 2. Check if an administrator already exists to prevent repeat provisioning (P0-002)
        existing_admin = await session.scalar(select(User).where(User.role.in_(("admin", "superadmin"))))
        if existing_admin:
            print(f"[!] Security Violation: An administrator account already exists ({existing_admin.email}).")
            print("    Repeat initial administrator provisioning is strictly forbidden.")
            sys.exit(1)

        # 3. Reject if target email is already an existing user (prevent account takeover)
        existing_user = await session.scalar(select(User).where(User.email == email.lower().strip()))
        if existing_user:
            print(f"[!] Security Violation: User with email {email} already exists. Credential overwrite rejected.")
            sys.exit(1)

        # 4. Create Primary Admin Organization
        org = Organization(
            name=org_name,
            slug=f"admin-org-{uuid.uuid4().hex[:6]}",
            plan_tier="enterprise"
        )
        session.add(org)
        await session.flush()

        # 5. Create Superadmin User
        admin_user = User(
            email=email.lower().strip(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role="superadmin",
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
    parser = argparse.ArgumentParser(description="One-time secure provisioning of the initial administrator account.")
    default_email = os.getenv("INITIAL_ADMIN_EMAIL")
    default_pwd = os.getenv("INITIAL_ADMIN_PASSWORD")
    
    parser.add_argument("--email", default=default_email, required=not default_email, help="Administrator email address")
    parser.add_argument("--password", default=default_pwd, required=not default_pwd, help="Administrator password (min 12 chars)")
    parser.add_argument("--name", default=os.getenv("INITIAL_ADMIN_NAME", "System Administrator"), help="Administrator full name")
    parser.add_argument("--org", default="OmniDoc Global Enterprise", help="Organization name")

    args = parser.parse_args()

    if not args.password or len(args.password) < 12:
        print("[!] Error: Administrator password must be explicitly provided and at least 12 characters long.")
        sys.exit(1)

    asyncio.run(provision_admin(args.email, args.password, args.name, args.org))

if __name__ == "__main__":
    main()

