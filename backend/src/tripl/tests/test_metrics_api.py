import uuid
from datetime import UTC, datetime
from typing import TypedDict

import pytest
from httpx import AsyncClient

from tripl.models.data_source import DataSource
from tripl.models.event_metric import EventMetric
from tripl.models.scan_config import ScanConfig
from tripl.tests.conftest import TestSessionLocal


class EventMetricSeedRow(TypedDict):
    event_id: str
    counts: list[int]


async def _setup_metrics_project(
    client: AsyncClient,
    slug: str = "metrics-api",
) -> dict[str, str]:
    project_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Metrics API", "slug": slug},
    )
    project_id = project_resp.json()["id"]

    event_types: list[tuple[str, str]] = []
    for name, display_name in [("page", "Page"), ("track", "Track")]:
        et_resp = await client.post(
            f"/api/v1/projects/{slug}/event-types",
            json={"name": name, "display_name": display_name},
        )
        et_id = et_resp.json()["id"]
        field_resp = await client.post(
            f"/api/v1/projects/{slug}/event-types/{et_id}/fields",
            json={
                "name": "screen",
                "display_name": "Screen",
                "field_type": "string",
                "is_required": True,
            },
        )
        event_types.append((et_id, field_resp.json()["id"]))

    return {
        "project_id": project_id,
        "page_type_id": event_types[0][0],
        "page_field_id": event_types[0][1],
        "track_type_id": event_types[1][0],
        "track_field_id": event_types[1][1],
    }


async def _seed_group_metrics(project_id: str, event_rows: list[EventMetricSeedRow]) -> None:
    buckets = [
        datetime(2026, 1, 1, 10, tzinfo=UTC),
        datetime(2026, 1, 1, 11, tzinfo=UTC),
    ]

    async with TestSessionLocal() as session:
        data_source = DataSource(
            id=uuid.uuid4(),
            name=f"Metrics DS {uuid.uuid4().hex[:8]}",
            db_type="clickhouse",
            host="localhost",
            port=8123,
            database_name="default",
            username="default",
            password_encrypted="",
        )
        scan_config = ScanConfig(
            id=uuid.uuid4(),
            data_source_id=data_source.id,
            project_id=uuid.UUID(project_id),
            event_type_id=None,
            name="Metrics Config",
            base_query="SELECT time, event_name FROM events",
            event_type_column="event_name",
            time_column="time",
            cardinality_threshold=100,
            interval="1h",
        )
        session.add_all([data_source, scan_config])

        for event_row in event_rows:
            for bucket, count in zip(buckets, event_row["counts"], strict=True):
                session.add(
                    EventMetric(
                        id=uuid.uuid4(),
                        scan_config_id=scan_config.id,
                        event_id=uuid.UUID(event_row["event_id"]),
                        event_type_id=None,
                        bucket=bucket,
                        count=count,
                    )
                )

        await session.commit()


@pytest.mark.asyncio
async def test_get_events_metrics_aggregates_matching_events(client: AsyncClient) -> None:
    setup = await _setup_metrics_project(client, "metrics-group")

    event_1 = await client.post(
        "/api/v1/projects/metrics-group/events",
        json={
            "event_type_id": setup["page_type_id"],
            "name": "Alpha Viewed",
            "implemented": True,
            "reviewed": True,
            "tags": ["mobile"],
            "field_values": [{"field_definition_id": setup["page_field_id"], "value": "home"}],
        },
    )
    event_2 = await client.post(
        "/api/v1/projects/metrics-group/events",
        json={
            "event_type_id": setup["page_type_id"],
            "name": "Beta Review",
            "implemented": False,
            "reviewed": False,
            "tags": ["web"],
            "field_values": [{"field_definition_id": setup["page_field_id"], "value": "pricing"}],
        },
    )
    event_3 = await client.post(
        "/api/v1/projects/metrics-group/events",
        json={
            "event_type_id": setup["track_type_id"],
            "name": "Gamma Archived",
            "implemented": True,
            "reviewed": True,
            "archived": True,
            "tags": ["mobile"],
            "field_values": [{"field_definition_id": setup["track_field_id"], "value": "checkout"}],
        },
    )

    await _seed_group_metrics(
        setup["project_id"],
        [
            {"event_id": event_1.json()["id"], "counts": [10, 15]},
            {"event_id": event_2.json()["id"], "counts": [5, 7]},
            {"event_id": event_3.json()["id"], "counts": [20, 30]},
        ],
    )

    resp = await client.get("/api/v1/projects/metrics-group/events-metrics")

    assert resp.status_code == 200
    body = resp.json()
    assert body["interval"] == "1h"
    assert body["data"] == [
        {"bucket": "2026-01-01T10:00:00", "count": 35},
        {"bucket": "2026-01-01T11:00:00", "count": 52},
    ]


@pytest.mark.asyncio
async def test_get_events_metrics_applies_event_filters(client: AsyncClient) -> None:
    setup = await _setup_metrics_project(client, "metrics-filters")

    event_1 = await client.post(
        "/api/v1/projects/metrics-filters/events",
        json={
            "event_type_id": setup["page_type_id"],
            "name": "Alpha Viewed",
            "implemented": True,
            "reviewed": True,
            "tags": ["mobile"],
            "field_values": [{"field_definition_id": setup["page_field_id"], "value": "home"}],
        },
    )
    event_2 = await client.post(
        "/api/v1/projects/metrics-filters/events",
        json={
            "event_type_id": setup["page_type_id"],
            "name": "Beta Review",
            "implemented": False,
            "reviewed": False,
            "tags": ["web"],
            "field_values": [{"field_definition_id": setup["page_field_id"], "value": "pricing"}],
        },
    )
    event_3 = await client.post(
        "/api/v1/projects/metrics-filters/events",
        json={
            "event_type_id": setup["track_type_id"],
            "name": "Gamma Archived",
            "implemented": True,
            "reviewed": True,
            "archived": True,
            "tags": ["mobile"],
            "field_values": [{"field_definition_id": setup["track_field_id"], "value": "checkout"}],
        },
    )

    await _seed_group_metrics(
        setup["project_id"],
        [
            {"event_id": event_1.json()["id"], "counts": [10, 15]},
            {"event_id": event_2.json()["id"], "counts": [5, 7]},
            {"event_id": event_3.json()["id"], "counts": [20, 30]},
        ],
    )

    reviewed_resp = await client.get(
        "/api/v1/projects/metrics-filters/events-metrics?reviewed=false"
    )
    assert reviewed_resp.status_code == 200
    assert reviewed_resp.json()["data"] == [
        {"bucket": "2026-01-01T10:00:00", "count": 5},
        {"bucket": "2026-01-01T11:00:00", "count": 7},
    ]

    archived_resp = await client.get(
        "/api/v1/projects/metrics-filters/events-metrics?archived=true"
    )
    assert archived_resp.status_code == 200
    assert archived_resp.json()["data"] == [
        {"bucket": "2026-01-01T10:00:00", "count": 20},
        {"bucket": "2026-01-01T11:00:00", "count": 30},
    ]

    type_resp = await client.get(
        f"/api/v1/projects/metrics-filters/events-metrics?event_type_id={setup['page_type_id']}"
    )
    assert type_resp.status_code == 200
    assert type_resp.json()["data"] == [
        {"bucket": "2026-01-01T10:00:00", "count": 15},
        {"bucket": "2026-01-01T11:00:00", "count": 22},
    ]
