from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from backend.app import models  # noqa: F401  (registra las tablas en el metadata)
from backend.app.api import admin, auth
from backend.app.core.audit_context import capture_request_context, reset_request_context
from backend.app.core.config import get_settings
from backend.app.core.database import Base, engine
from backend.app.seed_data import ensure_seed_data


settings = get_settings()


def documentation_urls(environment: str) -> dict[str, str | None]:
    """Expone la documentación interactiva solo en desarrollo local."""
    if environment == "development":
        return {"openapi_url": "/openapi.json", "docs_url": "/docs", "redoc_url": "/redoc"}
    return {"openapi_url": None, "docs_url": None, "redoc_url": None}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Path(settings.upload_directory).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_seed_data()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    **documentation_urls(settings.environment),
)
if settings.force_https:
    app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.mount(settings.public_upload_url, StaticFiles(directory=settings.upload_directory, check_dir=False), name="uploads")
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)


@app.middleware("http")
async def audit_request_context(request, call_next):
    tokens = capture_request_context(request)
    try:
        return await call_next(request)
    finally:
        reset_request_context(tokens)


@app.get("/health", tags=["Sistema"])
def health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (FRONTEND_DIST / "index.html").is_file():
    @app.get("/", include_in_schema=False)
    def serve_spa_root() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "uploads/")):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (FRONTEND_DIST / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(FRONTEND_DIST.resolve()):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
