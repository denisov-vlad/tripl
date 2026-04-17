from __future__ import annotations

import json
from collections.abc import Iterable


def normalize_json_value_paths(paths: Iterable[str] | None) -> list[str]:
    if not paths:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_path in paths:
        path = raw_path.strip()
        if not path or "." not in path:
            continue
        if path in seen:
            continue
        seen.add(path)
        normalized.append(path)
    return sorted(normalized)


def group_json_value_paths(paths: Iterable[str] | None) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    for full_path in normalize_json_value_paths(paths):
        column_name, json_path = full_path.split(".", 1)
        grouped.setdefault(column_name, []).append(json_path)
    return grouped


def set_nested_value(target: dict[str, object], dotted_path: str, value: object) -> None:
    parts = [part for part in dotted_path.split(".") if part]
    if not parts:
        return

    cursor = target
    for part in parts[:-1]:
        next_value = cursor.get(part)
        if not isinstance(next_value, dict):
            next_value = {}
            cursor[part] = next_value
        cursor = next_value
    cursor[parts[-1]] = value


def decode_json_path_value(raw_value: object) -> object:
    if raw_value is None or isinstance(raw_value, (bool, int, float, list, dict)):
        return raw_value
    if isinstance(raw_value, str):
        try:
            return json.loads(raw_value)
        except json.JSONDecodeError:
            return raw_value
    return str(raw_value)


def format_json_path_value(raw_value: object) -> str:
    value = decode_json_path_value(raw_value)
    if value is None:
        return "null"
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def build_json_value(
    column_name: str,
    paths: Iterable[str],
    *,
    preserved_values: dict[str, object] | None = None,
) -> str:
    json_obj: dict[str, object] = {}
    preserved_values = preserved_values or {}

    for path in sorted(paths):
        full_path = f"{column_name}.{path}"
        value = preserved_values.get(full_path, f"${{{full_path}}}")
        set_nested_value(json_obj, path, value)

    return json.dumps(json_obj, ensure_ascii=False, sort_keys=True)


def flatten_json_paths(value: object, *, prefix: str = "") -> list[tuple[str, object]]:
    if isinstance(value, dict):
        flattened: list[tuple[str, object]] = []
        for key, nested_value in value.items():
            next_prefix = f"{prefix}.{key}" if prefix else str(key)
            flattened.extend(flatten_json_paths(nested_value, prefix=next_prefix))
        return flattened
    if not prefix:
        return []
    return [(prefix, value)]
