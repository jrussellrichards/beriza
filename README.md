# BERISA Platform v4.0

**Plataforma de Inteligencia Comercial Multi-Lado · Infraestructura Chile/LatAm**

## Stack
- **Frontend:** HTML5 + Vanilla JS + berisa-api.js (API client)
- **Backend:** Node.js 18 + Express 4 · 17 módulos · ~130 endpoints
- **BD:** PostgreSQL 16 · 58 tablas (schema.sql + migration_004)
- **Infra:** Docker Compose · Redis · MinIO · Nginx
- **Auth:** JWT HS256 · bcrypt ROUNDS=12 · refresh rotation
- **Billing:** Stripe Checkout + Webhooks
- **Scrapers:** SEIA · MOP · CBC · Mercado Público

## Nuevas capacidades v4.0 (sobre v3.0)
- ✅ Privacy module + PII cifrada (Ley 19.628)
- ✅ Admin module: tenants, aprobación, tenant_limits
- ✅ ROI module: eventos y targets por vendedor
- ✅ Catálogo de capacidades codificado (30 ítems)
- ✅ Score multi-dimensional proveedor (6 dims)
- ✅ Project demand needs + matching explicable
- ✅ Marketplace matches con fit_reasons y risk_flags
- ✅ Cotizaciones con score técnico y comercial
- ✅ Buyer shortlists con tracking completo
- ✅ Commercial accounts separado del pipeline
- ✅ OC + hitos + facturas (procurement_full)
- ✅ Compliance subcontratos 4 etapas + checklist
- ✅ Finance Connect sandbox (factoring, seguro)
- ✅ Integraciones privadas framework (Gmail/HubSpot/ERP)
- ✅ Migration 004: 29 nuevas tablas
- ✅ berisa-api.js: cliente API frontend (reemplaza datos demo)
- ✅ admin.html: panel de administración de plataforma
- ✅ privacy.html: módulo privacidad y derechos ARCO

## Despliegue rápido

```bash
cd berisa && cp backend/.env.example backend/.env
# Editar JWT_SECRET, DB_PASSWORD, STRIPE keys

docker-compose up -d

# Migrations
docker exec berisa_api node -e "
  const {pool}=require('./db/pool');
  const fs=require('fs');
  pool.query(fs.readFileSync('./db/schema.sql','utf8'))
    .then(()=>pool.query(fs.readFileSync('./db/migration_004_multisided.sql','utf8')))
    .then(()=>{console.log('Migrations OK');process.exit(0)})
    .catch(e=>{console.error(e.message);process.exit(1)});
"
```

## URLs
- **Frontend:** http://localhost:3000
- **API:**      http://localhost:4000/api/v1
- **Docs:**     http://localhost:4000/api/docs
- **MinIO:**    http://localhost:9001

## Módulos API (130+ endpoints)
| Módulo | Endpoints |
|--------|-----------|
| auth | register, login, refresh, logout, me, forgot/reset-password |
| projects | CRUD, filtros, scoring, save/unsave |
| alerts | rules, events, read, webhooks |
| crm | opportunities, contacts, activities |
| suppliers | perfil, ICE, documentos, review, matching |
| capabilities | catalog, scores 6-dims, supplier caps |
| demand | project needs, generate-matches |
| matching | explainable fit_reasons + risk_flags |
| commercial | accounts, activities, summary |
| procurement/full | OC, milestones, invoices, subcontracts |
| rfq | create, publish, proposals, award |
| billing | checkout, portal, invoices (Stripe) |
| roi | events, targets, summary |
| privacy | policy, requests ARCO, contact-hash |
| admin | tenants, users, limits, stats |
| integrations | catalog, sync, events (Gmail/ERP/HubSpot) |
| analytics | summary, funnel, team-performance |
| reports | generate async, download |
| onboarding | progress, steps, dismiss |
| public-api | projects, stats (API key auth) |
| api-keys | create, revoke (Business+) |

## Estructura de archivos
```
berisa/
├── index.html                  # Login
├── dashboard.html              # Proyectos + mapas + BOM
├── pipeline.html               # CRM Kanban
├── alerts.html                 # Alertas
├── supplier-directory.html     # Directorio proveedores
├── supplier-onboarding.html    # Registro ICE wizard
├── buyer-portal.html           # Portal comprador RFQ
├── onboarding.html             # Activación guiada
├── pricing.html                # Planes SaaS
├── users.html                  # Gestión usuarios
├── admin.html                  # Panel administración  [NEW v4]
├── privacy.html                # Privacidad ARCO       [NEW v4]
├── assets/
│   ├── css/berisa.css
│   └── js/
│       ├── berisa-api.js       # API client            [NEW v4]
│       ├── berisa-data.js      # Demo data (fallback)
│       ├── berisa-header.js
│       ├── auth.js
│       ├── berisa-bom.js
│       └── berisa-logo.js
└── backend/
    ├── server.js
    ├── package.json
    ├── .env.example
    ├── Dockerfile
    ├── db/
    │   ├── schema.sql
    │   ├── migration_004_multisided.sql  [NEW v4]
    │   └── pool.js
    ├── middleware/
    │   ├── auth.js, tenant.js, tier.js
    │   ├── rateLimit.js, audit.js
    │   ├── errors.js, apiKeyAuth.js
    ├── routes/ (17 módulos)
    ├── services/
    │   ├── scoring.js, scraper.js
    │   ├── notifications.js, geocoder.js
    │   ├── enrichment.js, reports.js
    │   ├── storage.js, matching.js  [NEW v4]
    └── jobs/
        ├── scheduler.js
        └── scraper-runner.js
```

## Pendientes antes de producción
1. Conectar berisa-api.js en todas las páginas (BAPI.getProjects() en dashboard)
2. Política de privacidad + DPA con primer cliente
3. Desplegar en cloud (AWS/GCP/Render) con dominio y SSL
4. Scrapers SEIA reales (SCRAPER_ENABLED=true)
5. 50 proveedores reales + 5 mandantes piloto
6. Pentest antes de acceso público

---
*BERISA · Inteligencia Comercial · info@berisa.com*
