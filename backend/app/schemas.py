import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


ADMIN_MODULES = {
    "dashboard",
    "inventario",
    "movimientos",
    "reportes",
    "configuracion",
}

ADMIN_ROLES = {
    "Administrador",
    "Operador",
    "Consulta",
}


def validate_phone(value: str) -> str:
    if value and not re.fullmatch(r"[0-9+()\s-]{6,30}", value):
        raise ValueError("Ingresa un número telefónico válido")
    return value


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class LoginRequest(Schema):
    email: EmailStr
    usuario: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(Schema):
    refreshToken: str | None = None


class SessionUser(Schema):
    id: str
    email: EmailStr
    usuario: str
    nombre: str
    rol: str
    telefono: str
    modulos: list[str]
    superAdmin: bool


class TokenResponse(Schema):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"
    expiresIn: int
    user: SessionUser


class AdminUserCreate(Schema):
    nombre: str = Field(min_length=2, max_length=160)
    email: EmailStr
    usuario: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    rol: str = "Administrador"
    telefono: str = Field(default="", max_length=30)
    activo: bool = True
    modulos: list[str]
    superAdmin: bool = False

    @field_validator("modulos")
    @classmethod
    def valid_modules(cls, value: list[str]) -> list[str]:
        if not value or any(module not in ADMIN_MODULES for module in value):
            raise ValueError("Debe indicar al menos un módulo válido")
        return list(dict.fromkeys(value))

    @field_validator("rol")
    @classmethod
    def valid_role(cls, value: str) -> str:
        if value not in ADMIN_ROLES:
            raise ValueError("Rol no válido")
        return value

    @field_validator("telefono")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        return validate_phone(value)


class AdminUserUpdate(Schema):
    nombre: str | None = Field(default=None, min_length=2, max_length=160)
    email: EmailStr | None = None
    usuario: str | None = Field(default=None, min_length=2, max_length=80)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    rol: str | None = None
    telefono: str | None = Field(default=None, max_length=30)
    activo: bool | None = None
    modulos: list[str] | None = None

    @field_validator("modulos")
    @classmethod
    def valid_modules(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and (not value or any(module not in ADMIN_MODULES for module in value)):
            raise ValueError("Debe indicar al menos un módulo válido")
        return list(dict.fromkeys(value)) if value else value

    @field_validator("rol")
    @classmethod
    def valid_role(cls, value: str | None) -> str | None:
        if value is not None and value not in ADMIN_ROLES:
            raise ValueError("Rol no válido")
        return value

    @field_validator("telefono")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        return validate_phone(value) if value is not None else value


class AdminUserOut(Schema):
    id: str
    nombre: str
    email: EmailStr
    usuario: str
    rol: str
    telefono: str
    activo: bool
    modulos: list[str]
    superAdmin: bool
    createdAt: datetime


class CustomField(Schema):
    id: str
    label: str
    type: Literal["text", "number", "date"]


class CategoryIn(Schema):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    label: str
    codigo: int = Field(gt=0)
    iconName: str = "package"
    camposBase: list[str] = Field(default_factory=list)
    camposPersonalizados: list[CustomField] = Field(default_factory=list)


class CategoryOut(CategoryIn):
    pass


class InventoryStateIn(Schema):
    nombre: str = Field(min_length=1, max_length=80)


class InventoryStateUpdate(Schema):
    nombre: str = Field(min_length=1, max_length=80)


class InventoryStateOut(Schema):
    nombre: str
    inmutable: bool
    orden: int


class InventoryIn(Schema):
    categoriaId: str
    sku: str = Field(min_length=1)
    qr: str = Field(min_length=1)
    foto: str = ""
    item: str | None = None
    marca: str = ""
    descripcion: str = ""
    numeroSerial: str = ""
    procesador: str | None = None
    ghz: str | None = None
    generacion: str | None = None
    pantalla: str | None = None
    memoriaRam: str | None = None
    memoriaInterna: str | None = None
    tipoMemoriaInterna: str | None = None
    modelo: str | None = None
    fechaCompra: date | None = None
    facturaGuiaCompra: str = ""
    precio: Decimal = Field(default=Decimal("0"), ge=0)
    proveedor: str = ""
    alquiler: bool | str | None = None
    ubicacion: str = Field(default="Almacén 1", min_length=1, max_length=255)
    estado: str = "Disponible"
    observaciones: str = ""
    especificacionesPersonalizadas: dict[str, str] = {}


class InventoryOut(InventoryIn):
    id: str
    categoria: int
    # Un equipo vendido se conserva en el historial sin ubicación física.
    ubicacion: str = Field(default="", max_length=255)


class AuditOut(Schema):
    id: str
    fecha: datetime
    usuario: str
    modulo: str
    accion: str
    elemento: str
    detalle: str
    ip: str = ""
    dispositivo: str = ""


class AuditIn(Schema):
    modulo: Literal["Inventario", "Configuración"]
    accion: Literal["Creó", "Editó", "Eliminó", "Agregó", "Modificó", "Guardó"]
    elemento: str = Field(min_length=1, max_length=160)
    detalle: str = Field(min_length=1, max_length=5000)


class PaginatedAuditOut(Schema):
    items: list[AuditOut]
    total: int
    page: int
    pageSize: int
    pages: int


class PaginatedInventoryOut(Schema):
    items: list[InventoryOut]
    total: int
    page: int
    pageSize: int
    pages: int


class InventoryLocationCountOut(Schema):
    ubicacion: str
    total: int
    disponibles: int


class InventoryCategoryAvailability(Schema):
    categoria: str
    total: int
    disponibles: int


class InventoryLocationSummary(Schema):
    ubicacion: Literal["Almacén 1", "Almacén 2", "Almacén 3", "Taller", "Alquilado"]
    total: int
    disponibles: int
    alquiler: int
    mantenimiento: int
    categorias: list[InventoryCategoryAvailability] = Field(default_factory=list)


class DashboardOut(Schema):
    inventarioTotal: int
    inventarioPorEstado: dict[str, int]
    inventarioPorUbicacion: list[InventoryLocationSummary]
    categorias: list[InventoryCategoryAvailability]
    valorInventario: float
    movimientosRecientes: list[AuditOut]
