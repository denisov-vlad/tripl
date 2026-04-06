import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.schemas.data_source import DataSourceCreate, DataSourceResponse, DataSourceUpdate
from tripl.services import datasource_service

router = APIRouter(
    prefix="/data-sources",
    tags=["data-sources"],
)


@router.get("", response_model=list[DataSourceResponse])
async def list_data_sources(session: SessionDep):
    return await datasource_service.list_data_sources(session)


@router.post("", response_model=DataSourceResponse, status_code=201)
async def create_data_source(session: SessionDep, data: DataSourceCreate):
    return await datasource_service.create_data_source(session, data)


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_data_source(session: SessionDep, ds_id: uuid.UUID):
    return await datasource_service.get_data_source(session, ds_id)


@router.patch("/{ds_id}", response_model=DataSourceResponse)
async def update_data_source(
    session: SessionDep, ds_id: uuid.UUID, data: DataSourceUpdate
):
    return await datasource_service.update_data_source(session, ds_id, data)


@router.delete("/{ds_id}", status_code=204)
async def delete_data_source(session: SessionDep, ds_id: uuid.UUID):
    await datasource_service.delete_data_source(session, ds_id)


@router.post("/{ds_id}/test")
async def test_data_source_connection(session: SessionDep, ds_id: uuid.UUID):
    # Verify data source exists
    await datasource_service.get_data_source(session, ds_id)
    from tripl.worker.tasks.scan import test_connection

    result = test_connection.delay(str(ds_id))
    return {"task_id": result.id, "status": "dispatched"}
