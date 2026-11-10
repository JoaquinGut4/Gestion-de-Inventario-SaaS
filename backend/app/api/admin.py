from datetime import date, datetime, timedelta
import csv
import io
import math
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.dependencies import (
    require_any_module,
    require_module,
    require_super_admin,
)
from backend.app.core.audit_context import request_device, request_ip
from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.security import hash_password
from backend.app.reports import table_pdf
from backend.app.models import (
    AdminUser,
    AuditLog,
    InventoryAsset,
    InventoryCategory,
    InventoryState,
    as_utc,
    utcnow,
)
from backend.app.schemas import (
    ADMIN_MODULES,
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
    AuditIn,
    AuditOut,
    CategoryIn,
    CategoryOut,
    DashboardOut,
    InventoryIn,
    InventoryOut,
    InventoryLocationCountOut,
    PaginatedAuditOut,
    PaginatedInventoryOut,
    InventoryStateIn,
    InventoryStateOut,
    InventoryStateUpdate,
)


router = APIRouter(tags=["Panel administrativo"])


def conflict(db: Session, message: str) -> None:
    db.rollback()
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def audit(db: Session, user: AdminUser, module: str, action: str, element: str, detail: str) -> None:
    retention = get_settings().audit_retention_days
    if retention > 0:
        db.query(AuditLog).filter(AuditLog.occurred_at < utcnow() - timedelta(days=retention)).delete()
    db.add(AuditLog(
        username=user.username,
        user_id=user.id,
        module=module,
        action=action,
        element=element,
        detail=detail,
        ip_address=request_ip.get(),
        device=request_device.get(),
    ))


def user_out(item: AdminUser) -> AdminUserOut:
    modules = sorted(ADMIN_MODULES) if item.is_super_admin else item.modules
    return AdminUserOut(
        id=item.id,
        nombre=item.full_name,
        email=item.email,
        usuario=item.username,
        rol=item.role,
        telefono=item.phone,
        activo=item.is_active,
        modulos=modules,
        superAdmin=item.is_super_admin,
        createdAt=as_utc(item.created_at),
    )


def category_out(item: InventoryCategory) -> CategoryOut:
    return CategoryOut(
        id=item.id,
        label=item.label,
        codigo=item.code,
        iconName=item.icon_name,
        camposBase=item.base_fields or [],
        camposPersonalizados=item.custom_fields,
    )


def inventory_out(item: InventoryAsset) -> InventoryOut:
    return InventoryOut(
        id=item.id,
        categoriaId=item.category_id,
        categoria=item.category.code,
        sku=item.sku,
        qr=item.qr,
        foto=item.photo_url,
        item=item.item,
        marca=item.brand,
        descripcion=item.description,
        numeroSerial=item.serial_number or "",
        procesador=item.processor,
        ghz=item.ghz,
        generacion=item.generation,
        pantalla=item.screen,
        memoriaRam=item.ram,
        memoriaInterna=item.storage,
        tipoMemoriaInterna=item.storage_type,
        modelo=item.model,
        fechaCompra=item.purchase_date,
        facturaGuiaCompra=item.purchase_document,
        precio=item.price,
        proveedor=item.supplier,
        alquiler=item.rentable,
        ubicacion=item.location if item.status == "Venta" else (item.location or "Almacén 1"),
        estado=item.status,
        observaciones=item.notes,
        especificacionesPersonalizadas=item.custom_specs,
    )


