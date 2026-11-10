# Gestión de Inventario SAAS

Sistema administrativo independiente para la gestión de inventario, organizado en los siguientes módulos:

- **Login** (autenticación con JWT + cookies HttpOnly)
- **Dashboard** (indicadores, distribución y actividad reciente)
- **Inventario** (categorías, estados, CRUD de activos, fotos y escaneo QR)
- **Reportes** (PDF de inventario y de movimientos)
- **Movimientos** (auditoría con filtros, exportación CSV/PDF)
- **Configuración** (usuarios, roles y módulos habilitados)

El proyecto es autónomo: tiene su propio backend FastAPI, su propia base de datos
(SQLite por defecto) y su propio frontend Vite + React + Tailwind.

---

## Estructura

```
Gestion de inventario SAAS/
├─ backend/
│  ├─ app/
│  │  ├─ api/            # auth, admin (dashboard, inventario, movimientos, reportes, usuarios)
│  │  ├─ core/           # configuración, base de datos, seguridad, rate limit, auditoría
│  │  ├─ main.py         # aplicación FastAPI
│  │  ├─ models.py       # AdminUser, InventoryCategory, InventoryState, InventoryAsset, AuditLog
│  │  ├─ reports.py      # generador de PDFs sin dependencias externas
│  │  ├─ schemas.py      # contratos Pydantic
│  │  └─ seed_data.py    # datos iniciales y demo
│  ├─ scripts/seed.py    # carga inicial / demo
│  └─ uploads/           # fotos de inventario
├─ frontend/
│  └─ src/
│     ├─ components/     # layout, login, dashboard, modales, UI
│     ├─ config/         # navegación y configuración del panel
│     ├─ lib/            # cliente API, estados, mapeos
│     └─ pages/          # Dashboard, Inventario, Movimientos, Reportes, Configuración
├─ .env.example
└─ requirements.txt
```

---

## Requisitos

- Python 3.11+ (probado con 3.12)
- Node.js 20+ y npm
- No hace falta instalar MySQL: por defecto se usa SQLite.

---

## Puesta en marcha

### 1. Backend

```powershell
cd "Gestion de inventario SAAS"

# Crear y activar entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Crear el archivo de entorno (ya existe una copia de desarrollo)
Copy-Item .env.example .env

# (Opcional) cargar datos de demostración
python -m backend.scripts.seed --demo

# Arrancar la API
python -m uvicorn backend.app.main:app --reload --port 8000
```

La API queda en `http://127.0.0.1:8000` y la documentación interactiva en
`http://127.0.0.1:8000/docs`.

> Al arrancar, el backend crea las tablas automáticamente y, si la base está
> vacía, crea las categorías, los estados y la cuenta administradora inicial.

### 2. Frontend

En otra terminal:

```powershell
cd "Gestion de inventario SAAS\frontend"
npm install
npm run dev
```

Abre `http://localhost:3001`.

### Credenciales iniciales

```
Email:    admin@inventario.com
Usuario:  admin
Password: Admin12345
```

Cámbialas en **Configuración** o mediante las variables `INITIAL_ADMIN_*`
antes del primer arranque.

También puedes restablecer una contraseña desde la terminal:

```powershell
python -m backend.scripts.set_admin_password --usuario admin --password "NuevaClave2026"
```

---

## Datos de demostración

El seed normal crea solo lo indispensable (categorías, estados y cuenta admin):

```powershell
python -m backend.scripts.seed
```

Para cargar 15 equipos de ejemplo en distintas categorías, estados y ubicaciones:

```powershell
python -m backend.scripts.seed --demo
```

El seed es idempotente: no duplica registros si ya existen.

---

## Base de datos

Por defecto se usa SQLite en `backend/inventario.db`.

Para MySQL, define la cadena completa en `.env`:

```env
DATABASE_URL_OVERRIDE="mysql+pymysql://usuario:clave@127.0.0.1:3306/inventario?charset=utf8mb4"
```

