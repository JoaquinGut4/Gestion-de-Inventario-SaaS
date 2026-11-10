"""Datos iniciales del sistema de inventario.

El arranque del backend llama a ``ensure_seed_data`` para que una instalación
nueva tenga categorías, estados y una cuenta administradora utilizable.
"""

from datetime import date
from decimal import Decimal
import logging

from sqlalchemy import select

from backend.app.core.config import get_settings
from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models import AdminUser, InventoryAsset, InventoryCategory, InventoryState
from backend.app.schemas import ADMIN_MODULES


logger = logging.getLogger(__name__)

CATEGORIES = (
    ("laptops", "Laptops", 1, "laptop"),
    ("computadoras", "Computadoras", 2, "package"),
    ("monitores", "Monitores", 3, "monitor"),
    ("tablets", "Tablets", 4, "tablet"),
    ("televisores", "Televisores", 5, "monitor"),
    ("impresoras", "Impresoras", 6, "printer"),
    ("proyectores", "Proyectores", 7, "package"),
)

INVENTORY_STATES = (
    ("Disponible", True),
    ("Reservado", True),
    ("Despachado", True),
    ("Alquiler", True),
    ("Venta", True),
    ("Diagnóstico", True),
    ("Reparación", True),
    ("Reemplazo requerido", True),
    ("Reservado para reemplazo", True),
    ("Revisar", True),
    ("Baja", True),
)

DEMO_ASSETS = (
    {
        "category_id": "laptops", "sku": "LAP-0001", "qr": "QR-LAP-0001", "brand": "Lenovo",
        "description": "ThinkPad E14 Gen 5", "serial": "LEN-E14-0001", "processor": "Intel Core i5-1335U",
        "ghz": "1.30 GHz", "generation": "13.ª", "screen": "14\"", "ram": "16 GB", "storage": "512 GB",
        "storage_type": "SSD", "price": "2890.00", "supplier": "Tecnología Andina SAC",
        "location": "Almacén 1", "status": "Disponible", "rentable": True,
    },
    {
        "category_id": "laptops", "sku": "LAP-0002", "qr": "QR-LAP-0002", "brand": "HP",
        "description": "ProBook 450 G10", "serial": "HP-450-0002", "processor": "Intel Core i7-1355U",
        "ghz": "1.70 GHz", "generation": "13.ª", "screen": "15.6\"", "ram": "16 GB", "storage": "1 TB",
        "storage_type": "NVMe", "price": "3450.00", "supplier": "Distribuidora Lima",
        "location": "Almacén 2", "status": "Alquiler", "rentable": True,
    },
    {
        "category_id": "laptops", "sku": "LAP-0003", "qr": "QR-LAP-0003", "brand": "Dell",
        "description": "Latitude 5440", "serial": "DELL-5440-0003", "processor": "Intel Core i5-1345U",
        "ghz": "1.60 GHz", "generation": "13.ª", "screen": "14\"", "ram": "8 GB", "storage": "256 GB",
        "storage_type": "SSD", "price": "2650.00", "supplier": "Dell Perú",
        "location": "Taller", "status": "Diagnóstico", "rentable": True,
    },
    {
        "category_id": "computadoras", "sku": "PC-0001", "qr": "QR-PC-0001", "brand": "HP",
        "description": "EliteDesk 800 G9", "serial": "HP-800-0001", "processor": "Intel Core i7-12700",
        "ghz": "2.10 GHz", "generation": "12.ª", "ram": "16 GB", "storage": "512 GB",
        "storage_type": "SSD", "price": "3100.00", "supplier": "Tecnología Andina SAC",
        "location": "Almacén 1", "status": "Disponible", "rentable": True,
    },
    {
        "category_id": "computadoras", "sku": "PC-0002", "qr": "QR-PC-0002", "brand": "Lenovo",
        "description": "ThinkCentre M70q", "serial": "LEN-M70-0002", "processor": "Intel Core i5-12400T",
        "ghz": "1.80 GHz", "generation": "12.ª", "ram": "8 GB", "storage": "256 GB",
        "storage_type": "NVMe", "price": "2350.00", "supplier": "Lenovo Perú",
        "location": "Almacén 3", "status": "Reservado", "rentable": True,
    },
    {
        "category_id": "monitores", "sku": "MON-0001", "qr": "QR-MON-0001", "brand": "Samsung",
        "description": "Monitor LED 24\" FHD", "serial": "SAM-24-0001", "screen": "24\"",
        "price": "620.00", "supplier": "Samsung Store", "location": "Almacén 1",
        "status": "Disponible", "rentable": True,
    },
    {
        "category_id": "monitores", "sku": "MON-0002", "qr": "QR-MON-0002", "brand": "LG",
        "description": "Monitor UltraWide 29\"", "serial": "LG-29-0002", "screen": "29\"",
        "price": "1290.00", "supplier": "LG Perú", "location": "Almacén 2",
        "status": "Alquiler", "rentable": True,
    },
    {
        "category_id": "tablets", "sku": "TAB-0001", "qr": "QR-TAB-0001", "brand": "Apple",
        "description": "iPad 10.ª generación", "serial": "APL-IPAD-0001", "processor": "Apple A14 Bionic",
        "generation": "10.ª", "screen": "10.9\"", "ram": "4 GB", "storage": "64 GB",
        "price": "1890.00", "supplier": "iStore Perú", "location": "Almacén 1",
        "status": "Disponible", "rentable": True,
    },
    {
        "category_id": "tablets", "sku": "TAB-0002", "qr": "QR-TAB-0002", "brand": "Samsung",
        "description": "Galaxy Tab S9 FE", "serial": "SAM-TAB-0002", "processor": "Exynos 1380",
        "generation": "11.ª", "screen": "10.9\"", "ram": "6 GB", "storage": "128 GB",
        "price": "1750.00", "supplier": "Samsung Store", "location": "Almacén 3",
        "status": "Revisar", "rentable": True,
    },
    {
        "category_id": "televisores", "sku": "TV-0001", "qr": "QR-TV-0001", "brand": "Samsung",
        "description": "Smart TV 55\" 4K", "serial": "SAM-TV-0001", "model": "UN55AU7000",
        "screen": "55\"", "price": "2190.00", "supplier": "Samsung Store",
        "location": "Almacén 2", "status": "Disponible", "rentable": True,
    },
    {
        "category_id": "televisores", "sku": "TV-0002", "qr": "QR-TV-0002", "brand": "LG",
        "description": "Smart TV 65\" UHD", "serial": "LG-TV-0002", "model": "65UR7800",
        "screen": "65\"", "price": "2890.00", "supplier": "LG Perú",
        "location": "Alquilado", "status": "Alquiler", "rentable": True,
    },
    {
        "category_id": "impresoras", "sku": "IMP-0001", "qr": "QR-IMP-0001", "brand": "Epson",
        "description": "Impresora multifuncional EcoTank L3250", "serial": "EPS-L3250-0001",
        "model": "L3250", "price": "890.00", "supplier": "Epson Perú",
        "location": "Almacén 1", "status": "Disponible", "rentable": False,
    },
    {
        "category_id": "impresoras", "sku": "IMP-0002", "qr": "QR-IMP-0002", "brand": "Ricoh",
        "description": "Multifuncional IM C3000", "serial": "RIC-C3000-0002",
        "model": "IM C3000", "price": "5490.00", "supplier": "Ricoh Perú",
        "location": "Almacén 2", "status": "Mantenimiento", "rentable": False,
    },
    {
        "category_id": "proyectores", "sku": "PRO-0001", "qr": "QR-PRO-0001", "brand": "Epson",
        "description": "Proyector láser EB-L630U", "serial": "EPS-L630U-0001", "item": "Proyector láser",
        "model": "EB-L630U", "price": "6790.00", "supplier": "Epson Perú",
        "location": "Almacén 3", "status": "Disponible", "rentable": True,
    },
    {
        "category_id": "proyectores", "sku": "PRO-0002", "qr": "QR-PRO-0002", "brand": "BenQ",
        "description": "Proyector full HD MH733", "serial": "BEN-MH733-0002", "item": "Proyector",
        "model": "MH733", "price": "3290.00", "supplier": "BenQ Perú",
        "location": "Taller", "status": "Reparación", "rentable": True,
    },
)


