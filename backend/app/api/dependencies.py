from collections.abc import Callable

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import decode_token
from backend.app.models import AdminUser


bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    access_cookie: str | None = Cookie(default=None, alias="inventario_access"),
    db: Session = Depends(get_db),
) -> AdminUser:
    token = credentials.credentials if credentials else access_cookie
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AutenticaciÃ³n requerida")
    claims = decode_token(token, "access")
    user = db.get(AdminUser, claims[0]) if claims else None
    if user is None or not user.is_active or claims[1] != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SesiÃ³n invÃ¡lida o vencida")
    return user


def require_module(module: str) -> Callable:
    def dependency(user: AdminUser = Depends(current_user)) -> AdminUser:
        if not user.is_super_admin and module not in user.modules:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="MÃ³dulo no autorizado")
        return user

    return dependency


def require_any_module(*modules: str) -> Callable:
    allowed = set(modules)

    def dependency(user: AdminUser = Depends(current_user)) -> AdminUser:
        if not user.is_super_admin and not allowed.intersection(user.modules):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="MÃ³dulo no autorizado")
        return user

    return dependency


def require_super_admin(user: AdminUser = Depends(current_user)) -> AdminUser:
    if not user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere superadministrador")
    return user

