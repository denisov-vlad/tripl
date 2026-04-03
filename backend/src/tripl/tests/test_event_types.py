import pytest
from httpx import AsyncClient


async def _create_project(client: AsyncClient, slug: str = "et-proj"):
    resp = await client.post("/api/v1/projects", json={"name": "ET", "slug": slug})
    return resp.json()


@pytest.mark.asyncio
async def test_create_event_type(client: AsyncClient):
    await _create_project(client)
    resp = await client.post(
        "/api/v1/projects/et-proj/event-types",
        json={"name": "pv", "display_name": "Page View"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "pv"


@pytest.mark.asyncio
async def test_create_event_type_duplicate(client: AsyncClient):
    await _create_project(client, "et-dup")
    await client.post(
        "/api/v1/projects/et-dup/event-types",
        json={"name": "pv", "display_name": "PV"},
    )
    resp = await client.post(
        "/api/v1/projects/et-dup/event-types",
        json={"name": "pv", "display_name": "PV2"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_event_types(client: AsyncClient):
    await _create_project(client, "et-list")
    await client.post(
        "/api/v1/projects/et-list/event-types",
        json={"name": "pv", "display_name": "PV"},
    )
    await client.post(
        "/api/v1/projects/et-list/event-types",
        json={"name": "se", "display_name": "SE"},
    )
    resp = await client.get("/api/v1/projects/et-list/event-types")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_update_event_type(client: AsyncClient):
    await _create_project(client, "et-upd")
    create_resp = await client.post(
        "/api/v1/projects/et-upd/event-types",
        json={"name": "pv", "display_name": "PV"},
    )
    et_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/et-upd/event-types/{et_id}",
        json={"display_name": "Page View Updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Page View Updated"


@pytest.mark.asyncio
async def test_delete_event_type(client: AsyncClient):
    await _create_project(client, "et-del")
    create_resp = await client.post(
        "/api/v1/projects/et-del/event-types",
        json={"name": "pv", "display_name": "PV"},
    )
    et_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/projects/et-del/event-types/{et_id}")
    assert resp.status_code == 204
