import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from tripl.api.v1.router import router as v1_router
from tripl.database import engine

app = FastAPI(title="tripl", version="0.1.0", description="Analytics tracking plan service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/health", include_in_schema=False)
async def health() -> JSONResponse:
    """Liveness + DB-reachability probe. Returns 503 if the DB is unreachable."""
    try:
        async with asyncio.timeout(1.0):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001  — any DB failure should down the probe
        return JSONResponse(
            status_code=503,
            content={"status": "error", "component": "database", "detail": str(exc)},
        )
    return JSONResponse(content={"status": "ok"})
