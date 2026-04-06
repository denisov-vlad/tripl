"""Generate events from breakdown analysis results.

Takes breakdown analysis (per-column cardinality stats + raw GROUP BY ALL rows)
and produces deduplicated Event + EventFieldValue records.  Each breakdown row
maps to one event, preserving actual column correlations from the data.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from tripl.models.event import Event
from tripl.models.event_field_value import EventFieldValue
from tripl.models.field_definition import FieldDefinition
from tripl.models.variable import Variable
from tripl.worker.analyzers.cardinality import BreakdownAnalysis
from tripl.worker.analyzers.variable_detector import (
    DetectedPattern,
    detect_variables,
)

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    events_created: int = 0
    events_skipped: int = 0
    variables_created: int = 0
    columns_analyzed: int = 0
    details: list[str] = field(default_factory=list)


def generate_events(
    session: Session,
    project_id: uuid.UUID,
    event_type_id: uuid.UUID,
    analysis: BreakdownAnalysis,
    field_definitions: dict[str, FieldDefinition],
    cardinality_threshold: int = 100,
    event_type_column: str | None = None,
    max_events: int = 10000,
) -> GenerationResult:
    """Generate events from breakdown analysis.

    Each row from the GROUP BY ALL breakdown becomes one event.
    Low-cardinality columns use actual values from the row,
    high-cardinality columns use detected templates with ${var} placeholders,
    JSON columns use their actual path combo from the row.
    """
    result = GenerationResult()
    cardinality_results = analysis.results
    reg_index = {name: i for i, name in enumerate(analysis.reg_names)}
    json_index = {name: i for i, name in enumerate(analysis.json_names)}
    n_reg = len(analysis.reg_names)

    # Pre-compute per-column metadata
    col_meta: dict[str, dict] = {}

    for col_name, card_result in cardinality_results.items():
        if col_name == event_type_column:
            continue

        fd = field_definitions.get(col_name)
        if fd is None:
            result.details.append(f"Skipped column {col_name!r}: no matching field definition")
            continue

        result.columns_analyzed += 1
        meta: dict = {"fd_id": fd.id, "col_name": col_name}

        if card_result.json_path_combos is not None:
            meta["is_json"] = True
            all_paths: set[str] = set()
            for combo in card_result.json_path_combos:
                for path in combo:
                    all_paths.add(path)
            for path in sorted(all_paths):
                var_name = f"{col_name}.{path}"
                result.variables_created += _ensure_variable(
                    session, project_id, var_name, "string"
                )
            logger.info(
                f"  {col_name}: JSON, {len(card_result.json_path_combos)} path combos, "
                f"{len(all_paths)} variables"
            )
        else:
            meta["is_json"] = False
            meta["is_low"] = card_result.is_low
            if not card_result.is_low:
                pattern = detect_variables(
                    col_name, card_result.sample_values, cardinality_threshold
                )
                if pattern is None:
                    pattern = DetectedPattern(
                        template=f"${{{col_name}}}",
                        variables=[],
                        coverage_pct=100.0,
                    )
                for var in pattern.variables:
                    result.variables_created += _ensure_variable(
                        session, project_id, var.name, var.inferred_type
                    )
                meta["template"] = pattern.template

        col_meta[col_name] = meta

    if not col_meta:
        result.details.append("No columns matched field definitions")
        return result

    # Iterate breakdown rows — each row is one event
    existing_names = _get_existing_event_names(session, project_id, event_type_id)
    seen_names: set[str] = set()

    for row in analysis.rows:
        if result.events_created >= max_events:
            result.details.append(f"Reached max_events limit ({max_events})")
            break

        field_values: list[tuple[uuid.UUID, str, str]] = []

        for col_name, meta in col_meta.items():
            if meta["is_json"]:
                j = json_index.get(col_name)
                if j is None:
                    continue
                paths = row[n_reg + j]
                if paths:
                    if isinstance(paths, (list, tuple)):
                        sorted_paths = sorted(str(p) for p in paths)
                    else:
                        sorted_paths = [str(paths)]
                    json_obj = {p: f"${{{col_name}.{p}}}" for p in sorted_paths}
                    value = json.dumps(json_obj, ensure_ascii=False, sort_keys=True)
                else:
                    value = "{}"
            elif meta["is_low"]:
                i = reg_index.get(col_name)
                if i is None:
                    continue
                raw_val = row[i]
                value = str(raw_val) if raw_val is not None else ""
            else:
                value = meta["template"]

            field_values.append((meta["fd_id"], col_name, value))

        # Build event name
        parts = []
        for _, col_name, value in field_values:
            display = value if len(value) <= 80 else value[:77] + "..."
            parts.append(f"{col_name}={display}")
        event_name = " | ".join(parts)

        if event_name in existing_names or event_name in seen_names:
            result.events_skipped += 1
            continue

        event = Event(
            id=uuid.uuid4(),
            project_id=project_id,
            event_type_id=event_type_id,
            name=event_name,
            description="Auto-generated from data source scan",
            implemented=False,
        )
        session.add(event)
        session.flush()

        for fd_id, _, value in field_values:
            fv = EventFieldValue(
                id=uuid.uuid4(),
                event_id=event.id,
                field_definition_id=fd_id,
                value=value,
            )
            session.add(fv)

        seen_names.add(event_name)
        result.events_created += 1

    session.flush()
    return result


def _ensure_variable(
    session: Session,
    project_id: uuid.UUID,
    name: str,
    inferred_type: str,
) -> int:
    """Create a Variable if it doesn't exist. Returns 1 if created, 0 if already exists."""
    existing = session.execute(
        select(Variable).where(
            Variable.project_id == project_id,
            Variable.name == name,
        )
    ).scalar_one_or_none()

    if existing is not None:
        return 0

    var = Variable(
        id=uuid.uuid4(),
        project_id=project_id,
        name=name,
        variable_type=inferred_type,
        description="Auto-detected variable from data source scan",
    )
    session.add(var)
    session.flush()
    return 1


def _get_existing_event_names(
    session: Session,
    project_id: uuid.UUID,
    event_type_id: uuid.UUID,
) -> set[str]:
    """Get all existing event names for dedup."""
    rows = (
        session.execute(
            select(Event.name).where(
                Event.project_id == project_id,
                Event.event_type_id == event_type_id,
            )
        )
        .scalars()
        .all()
    )
    return set(rows)
