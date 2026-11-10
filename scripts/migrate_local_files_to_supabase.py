import os
import mimetypes
from supabase import create_client

def migrate():
    url = "https://kflqymlcrtqepwjeulpb.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbHF5bWxjcnRxZXB3amV1bHBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDMwNDI3MywiZXhwIjoyMTA5ODgwMjczfQ.-hrU9vqXaPVsf9PwBVNCefQjWIpL_Rfm5RGUftsS7i8"
    bucket = "documents"
    
    sb = create_client(url, key)
    vault_dir = os.path.abspath("C:/Users/Dell/Documents/omnidoc-studio/storage_vault")
    
    if not os.path.exists(vault_dir):
        print(f"Directory {vault_dir} does not exist.")
        return

    uploaded = 0
    skipped = 0
    failed = 0
    
    for root, dirs, files in os.walk(vault_dir):
        for f in files:
            if f.endswith(".tmp"):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, vault_dir).replace("\\", "/")
            content_type, _ = mimetypes.guess_type(f)
            content_type = content_type or "application/octet-stream"
            
            with open(full_path, "rb") as fp:
                data = fp.read()
                
            try:
                # Upload with upsert
                sb.storage.from_(bucket).upload(
                    path=rel_path,
                    file=data,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
                print(f"Uploaded: {rel_path} ({len(data)} bytes)")
                uploaded += 1
            except Exception as e:
                # If already exists or error
                if "Duplicate" in str(e) or "already exists" in str(e):
                    print(f"Already exists: {rel_path}")
                    skipped += 1
                else:
                    print(f"Error uploading {rel_path}: {e}")
                    failed += 1

    print(f"\nMigration complete: {uploaded} uploaded, {skipped} skipped, {failed} failed.")

if __name__ == "__main__":
    migrate()
