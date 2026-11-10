import pytest
import os
import json
import tempfile
import tarfile
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.database import Base
from app.models.organization import Organization
from app.models.user import User
from app.models.subscription_management import PlanModel

@pytest.mark.asyncio
async def test_backup_and_restore_cycle():
    # 1. Create a temporary source sqlite db
    with tempfile.TemporaryDirectory() as tmpdir:
        src_db_path = os.path.join(tmpdir, "source.db")
        tgt_db_path = os.path.join(tmpdir, "target.db")
        src_url = f"sqlite+aiosqlite:///{src_db_path}"
        tgt_url = f"sqlite+aiosqlite:///{tgt_db_path}"

        # Initialize source schema
        src_engine = create_async_engine(src_url)
        async with src_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        src_sessionmaker = sessionmaker(src_engine, class_=AsyncSession, expire_on_commit=False)
        async with src_sessionmaker() as session:
            org = Organization(id="org-backup-1", name="Backup Test Corp", slug="backup-corp", plan_tier="starter")
            session.add(org)
            user = User(
                id="user-backup-1",
                email="backup_user@corp.com",
                hashed_password="hashed_pwd_val_123",
                full_name="Backup Tester",
                role="user",
                org_id="org-backup-1",
                is_active=True,
                terms_accepted=True,
                privacy_accepted=True,
                ai_consent=True
            )
            session.add(user)
            await session.commit()
        await src_engine.dispose()

        # 2. Perform export
        from scripts.export_database import export_db
        export_json = os.path.join(tmpdir, "export.json")
        await export_db(src_url, export_json)
        assert os.path.exists(export_json)

        with open(export_json, "r") as fp:
            archive = json.load(fp)
        assert len(archive["data"]["organizations"]) == 1
        assert archive["data"]["organizations"][0]["id"] == "org-backup-1"
        assert len(archive["data"]["users"]) == 1
        assert archive["data"]["users"][0]["email"] == "backup_user@corp.com"

        # 3. Create target db and run import
        tgt_engine = create_async_engine(tgt_url)
        async with tgt_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await tgt_engine.dispose()

        from scripts.import_database import import_db
        await import_db(tgt_url, export_json)

        # 4. Verify target db contains restored records
        tgt_check_engine = create_async_engine(tgt_url)
        tgt_sessionmaker = sessionmaker(tgt_check_engine, class_=AsyncSession, expire_on_commit=False)
        async with tgt_sessionmaker() as session:
            res_org = await session.execute(text("SELECT id, name, slug FROM organizations WHERE id='org-backup-1'"))
            row_org = res_org.fetchone()
            assert row_org is not None
            assert row_org[1] == "Backup Test Corp"

            res_user = await session.execute(text("SELECT id, email, full_name FROM users WHERE id='user-backup-1'"))
            row_user = res_user.fetchone()
            assert row_user is not None
            assert row_user[1] == "backup_user@corp.com"
        await tgt_check_engine.dispose()
