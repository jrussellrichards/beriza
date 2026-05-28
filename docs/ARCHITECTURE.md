# Arquitectura Berisa Platform

## Objetivo

Transformar un dashboard monolítico en una aplicación escalable, separada por responsabilidades, con identidad corporativa propia y controles de seguridad.

## Componentes

```text
frontend/
  Aplicación React + Vite
  UI corporativa Berisa
  Gestión de sesión y consumo de API

backend/
  API Node.js + Express
  Autenticación JWT
  RBAC por roles
  Validación de entrada con Zod
  Auditoría de acciones
  Migraciones y seed de datos

PostgreSQL
  Usuarios
  Proyectos
  Oportunidades
  Actividades
  Auditoría
```

## Flujo de datos

1. El dataset base sanitizado se carga en `projects`.
2. El seed crea oportunidades iniciales según score y ventana comercial.
3. El usuario accede con token JWT.
4. El backend filtra datos y limita visibilidad de contactos según rol.
5. Las acciones comerciales quedan registradas en auditoría.

## Escalabilidad

- API stateless para escalar horizontalmente.
- PostgreSQL como base transaccional.
- Índices por sector, país, región, estado, score y ventana comercial.
- JSONB para conservar payload original sin bloquear evolución del modelo.
- Docker como base para ambientes reproducibles.

## Evolución recomendada

- Migrar a colas para scraping y enriquecimiento de datos.
- Separar servicios: ingestion, enrichment, scoring, CRM API.
- Agregar caché para filtros y dashboards de alto tráfico.
- Implementar motor de permisos por organización y cuenta.
