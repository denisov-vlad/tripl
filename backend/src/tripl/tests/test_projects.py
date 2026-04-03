import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient):
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Test Project", "slug": "test-project", "description": "A test"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Project"
    assert data["slug"] == "test-project"


@pytest.mark.asyncio
async def test_create_project_duplicate_slug(client: AsyncClient):
    await client.post(
        "/api/v1/projects",
        json={"name": "P1", "slug": "dup-slug"},
    )
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "P2", "slug": "dup-slug"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient):
    await client.post("/api/v1/projects", json={"name": "A", "slug": "list-a"})
    await client.post("/api/v1/projects", json={"name": "B", "slug": "list-b"})
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_get_project(client: AsyncClient):
    await client.post("/api/v1/projects", json={"name": "Get Me", "slug": "get-me"})
    resp = await client.get("/api/v1/projects/get-me")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "get-me"


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/projects/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client: AsyncClient):
    await client.post("/api/v1/projects", json={"name": "Old", "slug": "upd-me"})
    resp = await client.patch("/api/v1/projects/upd-me", json={"name": "New"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient):
    await client.post("/api/v1/projects", json={"name": "Del", "slug": "del-me"})
    resp = await client.delete("/api/v1/projects/del-me")
    assert resp.status_code == 204
    resp = await client.get("/api/v1/projects/del-me")
    assert resp.status_code == 404
