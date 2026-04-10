from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from math import sqrt
from statistics import fmean, median

import numpy as np
from statsmodels.tsa.seasonal import MSTL, STL

SCOPE_PROJECT_TOTAL = "project_total"
SCOPE_EVENT_TYPE = "event_type"
SCOPE_EVENT = "event"
_SEASONAL_PERIODS_BY_INTERVAL_SECONDS: dict[int, tuple[int, ...]] = {
    15 * 60: (96, 96 * 7),
    60 * 60: (24, 24 * 7),
    6 * 60 * 60: (4, 4 * 7),
    24 * 60 * 60: (7,),
}
_MIN_CYCLES_PER_PERIOD = 2


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


def _select_seasonal_periods(interval: timedelta, series_length: int) -> tuple[int, ...]:
    interval_seconds = int(interval.total_seconds())
    candidates = _SEASONAL_PERIODS_BY_INTERVAL_SECONDS.get(interval_seconds, ())
    return tuple(
        period
        for period in candidates
        if series_length >= period * _MIN_CYCLES_PER_PERIOD
    )


def _rolling_stats(values: list[float]) -> tuple[float, float]:
    mean_value = fmean(values)
    variance = fmean((value - mean_value) ** 2 for value in values)
    return mean_value, sqrt(variance)


def _robust_scale(values: list[float]) -> float:
    if not values:
        return 0.0

    center = median(values)
    absolute_deviations = [abs(value - center) for value in values]
    mad = median(absolute_deviations)
    if mad > 0:
        return 1.4826 * mad

    _mean, stddev = _rolling_stats(values)
    return stddev


def _fit_expected_series(
    counts: list[int],
    *,
    interval: timedelta,
) -> tuple[list[float], list[float]] | None:
    periods = _select_seasonal_periods(interval, len(counts))
    if not periods:
        return None

    values = np.asarray(counts, dtype=float)

    try:
        if len(periods) == 1:
            result = STL(values, period=periods[0], robust=True).fit()
            seasonal = np.asarray(result.seasonal, dtype=float)
        else:
            result = MSTL(values, periods=periods, stl_kwargs={"robust": True}).fit()
            seasonal_components = np.asarray(result.seasonal, dtype=float)
            seasonal = (
                seasonal_components
                if seasonal_components.ndim == 1
                else seasonal_components.sum(axis=1)
            )
        trend = np.asarray(result.trend, dtype=float)
        residuals = np.asarray(result.resid, dtype=float)
    except Exception:
        return None

    expected = trend + seasonal
    return expected.tolist(), residuals.tolist()


def _detect_with_rolling_baseline(
    expanded: list[SeriesPoint],
    *,
    evaluation_start: datetime,
    settings: AnomalyDetectionSettings,
) -> list[DetectedAnomaly]:
    anomalies: list[DetectedAnomaly] = []
    counts = [point.count for point in expanded]

    for idx, point in enumerate(expanded):
        if point.bucket < evaluation_start:
            continue

        window_start = max(0, idx - settings.baseline_window_buckets)
        baseline = counts[window_start:idx]
        if len(baseline) < settings.min_history_buckets:
            continue

        expected_count, stddev = _rolling_stats(baseline)
        if expected_count < settings.min_expected_count:
            continue

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

    expected_series = _fit_expected_series(
        [point.count for point in expanded],
        interval=interval,
    )
    if expected_series is None:
        return _detect_with_rolling_baseline(
            expanded,
            evaluation_start=evaluation_start,
            settings=settings,
        )

    anomalies: list[DetectedAnomaly] = []
    expected_counts, residuals = expected_series

    for idx, point in enumerate(expanded):
        if point.bucket < evaluation_start:
            continue

        window_start = max(0, idx - settings.baseline_window_buckets)
        baseline_residuals = residuals[window_start:idx]
        if len(baseline_residuals) < settings.min_history_buckets:
            continue

        expected_count = max(float(expected_counts[idx]), 0.0)
        if expected_count < settings.min_expected_count:
            continue

        stddev = _robust_scale(baseline_residuals)
        effective_stddev = stddev if stddev > 0 else 1.0
        z_score = residuals[idx] / effective_stddev
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
