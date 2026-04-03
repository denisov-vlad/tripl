import pytest
from httpx import AsyncClient


async def _setup_meta(client: AsyncClient, slug: str = "meta-proj"):
    await client.post("/api/v1/projects", json={"name": "M", "slug": slug})


@pytest.mark.asyncio
async def test_create_meta_field(client: AsyncClient):
    await _setup_meta(client)
    resp = await client.post(
        "/api/v1/projects/meta-proj/meta-fields",
        json={"name": "jira_link", "display_name": "Jira", "field_type": "url"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "jira_link"


@pytest.mark.asyncio
async def test_create_meta_field_duplicate(client: AsyncClient):
    await _setup_meta(client, "meta-dup")
    await client.post(
        "/api/v1/projects/meta-dup/meta-fields",
        json={"name": "status", "display_name": "Status", "field_type": "string"},
    )
    resp = await client.post(
        "/api/v1/projects/meta-dup/meta-fields",
        json={"name": "status", "display_name": "Status2", "field_type": "string"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_meta_fields(client: AsyncClient):
    await _setup_meta(client, "meta-list")
    await client.post(
        "/api/v1/projects/meta-list/meta-fields",
        json={"name": "jira", "display_name": "Jira", "field_type": "url"},
    )
    await client.post(
        "/api/v1/projects/meta-list/meta-fields",
        json={
            "name": "status",
            "display_name": "Status",
            "field_type": "enum",
            "enum_options": ["implemented", "not_implemented"],
        },
    )
    resp = await client.get("/api/v1/projects/meta-list/meta-fields")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_update_meta_field(client: AsyncClient):
    await _setup_meta(client, "meta-upd")
    create = await client.post(
        "/api/v1/projects/meta-upd/meta-fields",
        json={"name": "jira", "display_name": "Jira", "field_type": "url"},
    )
    mf_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/meta-upd/meta-fields/{mf_id}",
        json={"display_name": "Jira Link"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Jira Link"


@pytest.mark.asyncio
async def test_delete_meta_field(client: AsyncClient):
    await _setup_meta(client, "meta-del")
    create = await client.post(
        "/api/v1/projects/meta-del/meta-fields",
        json={"name": "jira", "display_name": "Jira", "field_type": "url"},
    )
    mf_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/projects/meta-del/meta-fields/{mf_id}")
    assert resp.status_code == 204
