import os
import httpx
from typing import Dict, Any, List, Optional, Union

class OmniDocError(Exception):
    pass

class OmniDocClient:
    """
    Official Python SDK for OmniDoc Studio 2.0 Autonomous Document Engineering Platform.
    Provides typed methods for document ingestion, canonical digital twins, autonomous agents,
    cross-document intelligence, and verifiable execution receipts.
    """
    def __init__(self, base_url: str = "http://localhost:8000/api/v1", token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}

    def _client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, headers=self._headers, timeout=60.0)

    def register(self, email: str, password: str, full_name: str, org_name: str) -> Dict[str, Any]:
        with self._client() as c:
            r = c.post("/auth/register", json={
                "email": email,
                "password": password,
                "full_name": full_name,
                "organization_name": org_name
            })
            if r.status_code != 201:
                raise OmniDocError(f"Registration failed: {r.text}")
            return r.json()

    def login(self, email: str, password: str) -> str:
        with self._client() as c:
            r = c.post("/auth/token", data={"username": email, "password": password})
            if r.status_code != 200:
                raise OmniDocError(f"Login failed: {r.text}")
            data = r.json()
            self.token = data["access_token"]
            self._headers = {"Authorization": f"Bearer {self.token}"}
            return self.token

    def upload_document(self, file_source: Union[str, bytes], filename: str) -> Dict[str, Any]:
        if isinstance(file_source, str):
            with open(file_source, "rb") as f:
                content = f.read()
        else:
            content = file_source

        with self._client() as c:
            files = {"file": (filename, content, "application/octet-stream")}
            r = c.post("/documents/upload", files=files)
            if r.status_code != 201:
                raise OmniDocError(f"Upload failed: {r.text}")
            return r.json()

    def list_documents(self) -> List[Dict[str, Any]]:
        with self._client() as c:
            r = c.get("/documents")
            if r.status_code != 200:
                raise OmniDocError(f"List documents failed: {r.text}")
            return r.json()

    def get_document(self, document_id: str) -> Dict[str, Any]:
        with self._client() as c:
            r = c.get(f"/documents/{document_id}")
            if r.status_code != 200:
                raise OmniDocError(f"Get document failed: {r.text}")
            return r.json()

    def submit_autonomous_job(self, title: str, objective: str, document_ids: List[str], mode: str = "hybrid") -> Dict[str, Any]:
        with self._client() as c:
            r = c.post("/jobs", json={
                "title": title,
                "objective": objective,
                "document_ids": document_ids,
                "mode": mode
            })
            if r.status_code != 201:
                raise OmniDocError(f"Job submission failed: {r.text}")
            return r.json()

    def get_job(self, job_id: str) -> Dict[str, Any]:
        with self._client() as c:
            r = c.get(f"/jobs/{job_id}")
            if r.status_code != 200:
                raise OmniDocError(f"Get job failed: {r.text}")
            return r.json()

    def approve_job_step(self, job_id: str, approved: bool = True, rejection_reason: Optional[str] = None) -> Dict[str, Any]:
        with self._client() as c:
            r = c.post(f"/jobs/{job_id}/approve", json={
                "approved": approved,
                "rejection_reason": rejection_reason
            })
            if r.status_code != 200:
                raise OmniDocError(f"Approve job failed: {r.text}")
            return r.json()

    def list_tools(self) -> List[Dict[str, Any]]:
        with self._client() as c:
            r = c.get("/tools")
            if r.status_code != 200:
                raise OmniDocError(f"List tools failed: {r.text}")
            return r.json()
