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
    def get_full_breakdown(
        self,
        base_query: str,
        regular_columns: list[str],
        json_columns: list[str],
        limit: int = 50000,
    ) -> tuple[list[str], list[str], list[tuple]]:
        """Single GROUP BY ALL query that returns everything.

        Builds: SELECT reg1, reg2, ..., JSONAllPaths(j1), ..., count() AS _cnt
                FROM (base_query) GROUP BY ALL ORDER BY _cnt DESC LIMIT limit

        Returns (regular_col_names, json_col_names, rows).
        Row layout: (reg_val1, ..., json_paths_array1, ..., count).
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
        time_from: datetime,
        time_to: datetime,
        limit: int = 100000,
    ) -> tuple[list[str], list[tuple]]:
        """Time-bucketed GROUP BY ALL, like get_full_breakdown but with a time bucket.

        Builds: SELECT toStartOfInterval(time_col, INTERVAL ...) AS _bucket,
                       col1, col2, ..., count() AS _cnt
                FROM (base_query) WHERE time_col >= ? AND time_col < ?
                GROUP BY ALL ORDER BY _bucket LIMIT limit

        Returns (column_names, rows).
        Row layout: (_bucket, col1_val, col2_val, ..., count).
        """
        ...

    @abc.abstractmethod
    def close(self) -> None: ...
