import uuid
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from _pytest.monkeypatch import MonkeyPatch
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from tripl.models import Base
from tripl.models.data_source import DataSource
from tripl.models.event_type import EventType
from tripl.models.project import Project
from tripl.models.scan_config import ScanConfig
from tripl.models.scan_job import ScanJob, ScanJobStatus
from tripl.worker.adapters.base import ColumnInfo
from tripl.worker.analyzers.event_generator import GenerationResult
from tripl.worker.tasks import metrics


@pytest.fixture
def sync_session_factory(tmp_path: Path) -> Iterator[sessionmaker[Session]]:
    engine = create_engine(f"sqlite:///{tmp_path / 'metrics_tasks.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


def _create_scan_config(session: Session, *, with_event_type: bool = False) -> ScanConfig:
    project = Project(
        id=uuid.uuid4(),
        name="Metrics Project",
        slug=f"metrics-{uuid.uuid4().hex[:8]}",
        description="",
    )
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
    session.add_all([project, data_source])

    event_type_id = None
    if with_event_type:
        event_type = EventType(
            id=uuid.uuid4(),
            project_id=project.id,
            name="structured",
            display_name="Structured",
            description="",
        )
        session.add(event_type)
        event_type_id = event_type.id

    config = ScanConfig(
        id=uuid.uuid4(),
        data_source_id=data_source.id,
        project_id=project.id,
        event_type_id=event_type_id,
        name="Structured Events",
        base_query="SELECT time, event_name FROM events",
        time_column="time",
        cardinality_threshold=100,
        interval="1h",
    )
    session.add(config)
    session.commit()
    return config


def test_check_metrics_due_skips_dispatch_when_active_job_exists(
    sync_session_factory: sessionmaker[Session],
    monkeypatch: MonkeyPatch,
) -> None:
    with sync_session_factory() as session:
        config = _create_scan_config(session)
        job = ScanJob(
            id=uuid.uuid4(),
            scan_config_id=config.id,
            status=ScanJobStatus.pending.value,
        )
        session.add(job)
        session.commit()
        config_id = config.id
        job_id = job.id

    dispatched: list[tuple[str, str]] = []
    monkeypatch.setattr(metrics, "_get_sync_session", sync_session_factory)

    def fake_delay(scan_config_id: str, scan_job_id: str) -> None:
        dispatched.append((scan_config_id, scan_job_id))

    monkeypatch.setattr(
        metrics.collect_metrics,
        "delay",
        fake_delay,
    )

    result = metrics.check_metrics_due.run()

    assert result == {"checked": 1, "dispatched": 0}
    assert dispatched == []

    with sync_session_factory() as session:
        jobs = (
            session.execute(select(ScanJob).where(ScanJob.scan_config_id == config_id))
            .scalars()
            .all()
        )
    assert len(jobs) == 1
    assert jobs[0].id == job_id
    assert jobs[0].status == ScanJobStatus.pending.value


def test_check_metrics_due_creates_pending_job_before_dispatch(
    sync_session_factory: sessionmaker[Session],
    monkeypatch: MonkeyPatch,
) -> None:
    with sync_session_factory() as session:
        config = _create_scan_config(session)
        config_id = config.id

    dispatched: list[tuple[str, str]] = []
    monkeypatch.setattr(metrics, "_get_sync_session", sync_session_factory)

    def fake_delay(scan_config_id: str, scan_job_id: str) -> None:
        dispatched.append((scan_config_id, scan_job_id))

    monkeypatch.setattr(
        metrics.collect_metrics,
        "delay",
        fake_delay,
    )

    result = metrics.check_metrics_due.run()

    assert result == {"checked": 1, "dispatched": 1}
    assert dispatched[0][0] == str(config_id)

    with sync_session_factory() as session:
        jobs = (
            session.execute(select(ScanJob).where(ScanJob.scan_config_id == config_id))
            .scalars()
            .all()
        )

    assert len(jobs) == 1
    assert str(jobs[0].id) == dispatched[0][1]
    assert jobs[0].status == ScanJobStatus.pending.value
    assert jobs[0].started_at is None


def test_collect_metrics_reuses_existing_pending_job(
    sync_session_factory: sessionmaker[Session],
    monkeypatch: MonkeyPatch,
) -> None:
    with sync_session_factory() as session:
        config = _create_scan_config(session, with_event_type=True)
        job = ScanJob(
            id=uuid.uuid4(),
            scan_config_id=config.id,
            status=ScanJobStatus.pending.value,
        )
        session.add(job)
        session.commit()
        config_id = str(config.id)
        job_id = str(job.id)

    class FakeAdapter:
        def test_connection(self) -> bool:
            return True

        def get_columns(self, base_query: str) -> list[ColumnInfo]:
            return [
                ColumnInfo(name="time", type_name="DateTime"),
                ColumnInfo(name="event_name", type_name="String"),
            ]

        def get_time_bucketed_counts(
            self,
            base_query: str,
            time_column: str,
            ch_interval: str,
            regular_columns: list[str],
            json_columns: list[str],
            time_from: datetime,
            time_to: datetime,
            limit: int = 100000,
        ) -> tuple[list[str], list[tuple[object, ...]]]:
            return (["event_name"], [])

        def close(self) -> None:
            return None

    monkeypatch.setattr(metrics, "_get_sync_session", sync_session_factory)

    def build_fake_adapter(ds: DataSource) -> FakeAdapter:
        return FakeAdapter()

    def fake_analyze_cardinality(*args: object, **kwargs: object) -> object:
        return object()

    def fake_generate_events(*args: object, **kwargs: object) -> GenerationResult:
        return GenerationResult(columns_analyzed=1)

    monkeypatch.setattr(metrics, "_build_adapter", build_fake_adapter)
    monkeypatch.setattr(metrics, "analyze_cardinality", fake_analyze_cardinality)
    monkeypatch.setattr(
        metrics,
        "generate_events",
        fake_generate_events,
    )

    result = metrics.collect_metrics.run(config_id, job_id)

    assert result["event_metrics"] == 0
    assert result["type_metrics"] == 0

    with sync_session_factory() as session:
        jobs = (
            session.execute(select(ScanJob).where(ScanJob.scan_config_id == uuid.UUID(config_id)))
            .scalars()
            .all()
        )

    assert len(jobs) == 1
    assert str(jobs[0].id) == job_id
    assert jobs[0].status == ScanJobStatus.completed.value
    assert jobs[0].started_at is not None
    assert jobs[0].completed_at is not None
    assert jobs[0].result_summary is not None
    assert jobs[0].result_summary["columns_analyzed"] == 1
