from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GestiÃ³n de Inventario API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(
        default="cambiar-este-secreto-de-desarrollo-por-uno-seguro",
        min_length=32,
    )
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    # Base de datos. Por defecto se usa SQLite para que el proyecto funcione
    # sin instalar un servidor. Para MySQL/PostgreSQL define DATABASE_URL_OVERRIDE.
    sqlite_path: str = "backend/inventario.db"
    database_url_override: str | None = None

    # Compatibilidad con MySQL si se prefiere configurar por partes.
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_database: str = "inventario"
    mysql_user: str = "inventario"
    mysql_password: str = ""

    cors_origins: str = "http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173"
    upload_directory: str = "backend/uploads"
    public_upload_url: str = "/uploads"
    max_upload_mb: int = 10

    login_account_max_attempts: int = 5
    login_ip_max_attempts: int = 30
    login_attempt_window_seconds: int = 300
    trust_forwarded_for: bool = False
    force_https: bool = False
    audit_retention_days: int = 730
    auth_cookie_domain: str | None = None

    # Cuenta inicial creada automÃ¡ticamente cuando la base de datos estÃ¡ vacÃ­a.
    initial_admin_email: str = "admin@inventario.com"
    initial_admin_username: str = "admin"
    initial_admin_password: str | None = "Admin12345"
    initial_admin_name: str = "Administrador del sistema"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        if self.mysql_password:
            user = quote_plus(self.mysql_user)
            password = quote_plus(self.mysql_password)
            return (
                f"mysql+pymysql://{user}:{password}@{self.mysql_host}:{self.mysql_port}/"
                f"{self.mysql_database}?charset=utf8mb4"
            )
        database_file = Path(self.sqlite_path)
        if not database_file.is_absolute():
            database_file = PROJECT_ROOT / database_file
        database_file.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{database_file.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

