from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from math import sqrt
from statistics import fmean

SCOPE_PROJECT_TOTAL = "project_total"
SCOPE_EVENT_TYPE = "event_type"
SCOPE_EVENT = "event"


@dataclass(frozen=True)
class AnomalyDetectionSettings:
    baseline_window_buckets: int
    min_history_buckets: int
    sigma_threshold: float
    min_expected_count: int


@dataclass(frozen=True)
class SeriesPoint:
    bucket: datetime
    count: int


@dataclass(frozen=True)
class DetectedAnomaly:
    bucket: datetime
    actual_count: int
    expected_count: float
    stddev: float
    z_score: float
    direction: str


def expand_series(
    points: list[SeriesPoint],
    *,
    interval: timedelta,
    end_exclusive: datetime,
) -> list[SeriesPoint]:
    if not points:
        return []

    counts_by_bucket = {point.bucket: point.count for point in points}
    bucket = min(counts_by_bucket)
    expanded: list[SeriesPoint] = []
    while bucket < end_exclusive:
        expanded.append(SeriesPoint(bucket=bucket, count=counts_by_bucket.get(bucket, 0)))
        bucket += interval
    return expanded


def detect_anomalies(
    points: list[SeriesPoint],
    *,
    interval: timedelta,
    evaluation_start: datetime,
    evaluation_end: datetime,
    settings: AnomalyDetectionSettings,
) -> list[DetectedAnomaly]:
    expanded = expand_series(points, interval=interval, end_exclusive=evaluation_end)
    if not expanded:
        return []

    anomalies: list[DetectedAnomaly] = []
    counts = [point.count for point in expanded]

    for idx, point in enumerate(expanded):
        if point.bucket < evaluation_start:
            continue

        window_start = max(0, idx - settings.baseline_window_buckets)
        baseline = counts[window_start:idx]
        if len(baseline) < settings.min_history_buckets:
            continue

        expected_count = fmean(baseline)
        if expected_count < settings.min_expected_count:
            continue

        variance = fmean((value - expected_count) ** 2 for value in baseline)
        stddev = sqrt(variance)
        effective_stddev = stddev if stddev > 0 else 1.0
        z_score = (point.count - expected_count) / effective_stddev
        if abs(z_score) < settings.sigma_threshold:
            continue

        anomalies.append(
            DetectedAnomaly(
                bucket=point.bucket,
                actual_count=point.count,
                expected_count=expected_count,
                stddev=stddev,
                z_score=z_score,
                direction="spike" if z_score > 0 else "drop",
            )
        )

    return anomalies
