"""Crea las tablas y carga los datos iniciales.

Uso:
    python -m backend.scripts.seed          # categorías, estados y cuenta admin
    python -m backend.scripts.seed --demo   # además, 15 activos de demostración
"""

import argparse
import logging

from backend.app import models  # noqa: F401
from backend.app.core.database import Base, engine
from backend.app.seed_data import ensure_seed_data


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga datos iniciales del inventario")
    parser.add_argument("--demo", action="store_true", help="Agrega activos de demostración")
    args = parser.parse_args()
    Base.metadata.create_all(bind=engine)
    ensure_seed_data(include_demo=args.demo)


if __name__ == "__main__":
    main()