def audit_out(item: AuditLog) -> AuditOut:
    return AuditOut(
        id=item.id,
        fecha=as_utc(item.occurred_at),
        usuario=item.username,
        modulo=item.module,
        accion=item.action,
        elemento=item.element,
        detalle=item.detail,
        ip=item.ip_address,
        dispositivo=item.device,
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(_: AdminUser = Depends(require_module("dashboard")), db: Session = Depends(get_db)) -> DashboardOut:
    by_status = {
        name: count
        for name, count in db.execute(
            select(InventoryAsset.status, func.count()).group_by(InventoryAsset.status)
        ).all()
        if name != "Venta"
    }
    location_status_rows = db.execute(
        select(InventoryAsset.location, InventoryAsset.status, func.count())
        .group_by(InventoryAsset.location, InventoryAsset.status)
    ).all()
    inventory_locations = {
        location: {"ubicacion": location, "total": 0, "disponibles": 0, "alquiler": 0, "mantenimiento": 0, "categorias": {}}
        for location in ("Almacén 1", "Almacén 2", "Almacén 3", "Taller", "Alquilado")
    }
    technical_statuses = {
        "Revisar", "Mantenimiento", "Diagnóstico", "Reparación",
        "Reemplazo requerido", "Reservado para reemplazo",
    }
    for location, status, count in location_status_rows:
        if status == "Venta":
            continue
        location_name = location if location in inventory_locations else "Almacén 1"
        summary = inventory_locations[location_name]
        summary["total"] += count
        if status == "Disponible":
            summary["disponibles"] += count
        elif status == "Alquiler":
            summary["alquiler"] += count
        elif status in technical_statuses:
            summary["mantenimiento"] += count

    category_rows = db.execute(
        select(InventoryCategory.label, InventoryAsset.status, func.count())
        .join(InventoryCategory)
        .group_by(InventoryCategory.label, InventoryAsset.status)
    ).all()
    category_totals: dict[str, dict[str, int]] = {}
    for category_label, status, count in category_rows:
        if status == "Venta":
            continue
        category = category_totals.setdefault(category_label, {"total": 0, "disponibles": 0})
        category["total"] += count
        if status == "Disponible":
            category["disponibles"] += count
    categories = [
        {"categoria": label, "total": values["total"], "disponibles": values["disponibles"]}
        for label, values in sorted(category_totals.items(), key=lambda item: (-item[1]["total"], item[0].lower()))
    ]

    location_category_rows = db.execute(
        select(InventoryAsset.location, InventoryCategory.label, InventoryAsset.status, func.count())
        .join(InventoryCategory)
        .group_by(InventoryAsset.location, InventoryCategory.label, InventoryAsset.status)
    ).all()
    for location, category_label, status, count in location_category_rows:
        if status == "Venta":
            continue
        location_name = location if location in inventory_locations else "Almacén 1"
        location_categories = inventory_locations[location_name]["categorias"]
        category = location_categories.setdefault(category_label, {"categoria": category_label, "total": 0, "disponibles": 0})
        category["total"] += count
        if status == "Disponible":
            category["disponibles"] += count
    for summary in inventory_locations.values():
        summary["categorias"] = sorted(
            summary["categorias"].values(),
            key=lambda category: category["categoria"].lower(),
        )

    inventory_value = db.scalar(
        select(func.coalesce(func.sum(InventoryAsset.price), 0)).where(InventoryAsset.status != "Venta")
    ) or 0
    recent = db.scalars(select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(10)).all()
    return DashboardOut(
        inventarioTotal=sum(by_status.values()),
        inventarioPorEstado=by_status,
        inventarioPorUbicacion=list(inventory_locations.values()),
        categorias=categories,
        valorInventario=float(inventory_value),
        movimientosRecientes=[audit_out(item) for item in recent],
    )


@router.get("/usuarios", response_model=list[AdminUserOut])
def list_users(_: AdminUser = Depends(require_super_admin), db: Session = Depends(get_db)) -> list[AdminUserOut]:
    return [user_out(item) for item in db.scalars(select(AdminUser).order_by(AdminUser.full_name)).all()]


@router.post("/usuarios", response_model=AdminUserOut, status_code=201)
def create_user(payload: AdminUserCreate, actor: AdminUser = Depends(require_super_admin), db: Session = Depends(get_db)) -> AdminUserOut:
    modules = sorted(ADMIN_MODULES) if payload.superAdmin else payload.modulos
    item = AdminUser(
        full_name=payload.nombre,
        email=payload.email.lower(),
        username=payload.usuario,
        password_hash=hash_password(payload.password),
        role=payload.rol,
        phone=payload.telefono,
        is_active=payload.activo,
        is_super_admin=payload.superAdmin,
        modules=modules,
    )
    db.add(item)
    audit(db, actor, "Configuración", "Creó", payload.usuario, f"Creó la cuenta administrativa {payload.usuario}.")
    try:
        db.commit()
    except IntegrityError:
        conflict(db, "El correo o usuario ya está registrado")
    db.refresh(item)
    return user_out(item)


@router.patch("/usuarios/{user_id}", response_model=AdminUserOut)
def update_user(user_id: str, payload: AdminUserUpdate, actor: AdminUser = Depends(require_super_admin), db: Session = Depends(get_db)) -> AdminUserOut:
    item = db.get(AdminUser, user_id)
    if item is None:
        raise HTTPException(404, "Usuario no encontrado")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("activo") is False:
        if item.id == actor.id:
            raise HTTPException(400, "No puedes desactivar tu propia cuenta")
        if item.is_super_admin:
            remaining_superadmins = db.scalar(
                select(func.count())
                .select_from(AdminUser)
                .where(
                    AdminUser.is_super_admin.is_(True),
                    AdminUser.is_active.is_(True),
                    AdminUser.id != item.id,
                )
            ) or 0
            if remaining_superadmins == 0:
                raise HTTPException(400, "Debe quedar al menos un superadministrador activo")
    before = (item.email, item.username, item.password_hash, item.role, item.modules, item.is_active)
    if "nombre" in changes: item.full_name = changes["nombre"]
    if "email" in changes: item.email = changes["email"].lower()
    if "usuario" in changes: item.username = changes["usuario"]
    if "password" in changes: item.password_hash = hash_password(changes["password"])
    if "rol" in changes: item.role = changes["rol"]
    if "telefono" in changes: item.phone = changes["telefono"]
    if "activo" in changes: item.is_active = changes["activo"]
    if item.is_super_admin:
        item.modules = sorted(ADMIN_MODULES)
    elif "modulos" in changes:
        item.modules = changes["modulos"]
    if before != (item.email, item.username, item.password_hash, item.role, item.modules, item.is_active):
        item.token_version += 1
    audit(db, actor, "Configuración", "Editó", item.username, f"Actualizó la cuenta {item.username}.")
    try:
        db.commit()
    except IntegrityError:
        conflict(db, "El correo o usuario ya está registrado")
    db.refresh(item)
    return user_out(item)


@router.delete("/usuarios/{user_id}", status_code=204)
def delete_user(user_id: str, actor: AdminUser = Depends(require_super_admin), db: Session = Depends(get_db)) -> None:
    item = db.get(AdminUser, user_id)
    if item is None:
        raise HTTPException(404, "Usuario no encontrado")
    if item.id == actor.id:
        raise HTTPException(400, "No puedes eliminar tu propia cuenta")
    if item.is_super_admin:
        total_superadmins = db.scalar(
            select(func.count()).select_from(AdminUser).where(AdminUser.is_super_admin.is_(True))
        ) or 0
        if total_superadmins <= 1:
            raise HTTPException(400, "No se puede eliminar el último superadministrador")

    db.execute(update(AuditLog).where(AuditLog.user_id == item.id).values(user_id=None))
    audit(db, actor, "Configuración", "Eliminó", item.username, f"Eliminó la cuenta {item.username}.")
    db.delete(item)
    db.commit()


@router.get("/inventario/categorias", response_model=list[CategoryOut])
def categories(
    _: AdminUser = Depends(require_any_module("dashboard", "inventario", "reportes")),
    db: Session = Depends(get_db),
) -> list[CategoryOut]:
    return [category_out(item) for item in db.scalars(select(InventoryCategory).order_by(InventoryCategory.code)).all()]


@router.post("/inventario/categorias", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryIn, actor: AdminUser = Depends(require_module("inventario")), db: Session = Depends(get_db)) -> CategoryOut:
    item = InventoryCategory(
        id=payload.id,
        label=payload.label,
        code=payload.codigo,
        icon_name=payload.iconName,
        base_fields=payload.camposBase,
        custom_fields=[field.model_dump() for field in payload.camposPersonalizados],
    )
    db.add(item)
    audit(db, actor, "Inventario", "Agregó", payload.id, f"Agregó la categoría {payload.label}.")
    try:
        db.commit()
    except IntegrityError:
        conflict(db, "El id, nombre o código de categoría ya existe")
    return category_out(item)


@router.delete("/inventario/categorias/{category_id}", status_code=204)
def delete_category(
    category_id: str,
    actor: AdminUser = Depends(require_module("inventario")),
    db: Session = Depends(get_db),
) -> None:
    item = db.get(InventoryCategory, category_id)
    if item is None:
        raise HTTPException(404, "Categoría no encontrada")
    if db.scalar(select(func.count()).select_from(InventoryAsset).where(InventoryAsset.category_id == category_id)):
        raise HTTPException(409, "La categoría tiene activos registrados")
    audit(db, actor, "Inventario", "Eliminó", item.id, f"Eliminó la categoría {item.label}.")
    db.delete(item)
    db.commit()


def inventory_state_out(item: InventoryState) -> InventoryStateOut:
    return InventoryStateOut(nombre=item.name, inmutable=item.is_immutable, orden=item.sort_order)


@router.get("/inventario/estados", response_model=list[InventoryStateOut])
def inventory_states(
    _: AdminUser = Depends(require_any_module("dashboard", "inventario", "reportes")),
    db: Session = Depends(get_db),
) -> list[InventoryStateOut]:
    rows = db.scalars(
        select(InventoryState)
        .where(InventoryState.name != "Taller")
        .order_by(InventoryState.sort_order, InventoryState.name)
    ).all()
    return [inventory_state_out(item) for item in rows]


@router.post("/inventario/estados", response_model=InventoryStateOut, status_code=201)
def create_inventory_state(
    payload: InventoryStateIn,
    actor: AdminUser = Depends(require_module("inventario")),
    db: Session = Depends(get_db),
) -> InventoryStateOut:
    if payload.nombre.casefold() == "taller":
        raise HTTPException(422, "Taller es una ubicación, no un estado de inventario")
    if db.get(InventoryState, payload.nombre) is not None:
        raise HTTPException(409, "Ese estado ya existe")
    order = db.scalar(select(func.max(InventoryState.sort_order))) or 0
    item = InventoryState(name=payload.nombre, sort_order=order + 1)
    db.add(item)
    audit(db, actor, "Inventario", "Agregó", payload.nombre, f"Agregó el estado {payload.nombre}.")
    db.commit()
    db.refresh(item)
    return inventory_state_out(item)


@router.patch("/inventario/estados/{state_name}", response_model=InventoryStateOut)
def update_inventory_state(
    state_name: str,
    payload: InventoryStateUpdate,
    actor: AdminUser = Depends(require_module("inventario")),
    db: Session = Depends(get_db),
) -> InventoryStateOut:
    item = db.get(InventoryState, state_name)
    if item is None:
        raise HTTPException(404, "Estado no encontrado")
    if item.is_immutable:
        raise HTTPException(409, "El estado es inmutable")
    if payload.nombre.casefold() == "taller":
        raise HTTPException(422, "Taller es una ubicación, no un estado de inventario")
    if payload.nombre != state_name and db.get(InventoryState, payload.nombre) is not None:
        raise HTTPException(409, "Ese estado ya existe")
    replacement = InventoryState(
        name=payload.nombre,
        is_immutable=False,
        sort_order=item.sort_order,
        created_at=item.created_at,
    )
    db.add(replacement)
    db.flush()
    db.execute(update(InventoryAsset).where(InventoryAsset.status == state_name).values(status=payload.nombre))
    db.delete(item)
    audit(db, actor, "Inventario", "Editó", state_name, f"Renombró el estado {state_name} a {payload.nombre}.")
    db.commit()
    return inventory_state_out(replacement)


@router.delete("/inventario/estados/{state_name}", status_code=204)
def delete_inventory_state(
    state_name: str,
    actor: AdminUser = Depends(require_module("inventario")),
    db: Session = Depends(get_db),
) -> None:
    item = db.get(InventoryState, state_name)
    if item is None:
        raise HTTPException(404, "Estado no encontrado")
    if item.is_immutable:
        raise HTTPException(409, "El estado es inmutable")
    if db.scalar(select(func.count()).select_from(InventoryAsset).where(InventoryAsset.status == state_name)):
        raise HTTPException(409, "El estado está en uso")
    audit(db, actor, "Inventario", "Eliminó", state_name, f"Eliminó el estado {state_name}.")
    db.delete(item)
    db.commit()


TALLER_STATUSES = (
    "Taller",
    "Mantenimiento",
    "Diagnóstico",
    "Reparación",
    "Reemplazo requerido",
    "Reservado para reemplazo",
    "Revisar",
)


def apply_inventory_status_filters(query, estado: str | None, filtro: str | None):
    """Aplica filtros de estado sobre la consulta completa, antes de paginar."""
    if estado:
        query = query.where(InventoryAsset.status == estado)
    if filtro == "alquiler":
        query = query.where(func.lower(InventoryAsset.status).like("%alquiler%"))
    elif filtro == "oficina":
        query = query.where(or_(
            InventoryAsset.location.in_(("Almacén 1", "Almacén 2", "Almacén 3")),
            func.lower(InventoryAsset.status).like("%oficina%"),
            func.lower(InventoryAsset.status).like("%almacén%"),
            func.lower(InventoryAsset.status).like("%almacen%"),
        ))
    elif filtro == "taller":
        query = query.where(or_(
            InventoryAsset.location == "Taller",
            InventoryAsset.status.in_(TALLER_STATUSES),
        ))
    return query


@router.get("/inventario", response_model=PaginatedInventoryOut)
def inventory(
    category_id: str | None = None,
    estado: str | None = None,
    filtro: str | None = Query(default=None, pattern="^(alquiler|oficina|taller)$"),
    ubicacion: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    _: AdminUser = Depends(require_any_module("dashboard", "inventario")),
    db: Session = Depends(get_db),
) -> PaginatedInventoryOut:
    query = select(InventoryAsset).join(InventoryCategory)
    if category_id: query = query.where(InventoryAsset.category_id == category_id)
    query = apply_inventory_status_filters(query, estado, filtro)
    if ubicacion: query = query.where(InventoryAsset.location == ubicacion)
    if search:
        term = f"%{search}%"
        query = query.where(
            InventoryAsset.sku.like(term)
            | InventoryAsset.serial_number.like(term)
            | InventoryAsset.description.like(term)
            | InventoryAsset.brand.like(term)
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(InventoryAsset.sku).offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedInventoryOut(
        items=[inventory_out(item) for item in rows],
        total=total,
        page=page,
        pageSize=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/inventario/resumen-ubicaciones", response_model=list[InventoryLocationCountOut])
def inventory_location_counts(
    category_id: str | None = None,
    estado: str | None = None,
    filtro: str | None = Query(default=None, pattern="^(alquiler|oficina|taller)$"),
    _: AdminUser = Depends(require_any_module("dashboard", "inventario")),
    db: Session = Depends(get_db),
) -> list[InventoryLocationCountOut]:
    """Totales por ubicación de todo el inventario, independientes de la paginación."""
    query = select(InventoryAsset.location, InventoryAsset.status, func.count())
    if category_id:
        query = query.where(InventoryAsset.category_id == category_id)
    query = apply_inventory_status_filters(query, estado, filtro)
    query = query.group_by(InventoryAsset.location, InventoryAsset.status)
    counts: dict[str, dict[str, int]] = {}
    for location, status, total in db.execute(query).all():
        summary = counts.setdefault(location, {"total": 0, "disponibles": 0})
        summary["total"] += total
        if status == "Disponible":
            summary["disponibles"] += total
    return [
        InventoryLocationCountOut(ubicacion=location, total=values["total"], disponibles=values["disponibles"])
        for location, values in sorted(counts.items())
    ]


@router.get("/inventario/por-qr", response_model=InventoryOut)
def inventory_by_qr(
    codigo: str = Query(min_length=1, max_length=160),
    _: AdminUser = Depends(require_any_module("dashboard", "inventario")),
    db: Session = Depends(get_db),
) -> InventoryOut:
    normalized = codigo.strip()
    item = db.scalar(select(InventoryAsset).join(InventoryCategory).where(InventoryAsset.qr == normalized))
    if item is None:
        raise HTTPException(404, "No existe un producto asociado a este código QR")
    return inventory_out(item)


@router.post("/inventario/fotos", status_code=201)
async def upload_inventory_photo(
    file: UploadFile = File(...),
    _: AdminUser = Depends(require_module("inventario")),
) -> dict[str, str]:
    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif"}
    content_type = file.content_type or ""
    extension = allowed.get(content_type)
    if extension is None:
        raise HTTPException(415, "Formato de foto no permitido")
    settings = get_settings()
    limit = settings.max_upload_mb * 1024 * 1024
    directory = Path(settings.upload_directory) / "inventory"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid4().hex}{extension}"
    total = 0
    try:
        with path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > limit:
                    raise HTTPException(413, f"La foto supera el límite de {settings.max_upload_mb} MB")
                destination.write(chunk)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return {"url": f"{settings.public_upload_url.rstrip('/')}/inventory/{path.name}"}


def remove_inventory_photo(url: str) -> None:
    marker = "/inventory/"
    if marker not in url:
        return
    filename = Path(url).name
    (Path(get_settings().upload_directory) / "inventory" / filename).unlink(missing_ok=True)


def apply_inventory(item: InventoryAsset, payload: InventoryIn) -> None:
    item.category_id = payload.categoriaId
    item.sku = payload.sku
    item.qr = payload.qr
    item.photo_url = payload.foto
    item.item = payload.item
    item.brand = payload.marca
    item.description = payload.descripcion
    item.serial_number = payload.numeroSerial.strip() or None
    item.processor = payload.procesador
    item.ghz = payload.ghz
    item.generation = payload.generacion
    item.screen = payload.pantalla
    item.ram = payload.memoriaRam
    item.storage = payload.memoriaInterna
    item.storage_type = payload.tipoMemoriaInterna
    item.model = payload.modelo
    item.purchase_date = payload.fechaCompra
    item.purchase_document = payload.facturaGuiaCompra
    item.price = payload.precio
    rentable = payload.alquiler
    if isinstance(rentable, str):
        rentable = rentable.strip().lower() in {"sí", "si", "true", "1", "yes"}
    item.supplier = payload.proveedor
    item.rentable = rentable
    item.location = payload.ubicacion
    item.status = payload.estado
    item.notes = payload.observaciones
    item.custom_specs = payload.especificacionesPersonalizadas


@router.post("/inventario", response_model=InventoryOut, status_code=201)
def create_inventory(payload: InventoryIn, actor: AdminUser = Depends(require_module("inventario")), db: Session = Depends(get_db)) -> InventoryOut:
    if db.get(InventoryCategory, payload.categoriaId) is None:
        raise HTTPException(422, "Categoría inexistente")
    if payload.estado and db.get(InventoryState, payload.estado) is None:
        raise HTTPException(422, "Estado de inventario inexistente")
    item = InventoryAsset()
    apply_inventory(item, payload)
    db.add(item)
    audit(db, actor, "Inventario", "Agregó", payload.sku, f"Agregó el producto {payload.sku} · {payload.descripcion}.")
    try:
        db.commit()
    except IntegrityError:
        conflict(db, "El SKU, QR o número serial ya está registrado")
    db.refresh(item)
    return inventory_out(item)


@router.put("/inventario/{item_id}", response_model=InventoryOut)
def update_inventory(item_id: str, payload: InventoryIn, actor: AdminUser = Depends(require_module("inventario")), db: Session = Depends(get_db)) -> InventoryOut:
    item = db.get(InventoryAsset, item_id)
    if item is None:
        raise HTTPException(404, "Activo no encontrado")
    if item.status == "Venta":
        raise HTTPException(409, "El producto fue vendido y ya no pertenece al inventario; no se puede editar")
    if db.get(InventoryCategory, payload.categoriaId) is None:
        raise HTTPException(422, "Categoría inexistente")
    if payload.estado and db.get(InventoryState, payload.estado) is None:
        raise HTTPException(422, "Estado de inventario inexistente")
    old_photo = item.photo_url
    apply_inventory(item, payload)
    audit(db, actor, "Inventario", "Modificó", payload.sku, f"Modificó el producto {payload.sku}.")
    try:
        db.commit()
    except IntegrityError:
        conflict(db, "El SKU, QR o número serial ya está registrado")
    db.refresh(item)
    if old_photo != item.photo_url:
        remove_inventory_photo(old_photo)
    return inventory_out(item)


@router.delete("/inventario/{item_id}", status_code=204)
def delete_inventory(item_id: str, actor: AdminUser = Depends(require_module("inventario")), db: Session = Depends(get_db)) -> None:
    item = db.get(InventoryAsset, item_id)
    if item is None:
        raise HTTPException(404, "Activo no encontrado")
    if item.status == "Venta":
        raise HTTPException(409, "El producto fue vendido y ya no pertenece al inventario; no se puede eliminar")
    photo = item.photo_url
    audit(db, actor, "Inventario", "Eliminó", item.sku, f"Eliminó el producto {item.sku}.")
    db.delete(item)
    db.commit()
    remove_inventory_photo(photo)


def movement_query(module: str | None, desde: date | None, hasta: date | None, search: str | None):
    query = select(AuditLog)
    if module:
        query = query.where(AuditLog.module == module)
    if desde:
        query = query.where(AuditLog.occurred_at >= datetime.combine(desde, datetime.min.time()))
    if hasta:
        query = query.where(AuditLog.occurred_at < datetime.combine(hasta + timedelta(days=1), datetime.min.time()))
    if search:
        term = f"%{search.strip()}%"
        query = query.where(or_(
            AuditLog.username.like(term),
            AuditLog.action.like(term),
            AuditLog.element.like(term),
            AuditLog.detail.like(term),
        ))
    return query


@router.get("/movimientos", response_model=PaginatedAuditOut)
def movements(
    module: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: AdminUser = Depends(require_module("movimientos")),
    db: Session = Depends(get_db),
) -> PaginatedAuditOut:
    query = movement_query(module, desde, hasta, search)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(AuditLog.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedAuditOut(
        items=[audit_out(item) for item in rows],
        total=total,
        page=page,
        pageSize=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/movimientos/export")
def export_movements(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    module: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    search: str | None = None,
    _: AdminUser = Depends(require_module("movimientos")),
    db: Session = Depends(get_db),
):
    rows = db.scalars(movement_query(module, desde, hasta, search).order_by(AuditLog.occurred_at.desc()).limit(5000)).all()
    if format == "pdf":
        return movements_pdf_response(rows, module, desde, hasta, search)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Usuario", "Módulo", "Acción", "Elemento", "Detalle", "IP", "Dispositivo"])
    for item in rows:
        writer.writerow([item.occurred_at.isoformat(), item.username, item.module, item.action, item.element, item.detail, item.ip_address, item.device])
    return Response(
        "\ufeff" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=movimientos.csv"},
    )


def movements_pdf_response(rows, module, desde, hasta, search) -> Response:
    data = [
        [
            item.occurred_at.strftime("%d/%m/%Y %H:%M"),
            item.username,
            item.module,
            item.action,
            item.element,
            item.detail,
            f"{item.ip_address or '-'} / {item.device or '-'}",
        ]
        for item in rows
    ]
    columns = [
        ("Fecha", 0.9), ("Usuario", 1.0), ("Módulo", 0.8), ("Acción", 0.8),
        ("Elemento", 1.1), ("Detalle", 2.4), ("IP / dispositivo", 1.5),
    ]
    summary = [("Total", len(rows)), ("Módulo", module or "Todos")]
    subtitle = f"Período: {desde or 'inicio'} al {hasta or 'hoy'} · Módulo: {module or 'Todos'} · Búsqueda: {search or 'Sin filtro'}"
    return Response(
        table_pdf("Historial de movimientos", subtitle, columns, data, summary),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=movimientos-{date.today().isoformat()}.pdf"},
    )


@router.post("/movimientos", response_model=AuditOut, status_code=201)
def create_movement(
    payload: AuditIn,
    actor: AdminUser = Depends(require_any_module("movimientos", "inventario")),
    db: Session = Depends(get_db),
) -> AuditOut:
    item = AuditLog(
        username=actor.username,
        user_id=actor.id,
        module=payload.modulo,
        action=payload.accion,
        element=payload.elemento,
        detail=payload.detalle,
        ip_address=request_ip.get(),
        device=request_device.get(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return audit_out(item)


@router.get("/reportes/inventario/pdf")
def inventory_report_pdf(
    categoria_id: str | None = None,
    estado: str | None = None,
    ubicacion: str | None = None,
    _: AdminUser = Depends(require_module("reportes")),
    db: Session = Depends(get_db),
):
    query = select(InventoryAsset).join(InventoryCategory)
    if categoria_id:
        query = query.where(InventoryAsset.category_id == categoria_id)
    if estado:
        query = query.where(InventoryAsset.status == estado)
    if ubicacion:
        query = query.where(InventoryAsset.location == ubicacion)
    assets = db.scalars(query.order_by(InventoryAsset.sku)).all()
    rows = [
        [
            item.sku,
            item.category.label,
            item.description,
            item.brand,
            item.location or "-",
            item.status,
            item.serial_number or "-",
            f"{item.price:,.2f}",
            item.supplier or "-",
        ]
        for item in assets
    ]
    columns = [
        ("SKU", 0.8), ("Categoría", 0.9), ("Descripción", 2.0), ("Marca", 0.8),
        ("Ubicación", 0.9), ("Estado", 0.9), ("Serial", 1.1), ("Precio", 0.7), ("Proveedor", 1.2),
    ]
    summary = [
        ("Total", len(assets)),
        ("Disponibles", sum(item.status == "Disponible" for item in assets)),
        ("Alquilados", sum(item.status == "Alquiler" for item in assets)),
        ("Valor", f"S/ {sum((item.price or 0) for item in assets):,.2f}"),
    ]
    subtitle = f"Categoría: {categoria_id or 'Todas'} · Estado: {estado or 'Todos'} · Ubicación: {ubicacion or 'Todas'}"
    pdf = table_pdf("Reporte de inventario", subtitle, columns, rows, summary)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=reporte-inventario-{date.today().isoformat()}.pdf"},
    )


@router.get("/reportes/movimientos/pdf")
def movements_report_pdf(
    module: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    search: str | None = None,
    _: AdminUser = Depends(require_module("reportes")),
    db: Session = Depends(get_db),
):
    rows = db.scalars(movement_query(module, desde, hasta, search).order_by(AuditLog.occurred_at.desc()).limit(5000)).all()
    return movements_pdf_response(rows, module, desde, hasta, search)
