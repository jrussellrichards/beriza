# Manuales de usuario

Manuales para usuarios finales, uno por portal. Son HTML autocontenidos: se
abren con doble clic, se envían por correo o se publican tal cual. Lo único
externo es la tipografía (IBM Plex, desde Google Fonts); sin conexión se ven
con la letra del sistema.

| Archivo | Para quién |
|---|---|
| `manual-contratista.html` | Administradores y colaboradores de empresas contratistas |
| `manual-mandante.html` | Administradores y revisores de la empresa mandante |

Reflejan la plataforma a **septiembre de 2026** (commit `0aae68d`). Se
escribieron leyendo el código de cada pantalla, con las etiquetas exactas de
botones y estados, y siguen el sistema de diseño de
`frontend/src/app/globals.css` y `shared/ui/estado-badge.tsx` (mismos colores
y glifos de estado). Las empresas y personas de los ejemplos son inventadas.

## Qué actualizar cuando cambie la app

Los manuales describen cómo funciona la app **hoy**, no cómo se planeó. Varias
frases dependen de limitaciones actuales. Si se implementa alguna de estas
cosas, hay que corregir el texto:

- **Revisión 100% manual** (`IA_HABILITADA=False`). Ningún manual menciona IA
  ni el estado "En análisis". Si se activa el pipeline, reescribir
  "Estados de un documento" y "Revisar documentos".
- **Las observaciones no se envían por correo** al contratista, y el mandante
  no recibe ninguna notificación: el manual lo dice explícitamente.
- **"Vigente hasta" es opcional al aprobar**, y sin fecha el documento nunca
  vence. El manual del mandante insiste en completarla.
- **Carga de nómina**: el arrastrar y soltar no funciona; el manual indica
  usar el botón.
- **Configuración del mandante**: Notificaciones y Seguridad están "en
  desarrollo"; el RUT se cambia a través de BERISA.
- **Sesión de 60 minutos** y cambio de contraseña solo con "¿La olvidaste?".
- **No hay certificado de acreditación ni reportes descargables.**
- Las tablas de permisos (Colaborador/Administrador y Revisor/Administrador)
  siguen lo que permite el **backend**, no lo que muestra hoy la interfaz:
  hay botones visibles para roles que después reciben un 403.

Los correos que describe el manual del contratista (invitación, documentos
aplicados, resumen de vencimientos 30/15/7/1) solo llegan si `EMAIL_FROM` usa
un dominio verificado en Resend. Con el remitente de pruebas
`onboarding@resend.dev` no llegan a nadie más que a la cuenta dueña.
