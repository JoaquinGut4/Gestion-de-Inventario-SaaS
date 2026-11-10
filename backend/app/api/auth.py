from datetime import datetime
import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.api.dependencies import current_user
from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.rate_limit import account_login_limiter, ip_login_limiter, login_client_ip
from backend.app.core.security import (
    create_token,
    decode_token,
    verify_and_update_password,
    verify_dummy_password,
)
from backend.app.models import AdminUser, utcnow
from backend.app.schemas import ADMIN_MODULES, LoginRequest, RefreshRequest, SessionUser, TokenResponse


router = APIRouter(prefix="/auth", tags=["AutenticaciÃ³n"])
logger = logging.getLogger(__name__)


def session_user(user: AdminUser) -> SessionUser:
    modules = sorted(ADMIN_MODULES) if user.is_super_admin else user.modules
    return SessionUser(
        id=user.id,
        email=user.email,
        usuario=user.username,
        nombre=user.full_name,
        rol=user.role,
        telefono=user.phone,
        modulos=modules,
        superAdmin=user.is_super_admin,
    )


def token_response(user: AdminUser) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        accessToken=create_token(user.id, "access", user.token_version),
        refreshToken=create_token(user.id, "refresh", user.token_version),
        expiresIn=settings.access_token_minutes * 60,
        user=session_user(user),
    )


def set_auth_cookies(response: Response, tokens: TokenResponse) -> None:
    settings = get_settings()
    common = {
        "httponly": True,
        "secure": settings.environment == "production" or settings.force_https,
        "samesite": "strict",
        "domain": settings.auth_cookie_domain,
        "path": settings.api_v1_prefix,
    }
    response.set_cookie("inventario_access", tokens.accessToken, max_age=tokens.expiresIn, **common)
    response.set_cookie(
        "inventario_refresh",
        tokens.refreshToken,
        max_age=settings.refresh_token_days * 86400,
        **common,
    )


def enforce_login_rate_limit(account_key: str, ip_key: str | None) -> None:
    checks = [(account_login_limiter, account_key)]
    if ip_key:
        checks.append((ip_login_limiter, ip_key))
    for limiter, key in checks:
        result = limiter.check(key)
        if not result.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos fallidos. IntÃ©ntalo de nuevo mÃ¡s tarde.",
                headers={"Retry-After": str(result.retry_after)},
            )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    username = payload.usuario.lower()
    account_key = username
    ip_key = login_client_ip(request)
    enforce_login_rate_limit(account_key, ip_key)

    user = db.scalar(
        select(AdminUser).where(
            func.lower(AdminUser.username) == username,
        )
    )
    if user is None:
        # Keep the work comparable to a real check so the response time does not
        # reveal whether the username exists.
        verify_dummy_password(payload.password)
        account_login_limiter.record(account_key)
        if ip_key:
            ip_login_limiter.record(ip_key)
        logger.warning(
            "Login rechazado: no existe una cuenta con usuario=%r",
            username,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invÃ¡lidas")

    verified, updated_hash = verify_and_update_password(payload.password, user.password_hash)
    if not verified:
        account_login_limiter.record(account_key)
        if ip_key:
            ip_login_limiter.record(ip_key)
        logger.warning(
            "Login rechazado: contraseÃ±a incorrecta para usuario=%r",
            username,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invÃ¡lidas")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta cuenta estÃ¡ desactivada")
    account_login_limiter.reset(account_key)
    if updated_hash is not None:
        user.password_hash = updated_hash
    user.last_login_at = utcnow()
    db.commit()
    tokens = token_response(user)
    set_auth_cookies(response, tokens)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="inventario_refresh"),
    db: Session = Depends(get_db),
) -> TokenResponse:
    token = payload.refreshToken or refresh_cookie
    claims = decode_token(token, "refresh") if token else None
    user = db.get(AdminUser, claims[0]) if claims else None
    if user is None or not user.is_active or claims[1] != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invÃ¡lido")
    tokens = token_response(user)
    set_auth_cookies(response, tokens)
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, user: AdminUser = Depends(current_user), db: Session = Depends(get_db)) -> None:
    """Cierra todas las sesiones de la cuenta invalidando los tokens ya emitidos."""
    user.token_version += 1
    db.commit()
    response.delete_cookie("inventario_access", path=get_settings().api_v1_prefix)
    response.delete_cookie("inventario_refresh", path=get_settings().api_v1_prefix)


@router.get("/me", response_model=SessionUser)
def me(user: AdminUser = Depends(current_user)) -> SessionUser:
    return session_user(user)

