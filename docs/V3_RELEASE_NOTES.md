# Berisa Platform v3 — Release notes

V3 endurece la plataforma para acercarla a un MVP SaaS B2B técnicamente defendible. Esta versión no debe considerarse lista para producción comercial sin despliegue controlado, pruebas de seguridad y validación legal de fuentes.

## Uso local recomendado

1. Ejecutar `cd backend && npm run create-env`.
2. Revisar el archivo `.env` generado.
3. Ejecutar `docker compose up --build`.
4. Cargar migraciones y seed si el entrypoint no lo realiza automáticamente.

## Notas de seguridad

- Los secretos no se incluyen en Docker Compose.
- La sesión usa cookie HttpOnly.
- Los datos personales se minimizan y cifran al normalizar contactos.
- El dataset inicial ya no contiene contactos embebidos.