Para PostgreSQL:

```env
DATABASE_URL_OVERRIDE="postgresql+psycopg2://usuario:clave@127.0.0.1:5432/inventario"
```

> Con PostgreSQL instala también `psycopg2-binary`.

---

## Endpoints principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Inicio de sesión |
| POST | `/api/v1/auth/refresh` | Renovación de tokens |
| POST | `/api/v1/auth/logout` | Cierre de sesión |
| GET | `/api/v1/auth/me` | Sesión actual |
| GET | `/api/v1/dashboard` | Indicadores del dashboard |
| GET/POST | `/api/v1/usuarios` | Listado / alta de usuarios |
| PATCH/DELETE | `/api/v1/usuarios/{id}` | Edición / baja de usuarios |
| GET/POST | `/api/v1/inventario` | Listado paginado / alta de activos |
| PUT/DELETE | `/api/v1/inventario/{id}` | Edición / baja de activos |
| GET | `/api/v1/inventario/por-qr` | Búsqueda por código QR |
| GET/POST | `/api/v1/inventario/categorias` | Categorías |
| GET/POST | `/api/v1/inventario/estados` | Estados |
| PATCH/DELETE | `/api/v1/inventario/estados/{nombre}` | Renombrar / eliminar estados |
| POST | `/api/v1/inventario/fotos` | Subida de foto |
| GET | `/api/v1/movimientos` | Auditoría paginada |
| GET | `/api/v1/movimientos/export` | Exportación CSV/PDF |
| GET | `/api/v1/reportes/inventario/pdf` | Reporte PDF de inventario |
| GET | `/api/v1/reportes/movimientos/pdf` | Reporte PDF de movimientos |

La autorización se valida con el módulo habilitado en cada cuenta. Los
superadministradores tienen acceso a todos los módulos.

---

## Roles y módulos

| Rol | Módulos por defecto |
| --- | --- |
| Administrador | Dashboard, Inventario, Movimientos, Reportes, Configuración |
| Operador | Dashboard, Inventario, Movimientos, Reportes |
| Consulta | Dashboard, Reportes |

Los módulos se pueden ajustar individualmente desde **Configuración**.

---

## Personalización rápida

- **Nombre del panel:** `frontend/.env` → `VITE_ADMIN_NAME`.
- **Colores y tipografía:** `frontend/src/index.css` (bloque `@theme`).
- **Identidad visual:** edita `frontend/src/components/BrandLogo.tsx`.
- **Módulos del menú:** `frontend/src/config/navigation.ts`.
- **Categorías base:** `backend/app/seed_data.py`.
- **Estados base:** `backend/app/seed_data.py` (`INVENTORY_STATES`).

---

## Producción

```powershell
cd frontend
npm run build
```

El resultado queda en `frontend/dist`. Configura el servidor web para servir ese
directorio y redirigir `/api` y `/uploads` al backend.

Antes de publicar:

1. Cambia `SECRET_KEY` por un valor aleatorio de al menos 32 caracteres.
2. Cambia la contraseña de la cuenta inicial.
3. Define `ENVIRONMENT=production` para ocultar `/docs`.
4. Configura `CORS_ORIGINS` con tu dominio real.
5. Si usas HTTPS detrás de un proxy, activa `TRUST_FORWARDED_FOR=true`.
6. No subas `.env` ni `backend/inventario.db` al repositorio.

---

## Notas de seguridad

- Los tokens se guardan en cookies `HttpOnly` y `SameSite=Strict`.
- El login tiene límite de intentos por cuenta e IP.
- Cada cambio de inventario o usuario genera un registro de auditoría con IP y dispositivo.
- Las fotos se validan por tipo MIME y tamaño máximo (`MAX_UPLOAD_MB`).
- La retención de auditoría se controla con `AUDIT_RETENTION_DAYS`.
