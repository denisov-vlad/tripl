from __future__ import annotations

import logging
import re
import time
from datetime import datetime

import clickhouse_connect

from tripl.worker.adapters.base import BaseAdapter, ColumnInfo

logger = logging.getLogger(__name__)

_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_.]*$")
_IDENTIFIER_PART_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class ClickHouseAdapter(BaseAdapter):
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        username: str = "",
        password: str = "",
        **kwargs: object,
    ) -> None:
        self._client = clickhouse_connect.get_client(
            host=host,
            port=port,
            database=database,
            username=username or "default",
            password=password or "",
            **kwargs,  # type: ignore[arg-type]
        )
        self._allowed_columns: set[str] = set()

    def close(self) -> None:
        self._client.close()

    def test_connection(self) -> bool:
        result = self._client.query("SELECT 1")
        return result.first_row[0] == 1

    def get_columns(self, base_query: str) -> list[ColumnInfo]:
        result = self._client.query(f"SELECT * FROM ({base_query}) AS _src LIMIT 0")
        columns: list[ColumnInfo] = []
        for name, type_info in zip(result.column_names, result.column_types, strict=False):
            type_name = str(type_info)
            is_nullable = "Nullable" in type_name
            columns.append(ColumnInfo(name=name, type_name=type_name, is_nullable=is_nullable))
        self._allowed_columns = {c.name for c in columns}
        return columns

    def get_preview_rows(
        self,
        base_query: str,
        limit: int = 10,
    ) -> tuple[list[str], list[tuple]]:
        sql = f"SELECT * FROM ({base_query}) AS _src LIMIT {int(limit)}"
        logger.info("CH preview query: %s", sql)
        result = self._client.query(sql)
        return list(result.column_names), result.result_rows

    def _validate_column(self, column: str) -> str:
        if not _IDENTIFIER_RE.match(column):
            msg = f"Invalid column name: {column}"
            raise ValueError(msg)
        if self._allowed_columns and column not in self._allowed_columns:
            msg = f"Column {column!r} not found in query result"
            raise ValueError(msg)
        return column

    def _json_path_expression(self, column: str, path: str) -> str:
        parts = [part for part in path.split(".") if part]
        if not parts:
            raise ValueError(f"Invalid JSON path: {path}")
        if any(not _IDENTIFIER_PART_RE.match(part) for part in parts):
            raise ValueError(f"Unsupported JSON path: {path}")

        expression = f"`{self._validate_column(column)}`"
        for part in parts:
            expression += f".`{part}`"
        return expression

    def get_full_breakdown(
        self,
        base_query: str,
        regular_columns: list[str],
        json_columns: list[str],
        json_value_paths: dict[str, list[str]] | None = None,
        limit: int = 50000,
    ) -> tuple[list[str], list[str], list[str], list[tuple]]:
        """Single GROUP BY ALL query: regular cols + JSONAllPaths(json cols) + count().

        Returns (regular_col_names, json_col_names, rows).
        """
        reg_cols = [self._validate_column(c) for c in regular_columns]
        json_cols = [self._validate_column(c) for c in json_columns]
        json_value_paths = json_value_paths or {}
        json_value_names: list[str] = []

        select_parts: list[str] = []
        for c in reg_cols:
            select_parts.append(f"`{c}`")
        for c in json_cols:
            select_parts.append(f"arraySort(JSONAllPaths(`{c}`))")
        for c in json_cols:
            for path in json_value_paths.get(c, []):
                full_path = f"{c}.{path}"
                select_parts.append(
                    f"toJSONString({self._json_path_expression(c, path)}) AS `{full_path}`"
                )
                json_value_names.append(full_path)
        select_parts.append("count() AS _cnt")

        sql = (
            f"SELECT {', '.join(select_parts)} "
            f"FROM ({base_query}) AS _src "
            f"GROUP BY ALL "
            f"ORDER BY _cnt DESC "
            f"LIMIT {int(limit)}"
        )

        short = sql[:300] + ("..." if len(sql) > 300 else "")
        logger.info(f"CH breakdown query: {short}")
        t0 = time.monotonic()
        result = self._client.query(sql)
        elapsed = time.monotonic() - t0
        n_rows = len(result.result_rows)
        logger.info(f"CH breakdown done in {elapsed:.2f}s, {n_rows} rows")

        return reg_cols, json_cols, json_value_names, result.result_rows

    def get_time_bucketed_counts(
        self,
        base_query: str,
        time_column: str,
        ch_interval: str,
        regular_columns: list[str],
        json_columns: list[str],
        json_value_paths: dict[str, list[str]] | None,
        time_from: datetime,
        time_to: datetime,
        limit: int = 100000,
    ) -> tuple[list[str], list[str], list[tuple]]:
        """Time-bucketed GROUP BY ALL with all columns, like get_full_breakdown.

        Returns (column_names, rows).
        Row layout: (_bucket, col1_val, ..., json_paths1, ..., count).
        """
        tc = self._validate_column(time_column)
        reg_cols = [self._validate_column(c) for c in regular_columns]
        json_cols = [self._validate_column(c) for c in json_columns]
        json_value_paths = json_value_paths or {}

        select_parts = [f"toStartOfInterval(`{tc}`, INTERVAL {ch_interval}) AS _bucket"]
        col_names: list[str] = []
        json_value_names: list[str] = []
        for c in reg_cols:
            select_parts.append(f"`{c}`")
            col_names.append(c)
        for c in json_cols:
            select_parts.append(f"arraySort(JSONAllPaths(`{c}`))")
            col_names.append(c)
        for c in json_cols:
            for path in json_value_paths.get(c, []):
                full_path = f"{c}.{path}"
                select_parts.append(
                    f"toJSONString({self._json_path_expression(c, path)}) AS `{full_path}`"
                )
                json_value_names.append(full_path)
        select_parts.append("count() AS _cnt")

        # Format timestamps for ClickHouse
        t_from = time_from.strftime("%Y-%m-%d %H:%M:%S")
        t_to = time_to.strftime("%Y-%m-%d %H:%M:%S")

        sql = (
            f"SELECT {', '.join(select_parts)} "
            f"FROM ({base_query}) AS _src "
            f"WHERE `{tc}` >= '{t_from}' AND `{tc}` < '{t_to}' "
            f"GROUP BY ALL "
            f"ORDER BY _bucket "
            f"LIMIT {int(limit)}"
        )

        logger.info(f"CH bucketed query: {sql}")
        t0 = time.monotonic()
        result = self._client.query(sql)
        elapsed = time.monotonic() - t0
        n_rows = len(result.result_rows)
        logger.info(f"CH bucketed done in {elapsed:.2f}s, {n_rows} rows")

        return col_names, json_value_names, result.result_rows
