import uuid

from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.config import settings
from tripl.models.data_source import DataSource
from tripl.schemas.data_source import DataSourceCreate, DataSourceResponse, DataSourceUpdate


def _encrypt_password(password: str) -> str:
    if not password:
        return ""
    if not settings.encryption_key:
        # No encryption key configured — store as-is (dev/test mode)
        return password
    f = Fernet(settings.encryption_key.encode())
    return f.encrypt(password.encode()).decode()


async def list_data_sources(session: AsyncSession) -> list[DataSourceResponse]:
    result = await session.execute(
        select(DataSource).order_by(DataSource.created_at.desc())
    )
    rows = result.scalars().all()
    return [_to_response(ds) for ds in rows]


async def get_data_source(session: AsyncSession, ds_id: uuid.UUID) -> DataSourceResponse:
    ds = await _fetch_data_source(session, ds_id)
    return _to_response(ds)


async def create_data_source(
    session: AsyncSession, data: DataSourceCreate
) -> DataSourceResponse:
    # Check for duplicates
    existing = await session.execute(
        select(DataSource).where(DataSource.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Data source with this name already exists")

    ds = DataSource(
        name=data.name,
        db_type=data.db_type,
        host=data.host,
        port=data.port,
        database_name=data.database_name,
        username=data.username,
        password_encrypted=_encrypt_password(data.password),
        extra_params=data.extra_params,
    )
    session.add(ds)
    await session.commit()
    await session.refresh(ds)
    return _to_response(ds)


async def update_data_source(
    session: AsyncSession, ds_id: uuid.UUID, data: DataSourceUpdate
) -> DataSourceResponse:
    ds = await _fetch_data_source(session, ds_id)
    update_dict = data.model_dump(exclude_unset=True)

    # Handle password separately
    if "password" in update_dict:
        password = update_dict.pop("password")
        if password is not None:
            ds.password_encrypted = _encrypt_password(password)

    for key, value in update_dict.items():
        setattr(ds, key, value)

    await session.commit()
    await session.refresh(ds)
    return _to_response(ds)


async def delete_data_source(session: AsyncSession, ds_id: uuid.UUID) -> None:
    ds = await _fetch_data_source(session, ds_id)
    await session.delete(ds)
    await session.commit()


async def _fetch_data_source(session: AsyncSession, ds_id: uuid.UUID) -> DataSource:
    result = await session.execute(
        select(DataSource).where(DataSource.id == ds_id)
    )
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return ds


def _to_response(ds: DataSource) -> DataSourceResponse:
    return DataSourceResponse(
        id=ds.id,
        name=ds.name,
        db_type=ds.db_type,
        host=ds.host,
        port=ds.port,
        database_name=ds.database_name,
        username=ds.username,
        password_set=bool(ds.password_encrypted),
        extra_params=ds.extra_params,
        created_at=ds.created_at,
        updated_at=ds.updated_at,
    )
