# OmniDoc Studio — Database Architecture & Migration Guide

## 1. Database Architecture
- **Provider:** Supabase PostgreSQL 17.11
- **Host / Pooler:** `aws-1-ap-southeast-1.pooler.supabase.com:5432`
- **Driver:** `postgresql+asyncpg`
- **Connection Mode:** Session Pooling via IPv4 Supabase Pooler
- **Pooling Strategy:**
  - On Google Cloud Run: SQLAlchemy standard QueuePool (`pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, `pool_recycle=1800`).
  - On Vercel Serverless: `NullPool` to prevent socket freeze timeouts across container sleep cycles.

---

## 2. Alembic Migration History
The database schema has reached `head` across 4 migrations:
1. `ae7e596699af` — Initial enterprise schema (Organizations, Users, Consents, Documents, Audit events).
2. `578e51f364e3` — SaaS Subscription Management & Entitlement Engine (Plans, Features, PlanFeatures).
3. `b81a73f0891d` — Developer API Keys, Digital Twin, and Workflow models.
4. `c92b84f1902e` — Added `individual_plan_tier` column to `users` table for individual plan support.

---

## 3. Controlled Release Migration Execution
In accordance with production hardening rules, Alembic migrations are executed independently prior to container rollout:

```bash
# Execute controlled migration runner
python scripts/run_migrations.py
```
This script:
1. Verifies the current migration heads: `alembic heads`
2. Applies pending migrations safely: `alembic upgrade head`
3. Exits with code 0 on success or code 1 on failure, blocking downstream container deployment if a migration fails.

---

## 4. Verification & Integrity Checks
Run the database verification tool to inspect table counts and schemas:
```bash
python scripts/export_database.py --database-url "$DATABASE_URL"
```
Reconciliation validates:
- Users: passwords hashed with bcrypt (`$2b$12$...`), active status, consent timestamps.
- Organizations: multi-tenant slugs, plan tiers.
- Foreign Key Constraints: `ON DELETE CASCADE` on tenant documents and user tokens.
