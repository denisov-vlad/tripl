from __future__ import annotations

from datetime import UTC, datetime, timedelta

RECENT_SIGNAL_WINDOW = timedelta(hours=24)


def classify_signal_state(
    *,
    anomaly_bucket: datetime,
    latest_metric_bucket: datetime | None,
) -> str | None:
    if latest_metric_bucket is None or anomaly_bucket >= latest_metric_bucket:
        return "latest_scan"

    recent_cutoff = datetime.now(UTC)
    if anomaly_bucket.tzinfo is None:
        recent_cutoff = recent_cutoff.replace(tzinfo=None)
    recent_cutoff -= RECENT_SIGNAL_WINDOW
    if anomaly_bucket >= recent_cutoff:
        return "recent"

    return None
