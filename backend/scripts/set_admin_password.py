"""Restablece la contraseña de una cuenta administrativa.

La contraseña se guarda siempre como hash PBKDF2-SHA256 y se invalidan las
sesiones abiertas de la cuenta.

Ejemplos:
    python -m backend.scripts.set_admin_password --usuario administrador
    python -m backend.scripts.set_admin_password --email admin@inventario.com --password "NuevaClave2026"
"""
from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models import AdminUser


def find_user(db: Session, email: str | None, usuario: str | None) -> AdminUser | None:
    if email:
        return db.scalar(
            select(AdminUser).where(func.lower(AdminUser.email) == email.strip().lower())
        )
    return db.scalar(
        select(AdminUser).where(func.lower(AdminUser.username) == usuario.strip().lower())
    )


def prompt_password() -> str:
    password = getpass.getpass("Nueva contraseña: ")
    if getpass.getpass("Repite la contraseña: ") != password:
        raise SystemExit("Las contraseñas no coinciden.")
    return password


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Restablece la contraseña de un administrador del panel."
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--email", help="Correo de la cuenta.")
    target.add_argument("--usuario", help="Nombre de usuario de la cuenta.")
    parser.add_argument(
        "--password",
        help="Nueva contraseña. Si se omite, se solicita de forma interactiva.",
    )
    parser.add_argument(
        "--activar",
        action="store_true",
        help="Reactiva la cuenta si estaba desactivada.",
    )
    args = parser.parse_args()

    password = args.password or prompt_password()
    if not 8 <= len(password) <= 128:
        raise SystemExit("La contraseña debe tener entre 8 y 128 caracteres.")
    if password != password.strip():
        raise SystemExit("La contraseña no puede empezar ni terminar con espacios.")

    with SessionLocal() as db:
        user = find_user(db, args.email, args.usuario)
        if user is None:
            print("No existe una cuenta con esos datos.", file=sys.stderr)
            return 1

        user.password_hash = hash_password(password)
        user.token_version += 1  # Invalida access y refresh tokens ya emitidos.
        if args.activar:
            user.is_active = True
        db.commit()

        print(f"Contraseña actualizada para {user.username} ({user.email}).")
        if not user.is_active:
            print("Aviso: la cuenta sigue desactivada; usa --activar para reactivarla.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
