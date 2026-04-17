from datetime import UTC, datetime, timedelta

from tripl.worker.analyzers.anomaly_detector import (
    AnomalyDetectionSettings,
    SeriesPoint,
    detect_anomalies,
)


def _bucket(hour: int) -> datetime:
    return datetime(2026, 1, 1, tzinfo=UTC) + timedelta(hours=hour)


def _daily_pattern_count(hour: int) -> int:
    hour_of_day = hour % 24
    if 9 <= hour_of_day < 12:
        return 60
    if 18 <= hour_of_day < 20:
        return 35
    return 12


SETTINGS = AnomalyDetectionSettings(
    baseline_window_buckets=14,
    min_history_buckets=7,
    sigma_threshold=3.0,
    min_expected_count=10,
)


def test_detect_anomalies_returns_empty_for_stable_series() -> None:
    points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(10)]

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(7),
        evaluation_end=_bucket(10),
        settings=SETTINGS,
    )

    assert anomalies == []


def test_detect_anomalies_detects_spike_and_drop() -> None:
    spike_points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(10)]
    spike_points.append(SeriesPoint(bucket=_bucket(10), count=40))
    spike_anomalies = detect_anomalies(
        spike_points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(10),
        evaluation_end=_bucket(11),
        settings=SETTINGS,
    )

    drop_points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(10)]
    drop_points.append(SeriesPoint(bucket=_bucket(10), count=0))
    drop_anomalies = detect_anomalies(
        drop_points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(10),
        evaluation_end=_bucket(11),
        settings=SETTINGS,
    )

    assert [anomaly.direction for anomaly in spike_anomalies] == ["spike"]
    assert [anomaly.direction for anomaly in drop_anomalies] == ["drop"]
    assert spike_anomalies[0].bucket == _bucket(10)
    assert drop_anomalies[0].bucket == _bucket(10)


def test_detect_anomalies_uses_effective_stddev_for_flat_baseline() -> None:
    points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(8)]
    points.append(SeriesPoint(bucket=_bucket(8), count=14))

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(8),
        evaluation_end=_bucket(9),
        settings=SETTINGS,
    )

    assert len(anomalies) == 1
    assert anomalies[0].stddev == 0
    assert anomalies[0].z_score == 4


def test_detect_anomalies_respects_min_history_gate() -> None:
    points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(6)]
    points.append(SeriesPoint(bucket=_bucket(6), count=40))

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(6),
        evaluation_end=_bucket(7),
        settings=SETTINGS,
    )

    assert anomalies == []


def test_detect_anomalies_respects_min_expected_count_gate() -> None:
    low_settings = AnomalyDetectionSettings(
        baseline_window_buckets=14,
        min_history_buckets=7,
        sigma_threshold=3.0,
        min_expected_count=20,
    )
    points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(8)]
    points.append(SeriesPoint(bucket=_bucket(8), count=0))

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(8),
        evaluation_end=_bucket(9),
        settings=low_settings,
    )

    assert anomalies == []


def test_detect_anomalies_zero_fills_gaps_after_first_seen_bucket() -> None:
    points = [SeriesPoint(bucket=_bucket(hour), count=10) for hour in range(8)]

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(8),
        evaluation_end=_bucket(9),
        settings=SETTINGS,
    )

    assert len(anomalies) == 1
    assert anomalies[0].bucket == _bucket(8)
    assert anomalies[0].actual_count == 0
    assert anomalies[0].direction == "drop"


def test_detect_anomalies_respects_repeating_daily_pattern_with_stl() -> None:
    points = [
        SeriesPoint(bucket=_bucket(hour), count=_daily_pattern_count(hour))
        for hour in range(24 * 10)
    ]

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(24 * 10 - 1),
        evaluation_end=_bucket(24 * 10),
        settings=SETTINGS,
    )

    assert anomalies == []


def test_detect_anomalies_detects_spike_on_top_of_repeating_daily_pattern() -> None:
    points = [
        SeriesPoint(bucket=_bucket(hour), count=_daily_pattern_count(hour))
        for hour in range(24 * 10)
    ]
    anomaly_hour = 24 * 10 - 15  # 09:00 in the last day
    points[anomaly_hour] = SeriesPoint(bucket=_bucket(anomaly_hour), count=160)

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(anomaly_hour),
        evaluation_end=_bucket(24 * 10),
        settings=SETTINGS,
    )

    spike_anomaly = next(
        anomaly for anomaly in anomalies if anomaly.bucket == _bucket(anomaly_hour)
    )
    assert spike_anomaly.direction == "spike"
    assert spike_anomaly.expected_count > 30


def test_detect_anomalies_detects_sustained_growth_on_top_of_daily_pattern() -> None:
    points = [
        SeriesPoint(bucket=_bucket(hour), count=_daily_pattern_count(hour))
        for hour in range(24 * 10)
    ]
    growth_hours = [24 * 10 - 15, 24 * 10 - 14, 24 * 10 - 13]  # 09:00, 10:00, 11:00
    for hour in growth_hours:
        points[hour] = SeriesPoint(bucket=_bucket(hour), count=_daily_pattern_count(hour) + 35)

    anomalies = detect_anomalies(
        points,
        interval=timedelta(hours=1),
        evaluation_start=_bucket(24 * 10 - 24),
        evaluation_end=_bucket(24 * 10),
        settings=SETTINGS,
    )

    anomaly_buckets = {anomaly.bucket for anomaly in anomalies}
    assert _bucket(growth_hours[-1]) in anomaly_buckets
    sustained_anomaly = next(
        anomaly for anomaly in anomalies if anomaly.bucket == _bucket(growth_hours[-1])
    )
    assert sustained_anomaly.direction == "spike"
    assert sustained_anomaly.actual_count == _daily_pattern_count(growth_hours[-1]) + 35
