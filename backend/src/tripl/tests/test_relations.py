import pytest
from httpx import AsyncClient


async def _setup_relation(client: AsyncClient, slug: str = "rel-proj"):
    await client.post("/api/v1/projects", json={"name": "R", "slug": slug})
    r1 = await client.post(
        f"/api/v1/projects/{slug}/event-types",
        json={"name": "pv", "display_name": "PV"},
    )
    r2 = await client.post(
        f"/api/v1/projects/{slug}/event-types",
        json={"name": "se", "display_name": "SE"},
    )
    pv_id = r1.json()["id"]
    se_id = r2.json()["id"]
    f1 = await client.post(
        f"/api/v1/projects/{slug}/event-types/{pv_id}/fields",
        json={"name": "screen", "display_name": "Screen", "field_type": "string"},
    )
    f2 = await client.post(
        f"/api/v1/projects/{slug}/event-types/{se_id}/fields",
        json={"name": "screen", "display_name": "Screen", "field_type": "string"},
    )
    return pv_id, se_id, f1.json()["id"], f2.json()["id"]


@pytest.mark.asyncio
async def test_create_relation(client: AsyncClient):
    pv_id, se_id, pv_field_id, se_field_id = await _setup_relation(client)
    resp = await client.post(
        "/api/v1/projects/rel-proj/relations",
        json={
            "source_event_type_id": se_id,
            "target_event_type_id": pv_id,
            "source_field_id": se_field_id,
            "target_field_id": pv_field_id,
            "relation_type": "belongs_to",
        },
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_relations(client: AsyncClient):
    pv_id, se_id, pv_f, se_f = await _setup_relation(client, "rel-list")
    await client.post(
        "/api/v1/projects/rel-list/relations",
        json={
            "source_event_type_id": se_id,
            "target_event_type_id": pv_id,
            "source_field_id": se_f,
            "target_field_id": pv_f,
        },
    )
    resp = await client.get("/api/v1/projects/rel-list/relations")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_delete_relation(client: AsyncClient):
    pv_id, se_id, pv_f, se_f = await _setup_relation(client, "rel-del")
    create = await client.post(
        "/api/v1/projects/rel-del/relations",
        json={
            "source_event_type_id": se_id,
            "target_event_type_id": pv_id,
            "source_field_id": se_f,
            "target_field_id": pv_f,
        },
    )
    rel_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/projects/rel-del/relations/{rel_id}")
    assert resp.status_code == 204
