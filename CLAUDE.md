# Acredita — CLAUDE.md

Plataforma SaaS de acreditación de empresas contratistas para la industria de la construcción. Desarrollada por BERISA.

El sistema permite que mandantes (empresas principales) validen si una empresa contratista cumple sus requisitos documentales antes de comenzar a trabajar en una obra. La validación es automática usando IA para extraer campos de documentos PDF y reglas deterministas para evaluar el cumplimiento.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS v4 + Shadcn/UI + Radix UI |
| Backend | FastAPI (Python) |
| Base de datos | PostgreSQL + SQLAlchemy + Alembic |
| Cola async | Celery + Redis |
| Pipeline IA | Vision LLM (por definir) + Pydantic |
| Storage | Local en dev → Hetzner Object Storage en prod |
| Deploy frontend | Vercel |
| Deploy backend | Hetzner (Docker Compose) |

**Nota UI:** No usar Tremor ni MUI. Los componentes de dashboard (KPI cards, tablas, badges) se construyen con Tailwind puro. Shadcn/UI para forms, modals, dialogs.

---

## Estructura del repositorio

```
acredita/
├── CLAUDE.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── docs/                       ← documentación HTML interactiva (serve en puerto 4000)
│   ├── documentacion_app.html
│   └── index.html              ← copia de documentacion_app.html (sirve como index)
├── frontend/                   ← Next.js 16
│   └── src/
│       ├── app/                ← App Router con route groups
│       │   ├── (auth)/         ← /login
│       │   ├── (contratista)/  ← portal del contratista
│       │   ├── (mandante)/     ← portal del mandante
│       │   └── (admin)/        ← panel BERISA admin
│       ├── entities/           ← hooks y componentes por entidad de dominio
│       │   ├── contratista/
│       │   └── trabajador/
│       ├── features/           ← acciones del usuario (dialogs, forms)
│       │   ├── subir-documento/
│       │   ├── agregar-trabajador/
│       │   ├── contratista/    ← sidebar contratista
│       │   ├── mandante/       ← sidebar mandante
│       │   └── admin/          ← sidebar admin
│       └── shared/
│           ├── lib/            ← utils.ts, api.ts, auth.ts
│           ├── types/          ← tipos TypeScript compartidos
│           └── ui/             ← componentes Shadcn/UI base
└── backend/                    ← FastAPI (Python)
    ├── main.py                 ← entrada; todos los routers usan prefijo /api/v1/
    ├── alembic/                ← migraciones de base de datos
    ├── scripts/
    │   └── seed.py             ← seed idempotente con datos de demo
    └── app/
        ├── api/                ← routers FastAPI
        │   ├── acreditacion.py
        │   ├── documentos.py
        │   ├── mandantes.py
        │   ├── trabajadores.py
        │   └── usuarios.py
        ├── domain/             ← lógica de negocio
        │   ├── acreditacion_service.py  ← evalúa pilares DESDE config del mandante
        │   ├── documento_service.py
        │   ├── reglas_service.py        ← todas las reglas deterministas aquí
        │   └── notificacion_service.py
        ├── ia/
        │   ├── clasificador.py
        │   ├── extractor.py
        │   └── schemas.py
        ├── infrastructure/
        │   ├── database.py
        │   ├── storage.py
        │   └── email.py
        ├── models/
        ├── middleware/
        ├── tasks/
        │   └── procesar_documento.py
        └── core/
            ├── config.py
            ├── exceptions.py
            └── security.py     ← hash_password / verify_password con bcrypt DIRECTO
```

---

## Arquitectura — Clean Architecture

Las capas solo se comunican hacia abajo. El dominio no importa nada de infraestructura.

```
Presentación (Next.js)
    ↓ HTTPS / REST JSON  →  prefijo /api/v1/
Aplicación (FastAPI routers)
    ↓
Dominio (services) ← toda la lógica de negocio aquí
    ↓
Infraestructura (PostgreSQL, Storage, IA, Email)
```

---

## Multi-tenant y JWT

Cada registro pertenece a un `mandante_id`. El middleware de FastAPI lo inyecta desde el JWT.

**Payload JWT:**
```json
{ "sub": "<usuario_id>", "rol": "...", "mandante_id": "...", "contratista_id": "...", "exp": ... }
```

Para contratistas: `mandante_id` no está en la tabla usuarios — se resuelve en `_crear_token` buscando en `ContratistaMandante`.

---

## Catálogo de pilares y configuración por mandante

**Quién crea pilares:** solo `berisa_admin` puede agregar pilares/requisitos al catálogo global (vía seed o interfaz admin futura). Los mandantes NO crean pilares.

**Quién activa pilares:** el mandante selecciona del catálogo global qué pilares y requisitos le aplican, y los parametriza en `MandanteRequisitoConfig` (vigencia_max_dias, umbral_deuda_max, es_obligatorio).

**Cómo se evalúa:** `acreditacion_service.py` lee SOLO la config del mandante (`MandanteRequisitoConfig`) — si el mandante no activó un pilar, no aparece en el dashboard del contratista. El catálogo global puede tener más pilares de los que usa cualquier mandante.

