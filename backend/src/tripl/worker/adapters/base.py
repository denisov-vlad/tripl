from __future__ import annotations

import abc
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ColumnInfo:
    name: str
    type_name: str
    is_nullable: bool = False


class BaseAdapter(abc.ABC):
    @abc.abstractmethod
    def test_connection(self) -> bool: ...

    @abc.abstractmethod
    def get_columns(self, base_query: str) -> list[ColumnInfo]: ...

    @abc.abstractmethod
    def get_preview_rows(
        self,
        base_query: str,
        limit: int = 10,
    ) -> tuple[list[str], list[tuple[object, ...]]]: ...

    @abc.abstractmethod
    def get_full_breakdown(
        self,
        base_query: str,
        regular_columns: list[str],
        json_columns: list[str],
        json_value_paths: dict[str, list[str]] | None = None,
        limit: int = 50000,
    ) -> tuple[list[str], list[str], list[str], list[tuple[object, ...]]]:
        """Single GROUP BY ALL query that returns everything.

        Builds: SELECT reg1, reg2, ..., JSONAllPaths(j1), ...,
                       keep_json_value1, ..., count() AS _cnt
                FROM (base_query) GROUP BY ALL ORDER BY _cnt DESC LIMIT limit

        Returns (regular_col_names, json_col_names, json_value_names, rows).
        Row layout: (reg_val1, ..., json_paths_array1, ..., keep_json_value1, ..., count).
        """
        ...

    @abc.abstractmethod
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
    ) -> tuple[list[str], list[str], list[tuple[object, ...]]]:
        """Time-bucketed GROUP BY ALL, like get_full_breakdown but with a time bucket.

        Builds: SELECT toStartOfInterval(time_col, INTERVAL ...) AS _bucket,
                       col1, col2, ..., keep_json_value1, ..., count() AS _cnt
                FROM (base_query) WHERE time_col >= ? AND time_col < ?
                GROUP BY ALL ORDER BY _bucket LIMIT limit

        Returns (column_names, json_value_names, rows).
        Row layout: (_bucket, col1_val, col2_val, ..., keep_json_value1, ..., count).
        """
        ...

    @abc.abstractmethod
    def get_time_bucketed_breakdown_counts(
        self,
        base_query: str,
        time_column: str,
        ch_interval: str,
        breakdown_column: str,
        regular_columns: list[str],
        json_columns: list[str],
        json_value_paths: dict[str, list[str]] | None,
        time_from: datetime,
        time_to: datetime,
        values_limit: int | None = None,
        limit: int = 100000,
    ) -> tuple[list[str], list[str], list[tuple[object, ...]]]:
        """Time-bucketed counts grouped by one breakdown column in the database.

        Returns (column_names, json_value_names, rows).
        Row layout: (
            _bucket, _breakdown_value, _is_other,
            col1_val, col2_val, ..., keep_json_value1, ..., count
        ).
        """
        ...

    @abc.abstractmethod
    def get_time_bucketed_breakdown_counts_multi(
        self,
        base_query: str,
        time_column: str,
        ch_interval: str,
        breakdown_columns: list[str],
        regular_columns: list[str],
        json_columns: list[str],
        json_value_paths: dict[str, list[str]] | None,
        time_from: datetime,
        time_to: datetime,
        values_limit: int | None = None,
        limit: int = 100000,
    ) -> tuple[list[str], list[str], list[tuple[object, ...]]]:
        """Time-bucketed counts for multiple independent breakdown columns.

        Implementations should aggregate in the database. For ClickHouse this
        uses GROUPING SETS so selected breakdown dimensions share one source scan.

        Returns (column_names, json_value_names, rows).
        Row layout: (
            _bucket, _breakdown_column, _breakdown_value, _is_other,
            col1_val, col2_val, ..., keep_json_value1, ..., count
        ).
        """
        ...

    @abc.abstractmethod
    def close(self) -> None: ...
