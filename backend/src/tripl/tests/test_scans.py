from datetime import datetime

import pytest
from httpx import AsyncClient

from tripl.services import scan_service
from tripl.worker.adapters.base import ColumnInfo


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
        assert data["json_value_paths"] == []
        assert "anomaly_detection_enabled" not in data

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

    async def test_preview_scan_config(
        self,
        client: AsyncClient,
        project: dict,
        data_source: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        class FakeAdapter:
            def test_connection(self) -> bool:
                return True

            def get_columns(self, base_query: str) -> list[ColumnInfo]:
                return [
                    ColumnInfo(name="event_name", type_name="String"),
                    ColumnInfo(name="created_at", type_name="DateTime"),
                    ColumnInfo(name="payload", type_name="JSON"),
                ]

            def get_preview_rows(
                self,
                base_query: str,
                limit: int = 10,
            ) -> tuple[list[str], list[tuple[object, ...]]]:
                return (
                    ["event_name", "created_at", "payload"],
                    [
                        (
                            "purchase",
                            datetime(2026, 4, 12, 10, 30),
                            {"extra": {"key": "TASK-123"}, "locale": "en"},
                        ),
                    ],
                )

            def close(self) -> None:
                return None

        monkeypatch.setattr(scan_service, "_build_adapter", lambda ds: FakeAdapter())

        resp = await client.post(
            f"/api/v1/projects/{project['slug']}/scans/preview",
            json={
                "data_source_id": data_source["id"],
                "base_query": "SELECT * FROM events",
                "limit": 5,
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert [column["name"] for column in body["columns"]] == [
            "event_name",
            "created_at",
            "payload",
        ]
        assert body["rows"][0]["event_name"] == "purchase"
        assert body["rows"][0]["payload"]["extra"]["key"] == "TASK-123"
        assert body["json_columns"] == [
            {
                "column": "payload",
                "paths": [
                    {
                        "full_path": "payload.extra.key",
                        "path": "extra.key",
                        "sample_values": ["TASK-123"],
                    },
                    {
                        "full_path": "payload.locale",
                        "path": "locale",
                        "sample_values": ["en"],
                    },
                ],
            }
        ]

    async def test_preview_scan_config_prefers_varied_rows(
        self,
        client: AsyncClient,
        project: dict,
        data_source: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        class FakeAdapter:
            def test_connection(self) -> bool:
                return True

            def get_columns(self, base_query: str) -> list[ColumnInfo]:
                return [
                    ColumnInfo(name="created_at", type_name="DateTime"),
                    ColumnInfo(name="page", type_name="String"),
                    ColumnInfo(name="event_type", type_name="String"),
                ]

            def get_preview_rows(
                self,
                base_query: str,
                limit: int = 10,
            ) -> tuple[list[str], list[tuple[object, ...]]]:
                assert limit >= 16
                return (
                    ["created_at", "page", "event_type"],
                    [
                        (datetime(2026, 4, 12, 10, 0), "main", "pv"),
                        (datetime(2026, 4, 12, 10, 1), "main", "pv"),
                        (datetime(2026, 4, 12, 10, 2), "pricing", "pv"),
                        (datetime(2026, 4, 12, 10, 3), "main", "signup"),
                    ],
                )

            def close(self) -> None:
                return None

        monkeypatch.setattr(scan_service, "_build_adapter", lambda ds: FakeAdapter())

        resp = await client.post(
            f"/api/v1/projects/{project['slug']}/scans/preview",
            json={
                "data_source_id": data_source["id"],
                "base_query": "SELECT * FROM events",
                "limit": 2,
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 2
        assert {row["page"] for row in body["rows"]} == {"main", "pricing"}
