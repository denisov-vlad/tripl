import pytest
from httpx import AsyncClient


@pytest.fixture
async def project(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Scan Test", "slug": "scan-test", "description": ""},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def data_source(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/v1/data-sources",
        json={
            "name": "Test CH",
            "db_type": "clickhouse",
            "host": "localhost",
            "port": 8123,
            "database_name": "test_db",
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def event_type(client: AsyncClient, project: dict) -> dict:
    resp = await client.post(
        f"/api/v1/projects/{project['slug']}/event-types",
        json={"name": "pv", "display_name": "Page View"},
    )
    assert resp.status_code == 201
    return resp.json()


class TestScanConfigsCRUD:
    async def test_create_scan_config(
        self, client: AsyncClient, project: dict, data_source: dict, event_type: dict
    ):
        resp = await client.post(
            f"/api/v1/projects/{project['slug']}/scans",
            json={
                "data_source_id": data_source["id"],
                "name": "Daily scan",
                "base_query": "SELECT * FROM events",
                "event_type_id": event_type["id"],
                "cardinality_threshold": 50,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Daily scan"
        assert data["base_query"] == "SELECT * FROM events"
        assert data["event_type_id"] == event_type["id"]
        assert data["cardinality_threshold"] == 50
        assert data["data_source_id"] == data_source["id"]
        assert data["project_id"] == project["id"]

    async def test_list_scan_configs(self, client: AsyncClient, project: dict, data_source: dict):
        for i in range(3):
            await client.post(
                f"/api/v1/projects/{project['slug']}/scans",
                json={
                    "data_source_id": data_source["id"],
                    "name": f"Scan {i}",
                    "base_query": f"SELECT * FROM t{i}",
                },
            )
        resp = await client.get(
            f"/api/v1/projects/{project['slug']}/scans"
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    async def test_update_scan_config(self, client: AsyncClient, project: dict, data_source: dict):
        create_resp = await client.post(
            f"/api/v1/projects/{project['slug']}/scans",
            json={"data_source_id": data_source["id"], "name": "Old", "base_query": "SELECT 1"},
        )
        scan_id = create_resp.json()["id"]
        resp = await client.patch(
            f"/api/v1/projects/{project['slug']}/scans/{scan_id}",
            json={"name": "New", "cardinality_threshold": 200},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"
        assert resp.json()["cardinality_threshold"] == 200

    async def test_delete_scan_config(self, client: AsyncClient, project: dict, data_source: dict):
        create_resp = await client.post(
            f"/api/v1/projects/{project['slug']}/scans",
            json={"data_source_id": data_source["id"], "name": "DelMe", "base_query": "SELECT 1"},
        )
        scan_id = create_resp.json()["id"]
        resp = await client.delete(
            f"/api/v1/projects/{project['slug']}/scans/{scan_id}"
        )
        assert resp.status_code == 204

    async def test_scan_config_not_found(
        self, client: AsyncClient, project: dict
    ):
        resp = await client.get(
            f"/api/v1/projects/{project['slug']}/scans/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404

    async def test_duplicate_name_conflict(
        self, client: AsyncClient, project: dict, data_source: dict
    ):
        payload = {"data_source_id": data_source["id"], "name": "Same", "base_query": "SELECT 1"}
        base = f"/api/v1/projects/{project['slug']}/scans"
        r1 = await client.post(base, json=payload)
        assert r1.status_code == 201
        r2 = await client.post(base, json=payload)
        assert r2.status_code == 409
