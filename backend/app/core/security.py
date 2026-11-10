from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.app.core.config import get_settings


password_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=600000,
)
ALGORITHM = "HS256"
_DUMMY_PASSWORD_HASH = password_context.hash("inventario-login-dummy-password")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_dummy_password(password: str) -> bool:
    """Spend the same work as a real verification so unknown users are not distinguishable by time."""
    return password_context.verify(password, _DUMMY_PASSWORD_HASH)


def verify_and_update_password(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Check a password and return an upgraded hash when the stored work factor is outdated."""
    return password_context.verify_and_update(password, password_hash)


def create_token(subject: str, token_type: Literal["access", "refresh"], token_version: int = 0) -> str:
    settings = get_settings()
    lifetime = (
        timedelta(minutes=settings.access_token_minutes)
        if token_type == "access"
        else timedelta(days=settings.refresh_token_days)
    )
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + lifetime,
        "ver": token_version,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: Literal["access", "refresh"]) -> tuple[str, int] | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    subject = payload.get("sub")
    version = payload.get("ver", 0)
    if not isinstance(subject, str) or not isinstance(version, int):
        return None
    return subject, version

