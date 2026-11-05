import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_developer_api_keys_and_simulation_and_workflows(client: AsyncClient):
    # 1. Register user
    reg_data = {
        "email": "dev_architect@omnidoc.io",
        "password": "StrongDevPassword2026!",
        "full_name": "Senior Architect",
        "organization_name": "Architectural Systems Corp"
    }
    res_reg = await client.post("/api/v1/auth/register", json=reg_data)
    assert res_reg.status_code == 201

    res_login = await client.post("/api/v1/auth/token", data={
        "username": reg_data["email"],
        "password": reg_data["password"]
    })
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Developer API Keys
    res_key = await client.post(
        "/api/v1/developer/keys",
        json={"name": "Production Microservice Key", "scopes": "read:documents,execute:agent"},
        headers=headers
    )
    assert res_key.status_code == 201
    key_data = res_key.json()
    assert key_data["api_key"].startswith("omni_live_")
    assert key_data["name"] == "Production Microservice Key"

    # List keys
    res_list_keys = await client.get("/api/v1/developer/keys", headers=headers)
    assert res_list_keys.status_code == 200
    assert len(res_list_keys.json()) >= 1

    # 3. Workflow DAG Cycle Detection
    cyclic_wf = {
        "name": "Cyclic Test Pipeline",
        "nodes": [{"id": "A"}, {"id": "B"}],
        "edges": [{"source": "A", "target": "B"}, {"source": "B", "target": "A"}]
    }
    res_cycle = await client.post("/api/v1/workflows", json=cyclic_wf, headers=headers)
    assert res_cycle.status_code == 400
    assert "Cycle detected" in res_cycle.json()["detail"]

    # Valid Workflow
    valid_wf = {
        "name": "Invoice Pipeline",
        "nodes": [{"id": "A"}, {"id": "B"}, {"id": "C"}],
        "edges": [{"source": "A", "target": "B"}, {"source": "B", "target": "C"}]
    }
    res_valid_wf = await client.post("/api/v1/workflows", json=valid_wf, headers=headers)
    assert res_valid_wf.status_code == 201
    assert res_valid_wf.json()["name"] == "Invoice Pipeline"

    # 4. Upload document and run What-If Simulation
    doc_content = b"Contract Agreement: Liability limitation clause $1,000,000 USD."
    files = {"file": ("contract.txt", doc_content, "text/plain")}
    res_up = await client.post("/api/v1/documents/upload", files=files, headers=headers)
    assert res_up.status_code == 201
    doc_id = res_up.json()["id"]

    # Simulate translation and font size change
    sim_req = {
        "document_id": doc_id,
        "font_size_delta_pt": 2.0,
        "translation_target_lang": "de",
        "target_page_limit": 1
    }
    res_sim = await client.post("/api/v1/simulate", json=sim_req, headers=headers)
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert sim_data["is_simulation"] is True
    assert sim_data["text_expansion_ratio"] > 1.2

    # 5. Semantic Search & Q&A
    qa_req = {"question": "What is the liability limitation amount?"}
    res_qa = await client.post("/api/v1/search/ask", json=qa_req, headers=headers)
    assert res_qa.status_code == 200
    qa_data = res_qa.json()
    assert qa_data["evidence_found"] is True
    assert len(qa_data["citations"]) > 0

    # 6. Organization Profile & Members
    res_org = await client.get("/api/v1/organizations/current", headers=headers)
    assert res_org.status_code == 200
    assert res_org.json()["name"] == "Architectural Systems Corp"

    res_members = await client.get("/api/v1/organizations/members", headers=headers)
    assert res_members.status_code == 200
    assert len(res_members.json()) >= 1
