import pytest
from httpx import AsyncClient


async def _setup_project(client: AsyncClient, slug: str = "var-proj"):
    await client.post("/api/v1/projects", json={"name": "VP", "slug": slug})


@pytest.mark.asyncio
async def test_create_variable(client: AsyncClient):
    await _setup_project(client, "var-create")
    resp = await client.post(
        "/api/v1/projects/var-create/variables",
        json={"name": "user_id", "variable_type": "string", "description": "User ID"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "user_id"
    assert data["variable_type"] == "string"
    assert data["description"] == "User ID"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_variable_invalid_name(client: AsyncClient):
    await _setup_project(client, "var-invalid")
    resp = await client.post(
        "/api/v1/projects/var-invalid/variables",
        json={"name": "Invalid Name!", "variable_type": "string"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_variable_duplicate(client: AsyncClient):
    await _setup_project(client, "var-dup")
    await client.post(
        "/api/v1/projects/var-dup/variables",
        json={"name": "dup_var", "variable_type": "number"},
    )
    resp = await client.post(
        "/api/v1/projects/var-dup/variables",
        json={"name": "dup_var", "variable_type": "string"},
    )
    assert resp.status_code in (400, 409)


@pytest.mark.asyncio
async def test_list_variables(client: AsyncClient):
    await _setup_project(client, "var-list")
    await client.post(
        "/api/v1/projects/var-list/variables",
        json={"name": "var_a", "variable_type": "string"},
    )
    await client.post(
        "/api/v1/projects/var-list/variables",
        json={"name": "var_b", "variable_type": "number"},
    )
    resp = await client.get("/api/v1/projects/var-list/variables")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_update_variable(client: AsyncClient):
    await _setup_project(client, "var-upd")
    create = await client.post(
        "/api/v1/projects/var-upd/variables",
        json={"name": "upd_var", "variable_type": "string"},
    )
    var_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/var-upd/variables/{var_id}",
        json={"variable_type": "boolean", "description": "Updated"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["variable_type"] == "boolean"
    assert data["description"] == "Updated"


@pytest.mark.asyncio
async def test_delete_variable(client: AsyncClient):
    await _setup_project(client, "var-del")
    create = await client.post(
        "/api/v1/projects/var-del/variables",
        json={"name": "del_var", "variable_type": "json"},
    )
    var_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/projects/var-del/variables/{var_id}")
    assert resp.status_code == 204

    # verify it's gone
    list_resp = await client.get("/api/v1/projects/var-del/variables")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_variable_types(client: AsyncClient):
    await _setup_project(client, "var-types")
    for vt in ["string", "number", "boolean", "date", "datetime", "json", "string_array", "number_array"]:
        resp = await client.post(
            "/api/v1/projects/var-types/variables",
            json={"name": f"v_{vt}", "variable_type": vt},
        )
        assert resp.status_code == 201, f"Failed for type {vt}"
        assert resp.json()["variable_type"] == vt
