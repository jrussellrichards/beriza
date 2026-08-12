# Informes de la revisión de diseño

Los siete análisis independientes que dieron origen a
[`../RENOVACION-DISENO-2026.md`](../RENOVACION-DISENO-2026.md), que es la
decisión. Esto es el material de trabajo.

Están acá y no en un scratchpad porque contienen los **valores exactos** que la
síntesis resume pero no reproduce: la tabla de color con sus contrastes
calculados, la escala tipográfica nivel por nivel, los tokens de duración y
curva. Sin ellos, ejecutar las fases pendientes obliga a rehacer el análisis.

| Informe | Qué contiene | Estado |
|---|---|---|
| [`tecnologias.md`](tecnologias.md) | Qué stack conviene en 2026 y qué APIs nativas reemplazan dependencias | **Aplicado** (fase 1) |
| [`movimiento.md`](movimiento.md) | Duraciones, curvas, qué animar y qué no | **Aplicado** (fase 1) |
| [`tipografia.md`](tipografia.md) | Escala de siete niveles, pesos, cifras tabulares | Parcial — falta la escala completa |
| [`paleta.md`](paleta.md) | Paleta OKLCH con contrastes verificados y modo faena | **Pendiente — fase 2** |
| [`auditoria-visual.md`](auditoria-visual.md) | Recorrido pantalla por pantalla | Parcial |
| [`referentes.md`](referentes.md) | Competencia y productos densos bien diseñados | Referencia |
| [`logo.md`](logo.md) | Diagnóstico del logo y propuesta de pórtico | **Pendiente — fase 4** |

## Sobre su fiabilidad

Cada informe declara sus propios límites y conviene respetarlos:

- **Ningún competidor pudo inspeccionarse por dentro**: todos exigen
  credenciales. Lo de `referentes.md` sale de sitio público y material
  comercial, marcado ficha por ficha con su nivel de evidencia.
- **`paleta.md` trae los scripts que producen cada número.** Los contrastes
  están calculados, no estimados.
- **`logo.md` evaluó rasterizando a tamaño real** (16, 28 y 96 px) en vez de
  mirar el SVG ampliado.
- Las medidas tipográficas de `logo.md` son especificación, no observación: no
  se pudo renderizar con IBM Plex real.