**Pilares en el catálogo MVP (seed):** Legal/Laboral, HSE, Compliance. BERISA puede agregar Ambiental, Tecnológico, Maquinaria u otros según industria del cliente.

---

## Autenticación — Decisión importante

**No usar passlib.** Es incompatible con versiones modernas del paquete `bcrypt`. Usar bcrypt directamente:

```python
# app/core/security.py
import bcrypt
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

---

## Estados de documento

| Estado | Nombre | Quién lo asigna |
|--------|--------|----------------|
| 1 | Enviado | Contratista |
| 2 | En Análisis | Sistema (automático) |
| 3 | Observado | Sistema IA (con mensaje exacto de brecha) |
| 4 | Aprobado | Sistema IA / Mandante (excepción manual) |

Ciclo normal: `1 → 2 → 4`
Con corrección: `1 → 2 → 3 → 1 → 2 → 4`

---

## Roles de usuario

| Rol | Descripción |
|-----|------------|
| `berisa_admin` | Superadmin. Administra catálogo global de pilares. Crea mandantes. |
| `mandante_admin` | Activa/configura pilares, invita contratistas, ve dashboard granular, aprueba excepciones. |
| `contratista_admin` | Gestiona empresa, trabajadores y documentos. |
| `prevencionista` | Sube documentos, ve brechas. |

---

## Flujo de negocio — 5 etapas

| Etapa | Quién | Qué pasa |
|-------|-------|----------|
| 0. Invitación y Setup | BERISA + Mandante | BERISA configura catálogo; mandante activa pilares e invita al contratista |
| 1. Registro y Carga | Contratista | Sube documentos de empresa y por trabajador |
| 2. Auditoría Automática IA | Sistema | Clasifica, extrae campos, valida contra reglas del mandante |
| 3. Resolución de Brechas | Contratista + Mandante | Contratista corrige; mandante aprueba excepciones |
| 4. Resultado Granular | Sistema + Mandante | Dashboard por pilar y trabajador; certificado de acreditación |

---

## Credenciales de demo (desarrollo local)

Creadas por `python backend/scripts/seed.py`:

| Email | Contraseña | Rol | Contexto |
|-------|-----------|-----|---------|
| `admin@berisa.cl` | `admin123` | berisa_admin | — |
| `mandante@demo.cl` | `demo123` | mandante_admin | Codelco (Demo) |
| `contratista@demo.cl` | `demo123` | contratista_admin | Constructora Demo SpA |

---

## Diseño UI — Convenciones

- **Sidebar:** fondo `#0f172a` (dark slate), acento amber para ítem activo
- **Contenido:** fondo `#f8fafc` (casi blanco), cards con `bg-white border border-slate-200`
- **Badges de estado:** punto de color + texto, fondo muy suave (no filled). Nunca badge sólido de color fuerte.
- **Tablas:** `divide-y divide-slate-100`, header `bg-slate-50/60`, hover `bg-slate-50/70`
- **Panel lateral (detalle):** slide-over desde la derecha, `w-96`, fijo sobre el contenido
- **Referente visual:** Linear / Vercel dashboard — denso, limpio, sin decoración innecesaria

---

## Variables de entorno requeridas

```bash
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/acredita

# Redis
REDIS_URL=redis://localhost:6379/0

# Auth
JWT_SECRET=
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# IA
VISION_LLM_API_KEY=
VISION_LLM_MODEL=

# Storage
FILE_STORAGE=local         # local | s3
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Email
RESEND_API_KEY=

# App
ENVIRONMENT=development    # development | production
```

---

## Comandos de desarrollo

```bash
# Levantar entorno completo local
docker-compose up -d

# Backend — instalar dependencias
cd backend && pip install -r requirements.txt

# Backend — correr servidor
uvicorn main:app --reload --port 8000

# Backend — seed de datos demo (idempotente)
python backend/scripts/seed.py

# Backend — correr worker Celery
celery -A app.tasks worker --loglevel=info

# Backend — migraciones
alembic upgrade head

# Frontend — instalar dependencias
cd frontend && npm install

# Frontend — servidor de desarrollo (puerto 3000)
npm run dev

# Docs — servidor documentación (puerto 4000)
npx serve docs -l 4000
```

---

## Convenciones de código

- **Idioma del código:** español para nombres de dominio (mandante, contratista, pilar, acreditacion). Inglés para términos técnicos (router, service, middleware, model).
- **Modelos Pydantic:** un schema por tipo de documento en `ia/schemas.py`. Si el LLM no puede extraer un campo requerido, lanza `ExcepcionExtraccion` — nunca datos parciales silenciosos.
- **Reglas de negocio:** siempre en `reglas_service.py`. Nunca en un router ni en un modelo.
- **Decisiones de aprobación:** nunca las toma un LLM. El LLM extrae, `reglas_service.py` decide.
- **Migraciones:** siempre con Alembic. Nunca modificar tablas manualmente en producción.
- **Vencimientos:** los campos `fecha_vigencia_hasta` y `frecuencia_renovacion_dias` van en el modelo desde el inicio aunque las alertas sean Fase 2.
- **API prefix:** todos los routers usan `/api/v1/` — nunca `/api/` sin versión.
