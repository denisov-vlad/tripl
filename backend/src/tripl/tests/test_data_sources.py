import pytest
from httpx import AsyncClient


class TestDataSourcesCRUD:
    async def test_create_data_source(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/data-sources",
            json={
                "name": "My CH",
                "db_type": "clickhouse",
                "host": "localhost",
                "port": 8123,
                "database_name": "analytics",
                "username": "default",
                "password": "secret",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My CH"
        assert data["db_type"] == "clickhouse"
        assert data["host"] == "localhost"
        assert data["port"] == 8123
        assert data["database_name"] == "analytics"
        assert data["username"] == "default"
        assert data["password_set"] is True
        assert "password" not in data
        assert "password_encrypted" not in data
        assert "project_id" not in data

    async def test_list_data_sources(self, client: AsyncClient):
        await client.post(
            "/api/v1/data-sources",
            json={
                "name": "DS1",
                "db_type": "clickhouse",
                "host": "h1",
                "port": 8123,
                "database_name": "db1",
            },
        )
        await client.post(
            "/api/v1/data-sources",
            json={
                "name": "DS2",
                "db_type": "clickhouse",
                "host": "h2",
                "port": 9000,
                "database_name": "db2",
            },
        )
        resp = await client.get("/api/v1/data-sources")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_get_data_source(self, client: AsyncClient):
        create_resp = await client.post(
            "/api/v1/data-sources",
            json={
                "name": "GetMe",
                "db_type": "clickhouse",
                "host": "h",
                "port": 8123,
                "database_name": "d",
            },
        )
        ds_id = create_resp.json()["id"]
        resp = await client.get(f"/api/v1/data-sources/{ds_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "GetMe"

    async def test_update_data_source(self, client: AsyncClient):
        create_resp = await client.post(
            "/api/v1/data-sources",
            json={
                "name": "Old",
                "db_type": "clickhouse",
                "host": "h",
                "port": 8123,
                "database_name": "d",
            },
        )
        ds_id = create_resp.json()["id"]
        resp = await client.patch(
            f"/api/v1/data-sources/{ds_id}",
            json={"name": "New", "host": "new-host"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"
        assert resp.json()["host"] == "new-host"

    async def test_delete_data_source(self, client: AsyncClient):
        create_resp = await client.post(
            "/api/v1/data-sources",
            json={
                "name": "DeleteMe",
                "db_type": "clickhouse",
                "host": "h",
                "port": 8123,
                "database_name": "d",
            },
        )
        ds_id = create_resp.json()["id"]
        resp = await client.delete(f"/api/v1/data-sources/{ds_id}")
        assert resp.status_code == 204

        resp = await client.get(f"/api/v1/data-sources/{ds_id}")
        assert resp.status_code == 404

    async def test_duplicate_name_conflict(self, client: AsyncClient):
        payload = {
            "name": "Dup",
            "db_type": "clickhouse",
            "host": "h",
            "port": 8123,
            "database_name": "d",
        }
        resp1 = await client.post("/api/v1/data-sources", json=payload)
        assert resp1.status_code == 201
        resp2 = await client.post("/api/v1/data-sources", json=payload)
        assert resp2.status_code == 409

    async def test_not_found(self, client: AsyncClient):
        resp = await client.get("/api/v1/data-sources/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404
