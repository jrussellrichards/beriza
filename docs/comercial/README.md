# Material comercial

| Archivo | Qué es |
|---|---|
| `brochure-mandantes.html` | Brochure para empresas mandantes: 4 hojas A4. Es la fuente editable. |
| `brochure-mandantes.pdf` | El mismo brochure en PDF, listo para enviar. Se genera desde el HTML. |

## Regenerar el PDF después de editar el HTML

Las hojas están maquetadas a tamaño A4 (`@page { size: A4; margin: 0 }`), así
que basta con imprimirlas con Chrome sin encabezados. Desde Git Bash, en la
raíz del repo:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf="$(cygpath -w "$PWD")\\docs\\comercial\\brochure-mandantes.pdf" "file:///$(cygpath -m "$PWD")/docs/comercial/brochure-mandantes.html"
```

`--virtual-time-budget` da tiempo a que cargue IBM Plex desde Google Fonts.
Sin conexión, el PDF sale con la letra del sistema. Cada hoja tiene alto fijo
con `overflow: hidden`: si un texto crece demasiado, **se corta sin avisar**.
Revisa el PDF después de cualquier cambio de texto.

## Qué cuidar al editarlo

- **Contacto pendiente.** El cierre dice solo "Contacta a BERISA". Falta el
  correo, el teléfono o el sitio web.
- **Solo promete lo que la app ya hace.** La revisión la hace el equipo del
  mandante (no hay IA: `IA_HABILITADA=False`), y no se mencionan certificados
  de acreditación, reportes ni subcontratistas. Si esas funciones llegan, se
  pueden agregar. No antes.
- **Avisos de vencimiento (30/15/7/1 días).** La página 4 los promete, pero
  solo llegan si `EMAIL_FROM` usa un dominio verificado en Resend.
- **Afirmaciones legales.** La página 2 resume los arts. 183-B, 183-C y 183-D
  del Código del Trabajo (responsabilidad solidaria vs. subsidiaria). Lleva la
  nota "no constituye asesoría legal". Conviene que un abogado lo revise antes
  de una campaña grande.
- Las empresas de los ejemplos son inventadas. No usar nombres de clientes
  reales sin su permiso.