def ensure_seed_data(include_demo: bool = False) -> None:
    settings = get_settings()
    with SessionLocal() as db:
        all_modules = sorted(ADMIN_MODULES)

        for superadmin in db.scalars(select(AdminUser).where(AdminUser.is_super_admin.is_(True))).all():
            if sorted(superadmin.modules or []) != all_modules:
                superadmin.modules = all_modules
                superadmin.token_version += 1
                logger.info("Módulos de %s sincronizados con el catálogo actual", superadmin.email)

        for category_id, label, code, icon in CATEGORIES:
            if db.get(InventoryCategory, category_id) is None:
                db.add(InventoryCategory(id=category_id, label=label, code=code, icon_name=icon))

        for order, (name, immutable) in enumerate(INVENTORY_STATES):
            existing_state = db.get(InventoryState, name)
            if existing_state is None:
                db.add(InventoryState(name=name, is_immutable=immutable, sort_order=order))
            else:
                existing_state.is_immutable = immutable
                existing_state.sort_order = order

        if db.scalar(select(AdminUser).limit(1)) is None and settings.initial_admin_password:
            db.add(AdminUser(
                full_name=settings.initial_admin_name,
                email=settings.initial_admin_email.lower(),
                username=settings.initial_admin_username,
                password_hash=hash_password(settings.initial_admin_password),
                role="Administrador",
                phone="",
                is_active=True,
                is_super_admin=True,
                modules=all_modules,
            ))
            logger.info(
                "Cuenta inicial creada: %s / %s",
                settings.initial_admin_email,
                settings.initial_admin_username,
            )

        if include_demo and db.scalar(select(InventoryAsset).limit(1)) is None:
            for asset in DEMO_ASSETS:
                db.add(InventoryAsset(
                    category_id=asset["category_id"],
                    sku=asset["sku"],
                    qr=asset["qr"],
                    brand=asset["brand"],
                    description=asset["description"],
                    serial_number=asset["serial"],
                    processor=asset.get("processor"),
                    ghz=asset.get("ghz"),
                    generation=asset.get("generation"),
                    screen=asset.get("screen"),
                    ram=asset.get("ram"),
                    storage=asset.get("storage"),
                    storage_type=asset.get("storage_type"),
                    model=asset.get("model"),
                    item=asset.get("item"),
                    purchase_date=date(2025, 1, 15),
                    purchase_document="F001-000123",
                    price=Decimal(asset["price"]),
                    supplier=asset["supplier"],
                    rentable=asset.get("rentable", False),
                    location=asset["location"],
                    status=asset["status"],
                    notes="",
                    custom_specs={},
                ))
            logger.info("Se agregaron %d activos de demostración", len(DEMO_ASSETS))

        db.commit()
    logger.info("Datos iniciales verificados correctamente")
