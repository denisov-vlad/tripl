import pytest
from httpx import AsyncClient


async def _setup_events(client: AsyncClient, slug: str = "ev-proj"):
    await client.post("/api/v1/projects", json={"name": "E", "slug": slug})
    et_resp = await client.post(
        f"/api/v1/projects/{slug}/event-types",
        json={"name": "pv", "display_name": "Page View"},
    )
    et_id = et_resp.json()["id"]
    f_resp = await client.post(
        f"/api/v1/projects/{slug}/event-types/{et_id}/fields",
        json={
            "name": "screen",
            "display_name": "Screen",
            "field_type": "string",
            "is_required": True,
        },
    )
    field_id = f_resp.json()["id"]
    await client.post(
        f"/api/v1/projects/{slug}/meta-fields",
        json={"name": "jira", "display_name": "Jira", "field_type": "url"},
    )
    meta_resp = await client.get(f"/api/v1/projects/{slug}/meta-fields")
    meta_id = meta_resp.json()[0]["id"]
    return et_id, field_id, meta_id


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient):
    et_id, field_id, meta_id = await _setup_events(client)
    resp = await client.post(
        "/api/v1/projects/ev-proj/events",
        json={
            "event_type_id": et_id,
            "name": "Home Page View",
            "field_values": [{"field_definition_id": field_id, "value": "home"}],
            "meta_values": [
                {"meta_field_definition_id": meta_id, "value": "https://jira.example.com/TICK-1"}
            ],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Home Page View"
    assert len(data["field_values"]) == 1
    assert len(data["meta_values"]) == 1


@pytest.mark.asyncio
async def test_create_event_missing_required_field(client: AsyncClient):
    et_id, field_id, meta_id = await _setup_events(client, "ev-req")
    resp = await client.post(
        "/api/v1/projects/ev-req/events",
        json={
            "event_type_id": et_id,
            "name": "No Screen",
            "field_values": [],
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient):
    et_id, field_id, meta_id = await _setup_events(client, "ev-list")
    await client.post(
        "/api/v1/projects/ev-list/events",
        json={
            "event_type_id": et_id,
            "name": "Event 1",
            "field_values": [{"field_definition_id": field_id, "value": "screen1"}],
        },
    )
    await client.post(
        "/api/v1/projects/ev-list/events",
        json={
            "event_type_id": et_id,
            "name": "Event 2",
            "field_values": [{"field_definition_id": field_id, "value": "screen2"}],
        },
    )
    resp = await client.get("/api/v1/projects/ev-list/events")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_list_events_search(client: AsyncClient):
    et_id, field_id, _ = await _setup_events(client, "ev-search")
    await client.post(
        "/api/v1/projects/ev-search/events",
        json={
            "event_type_id": et_id,
            "name": "Alpha Page",
            "field_values": [{"field_definition_id": field_id, "value": "s"}],
        },
    )
    await client.post(
        "/api/v1/projects/ev-search/events",
        json={
            "event_type_id": et_id,
            "name": "Beta Click",
            "field_values": [{"field_definition_id": field_id, "value": "s"}],
        },
    )
    resp = await client.get("/api/v1/projects/ev-search/events?search=Alpha")
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_update_event(client: AsyncClient):
    et_id, field_id, _ = await _setup_events(client, "ev-upd")
    create = await client.post(
        "/api/v1/projects/ev-upd/events",
        json={
            "event_type_id": et_id,
            "name": "Old Name",
            "field_values": [{"field_definition_id": field_id, "value": "s"}],
        },
    )
    event_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/ev-upd/events/{event_id}",
        json={"name": "New Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_event(client: AsyncClient):
    et_id, field_id, _ = await _setup_events(client, "ev-del")
    create = await client.post(
        "/api/v1/projects/ev-del/events",
        json={
            "event_type_id": et_id,
            "name": "To Delete",
            "field_values": [{"field_definition_id": field_id, "value": "s"}],
        },
    )
    event_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/projects/ev-del/events/{event_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_bulk_create_events(client: AsyncClient):
    et_id, field_id, _ = await _setup_events(client, "ev-bulk")
    resp = await client.post(
        "/api/v1/projects/ev-bulk/events/bulk",
        json=[
            {
                "event_type_id": et_id,
                "name": "Bulk 1",
                "field_values": [{"field_definition_id": field_id, "value": "s1"}],
            },
            {
                "event_type_id": et_id,
                "name": "Bulk 2",
                "field_values": [{"field_definition_id": field_id, "value": "s2"}],
            },
        ],
    )
    assert resp.status_code == 201
    assert len(resp.json()) == 2
