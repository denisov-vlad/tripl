import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.schemas.data_source import (
    DataSourceCreate,
    DataSourceResponse,
    DataSourceTestResponse,
    DataSourceUpdate,
)
from tripl.services import datasource_service

router = APIRouter(
    prefix="/data-sources",
    tags=["data-sources"],
)


@router.get("", response_model=list[DataSourceResponse])
async def list_data_sources(session: SessionDep) -> list[DataSourceResponse]:
    return await datasource_service.list_data_sources(session)


@router.post("", response_model=DataSourceResponse, status_code=201)
async def create_data_source(session: SessionDep, data: DataSourceCreate) -> DataSourceResponse:
    return await datasource_service.create_data_source(session, data)


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_data_source(session: SessionDep, ds_id: uuid.UUID) -> DataSourceResponse:
    return await datasource_service.get_data_source(session, ds_id)


@router.patch("/{ds_id}", response_model=DataSourceResponse)
async def update_data_source(
    session: SessionDep, ds_id: uuid.UUID, data: DataSourceUpdate
) -> DataSourceResponse:
    return await datasource_service.update_data_source(session, ds_id, data)


@router.delete("/{ds_id}", status_code=204)
async def delete_data_source(session: SessionDep, ds_id: uuid.UUID) -> None:
    await datasource_service.delete_data_source(session, ds_id)


@router.post("/{ds_id}/test", response_model=DataSourceTestResponse)
async def test_data_source_connection(
    session: SessionDep, ds_id: uuid.UUID
) -> DataSourceTestResponse:
    return await datasource_service.test_data_source_connection(session, ds_id)
