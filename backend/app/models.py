from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base


def new_id() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def as_utc(value: datetime) -> datetime:
    """Marca como UTC una fecha guardada sin zona horaria.

    MySQL no conserva el offset, así que las columnas se guardan en UTC sin
    ``tzinfo``. Al serializar hay que devolver el offset para que el navegador
    no interprete la hora como local.
    """
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class AdminUser(TimestampMixin, Base):
    __tablename__ = "admin_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), default="Administrador")
    phone: Mapped[str] = mapped_column(String(30), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    modules: Mapped[list[str]] = mapped_column(JSON, default=list)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class InventoryCategory(TimestampMixin, Base):
    __tablename__ = "inventory_categories"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), unique=True)
    code: Mapped[int] = mapped_column(Integer, unique=True)
    icon_name: Mapped[str] = mapped_column(String(30), default="package")
    base_fields: Mapped[list[str] | None] = mapped_column(JSON, default=list, nullable=True)
    custom_fields: Mapped[list[dict]] = mapped_column(JSON, default=list)

    assets: Mapped[list["InventoryAsset"]] = relationship(back_populates="category")


class InventoryState(TimestampMixin, Base):
    __tablename__ = "inventory_states"

    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    is_immutable: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class InventoryAsset(TimestampMixin, Base):
    __tablename__ = "inventory_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    category_id: Mapped[str] = mapped_column(ForeignKey("inventory_categories.id"), index=True)
    sku: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    qr: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    photo_url: Mapped[str] = mapped_column(Text().with_variant(LONGTEXT(), "mysql"), default="")
    item: Mapped[str | None] = mapped_column(String(120), nullable=True)
    brand: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(300))
    serial_number: Mapped[str | None] = mapped_column(String(160), unique=True, index=True, nullable=True)
    processor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ghz: Mapped[str | None] = mapped_column(String(40), nullable=True)
    generation: Mapped[str | None] = mapped_column(String(40), nullable=True)
    screen: Mapped[str | None] = mapped_column(String(60), nullable=True)
    ram: Mapped[str | None] = mapped_column(String(60), nullable=True)
    storage: Mapped[str | None] = mapped_column(String(60), nullable=True)
    storage_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_document: Mapped[str] = mapped_column(String(100))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    supplier: Mapped[str] = mapped_column(String(160))
    rentable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    location: Mapped[str] = mapped_column(String(255), default="Almacén 1", index=True)
    status: Mapped[str] = mapped_column(String(80), index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    custom_specs: Mapped[dict] = mapped_column(JSON, default=dict)

    category: Mapped[InventoryCategory] = relationship(back_populates="assets")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("admin_users.id"), nullable=True)
    username: Mapped[str] = mapped_column(String(80))
    module: Mapped[str] = mapped_column(String(40), index=True)
    action: Mapped[str] = mapped_column(String(30))
    element: Mapped[str] = mapped_column(String(160))
    detail: Mapped[str] = mapped_column(Text)
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    device: Mapped[str] = mapped_column(String(500), default="")
