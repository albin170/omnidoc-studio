#!/usr/bin/env python3
"""
OmniDoc Studio — Controlled Database Migration Release Step
Executes Alembic migrations in a controlled, serial deployment step
prior to shifting production traffic to new container revisions.
"""
import os
import sys
import subprocess

def run_migrations():
    print("==========================================================")
    print("Executing Alembic Database Migrations (Release Step)")
    print("==========================================================")
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable is required to execute migrations.")
        sys.exit(1)
        
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
    if not os.path.exists(backend_dir):
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))

    env = os.environ.copy()
    env["PYTHONPATH"] = backend_dir

    try:
        # 1. Run alembic heads to verify migration state
        print("[1/2] Verifying migration state...")
        res_heads = subprocess.run(
            [sys.executable, "-m", "alembic", "heads"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        print(f"Target head: {res_heads.stdout.strip()}")

        # 2. Execute migration upgrade head
        print("[2/2] Running upgrade head...")
        res_upgrade = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        print(res_upgrade.stdout)
        print("==========================================================")
        print("[✓] Migration execution completed successfully.")
        print("==========================================================")
    except subprocess.CalledProcessError as e:
        print(f"[!] Migration failed with returncode {e.returncode}")
        print(f"STDOUT:\n{e.stdout}")
        print(f"STDERR:\n{e.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()

