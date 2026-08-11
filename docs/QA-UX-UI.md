# Revisión de experiencia de usuario y diseño — Acredita

Instrucciones para un agente que va a evaluar la aplicación como lo haría un
diseñador de producto senior: no si funciona, sino si **se entiende, se puede
usar sin que nadie te explique, y muestra la información de la mejor forma
posible**.

---

## En qué se diferencia de la prueba anterior

Ya hubo una revisión funcional (`docs/QA-FLUJO-E2E.md`) que recorrió los 13 actos
del flujo y encontró 25 defectos, todos corregidos. Esa prueba preguntaba *¿esto
hace lo que promete?*.

Esta pregunta otra cosa: **¿alguien que nunca vio esta aplicación sabría qué
hacer?** Una pantalla puede funcionar perfectamente y aun así ser inutilizable —
porque no dice qué se espera de ti, porque entierra lo importante bajo lo
accesorio, o porque usa un vocabulario que su usuario no tiene.

Si encuentras un bug funcional, anótalo, pero no es tu trabajo. Tu trabajo es lo
que un test jamás detecta.

---

## Quiénes usan esto, de verdad

Esto no es una herramienta para gente de software. Importa mucho, y debe guiar
cada juicio que hagas:

- **El prevencionista de riesgos** es un profesional de seguridad laboral. Sabe
  de normativa, no de interfaces. Muchas veces está en faena, con casco, mirando
  un teléfono con una mano.
- **El administrador del contratista** suele ser el dueño de una empresa chica o
  su jefe administrativo. Su incentivo es que su gente pueda entrar a trabajar
  cuanto antes; cada minuto que pasa sin entender qué le falta es dinero.
- **El mandante** es una empresa grande —minera, constructora— cuya
  responsabilidad legal es solidaria si su contratista incumple. Necesita
  certeza y respaldo, no optimismo.
- **BERISA** opera la plataforma y administra el catálogo normativo.

El costo de un error acá no es un formulario mal enviado: es una persona
entrando a una faena sin estar habilitada, o una empresa detenida sin saber por
qué. Evalúa con esa vara.

---

## Reglas duras

1. **Nada de producción.** Ni SSH, ni `docker-compose.prod.yml`, ni el servidor
   remoto. Sólo el entorno local de `docker-compose.yml`.
2. **No modifiques código.** Esta revisión es de lectura y observación. Propones,
   no implementas. Si algo te parece urgente, dilo en el informe.
3. **Nada de SQL de escritura ni de borrar archivos.** `SELECT` para entender los
   datos, sí.
4. **Nada de git.**
5. **No reinicies ni recrees contenedores.** Si algo parece caído, dilo.
6. **No inventes.** Cada observación tiene que venir de una pantalla que abriste.
   Si no la viste, no la reportes.

Puedes crear datos **usando la aplicación** (invitar, crear perfiles, subir
documentos): es parte de evaluar el flujo. No los crees por SQL.

---

## Entorno

| Qué | Dónde |
|---|---|
| Frontend | `http://localhost:3001` |
| Backend | `http://localhost:8000` |
| Postgres | `localhost:5434`, usuario/base/clave `acredita` |

Comandos docker desde `C:\Users\ctvas\projects\beriza`.

### Cuentas ya creadas

| Email | Clave | Rol | Contexto |
|---|---|---|---|
| `qa@berisa.cl` | `qa-e2e-2026` | berisa_admin | Opera la plataforma |
| `mandante.qa@ejemplo.cl` | `MineraQA2026!` | mandante_admin | Minera del Norte SpA, con datos reales |
| `forestal.qa@ejemplo.cl` | `ForestalQA2026!` | mandante_admin | **Forestal Verificación SpA: recién creado, sin nada configurado** |
| `contratista.qa@ejemplo.cl` | `QaTemp2026!` | contratista_admin | Constructora QA SpA, con documentos y trabajadores |

La cuenta de **Forestal** es la más valiosa de todas: es un mandante en su primer
día, con cero perfiles y cero contratistas. Ahí es donde se ve si el producto
sabe recibir a alguien.

Para probar un **prevencionista** del mandante y uno del contratista, invítalos
tú desde la pantalla Equipo de cada portal: pasar por el flujo de invitación y
activación es parte de lo que hay que evaluar.

### Cómo leer los correos

No hay servidor de correo: los mensajes se imprimen en el log del backend.

```bash
docker compose logs backend | grep -o "http://localhost:3001/activar?token=[A-Za-z0-9-]*" | tail -1
```

### Herramientas

Usa el navegador integrado (`mcp__Claude_Browser__*`). `read_page` para leer
estructura y contenido, `computer` con `screenshot` cuando necesites juzgar algo
visual —espaciado, jerarquía, alineación, contraste—, `resize_window` para
evaluar en teléfono y tablet, y `javascript_tool` para inspeccionar estilos
computados cuando dudes de un contraste o un tamaño.

---

## El sistema de diseño que ya existe

Antes de proponer nada, entiéndelo. Está en `frontend/src/app/globals.css` como
tokens de Tailwind v4 (`@theme`), y es deliberado:

- **Superficies y texto:** `surface`, `surface-app`, `surface-sunken`,
  `surface-inverse`; `ink`, `ink-secondary`, `ink-muted`, `ink-subtle`.
- **Bordes:** `line`, `line-subtle`, `line-strong`.
- **Familias por estado**, cada una con `-soft` (fondo), `-ink` (texto) y `-line`
  (borde): `ok`, `bloqueo`, `espera`, `proceso`, `accion`, `excepcion`, `vacio`,
  `brand`.

Las convenciones del proyecto están en `CLAUDE.md`: sidebar oscuro, contenido
casi blanco, badges de estado con punto de color y fondo muy suave —nunca badge
sólido—, tablas con `divide-y`, panel lateral deslizante de `w-96`, referente
visual Linear/Vercel: denso, limpio, sin decoración.

**Tu trabajo no es reemplazar ese sistema, es auditarlo:** ¿se aplica de forma
consistente?, ¿las familias de color significan lo mismo en todas partes?,
¿alguien confunde `espera` con `bloqueo`?, ¿hay valores sueltos escritos a mano
que deberían ser tokens? Si propones cambiarlo, argumenta por qué el actual falla.

También revisa qué hay instalado y si se está aprovechando: Shadcn/UI y Radix
para diálogos y formularios, `lucide-react` para íconos. Si ves patrones
reimplementados a mano donde ya había un componente accesible, dilo.

---

## Las nueve preguntas que debes hacerle a cada pantalla

1. **¿Qué es esto y qué se espera de mí?** En los primeros cinco segundos, sin
   leer nada largo. Si hay que deducirlo, está mal.
2. **¿Cuál es la acción principal?** Debe haber una sola evidente. Si compiten
   tres botones del mismo peso, no hay ninguna.
3. **¿La información está jerarquizada por importancia real?** Lo que decide algo
   arriba y grande; lo accesorio, discreto. Fíjate especialmente en las tablas
   densas: ¿todas esas columnas se usan?
4. **¿Los estados vacíos enseñan?** Un "No hay datos" es una oportunidad perdida:
   debería decir qué es esto, por qué está vacío y cuál es el siguiente paso.
5. **¿El sistema me dice qué pasó?** Al guardar, al fallar, al tardar. ¿Hay
   confirmación? ¿Hay estado de carga? ¿El error explica cómo salir de él, o sólo
   dice que algo salió mal?
6. **¿El vocabulario es el del usuario?** "Expediente", "acreditación", "pilar",
   "perfil", "alcance ENTIDAD" — ¿los entiende un prevencionista? ¿Y "mandante",
   que un contratista quizá llame simplemente "mi cliente"?
7. **¿Se puede usar en un teléfono?** Prueba en 375px. Tablas anchas, paneles de
   `w-96`, botones pequeños, formularios largos. La gente de faena está en el
   celular.
8. **¿Es accesible?** Contraste de texto sobre fondos suaves, tamaños de toque
   mínimos, foco visible al navegar con teclado, estados que no dependan sólo del
   color —un daltónico tiene que distinguir aprobado de rechazado—, etiquetas en
   los campos.
9. **¿Qué haría yo distinto?** No basta con señalar el problema: propón la
   alternativa concreta, y di qué gana el usuario con ella.

---

## Recorrido por tipo de usuario

Haz los cinco. Para cada uno, entra con su cuenta y recorre su portal completo
intentando cumplir su objetivo real, no inspeccionando pantallas sueltas.

### 1. BERISA — el operador de la plataforma

Cuenta: `qa@berisa.cl`. Pantallas: Inicio, Mandantes, Catálogo, Usuarios.

Su trabajo es dar de alta clientes y curar un catálogo de 44 requisitos
normativos agrupados en 3 pilares y 11 subpilares.

- El catálogo es lo más denso de la aplicación. ¿Se puede encontrar un requisito
  concreto? ¿Hay buscador, filtros? ¿Las descripciones largas —que son la
  instrucción de trabajo del revisor— compiten con la lectura o la ayudan?
- Cada requisito tiene código, entidad, alcance, nivel normativo y grupo. ¿Se
  entiende qué significa cada uno **sin** haber leído documentación?
- Al crear un mandante, ¿queda claro qué pasa después? ¿El operador sabe que ese
  cliente recibirá un correo y que no puede hacer nada hasta que lo active?
- La lista de mandantes: ¿las columnas responden las preguntas que BERISA se
  hace, o son las que fue fácil mostrar?

### 2. Mandante recién llegado — el momento de la verdad

Cuenta: `forestal.qa@ejemplo.cl`. **Empieza por acá y hazlo despacio.**

Es una empresa en su primer día. Su objetivo: dejar la plataforma lista para
exigirle documentos a sus contratistas. Ponte en sus zapatos de verdad.

- Entra y quédate quieto un momento. ¿Qué te dice la aplicación que hagas?
- ¿Existe algo que se parezca a un onboarding, aunque sea un orden sugerido? Hoy
  hay que descubrir solo que primero va un perfil, después un centro de trabajo,
  después invitar al contratista, después crear el servicio. **¿Se puede inferir
  ese orden desde la interfaz?** Si no, eso es lo más importante que vas a
  encontrar.
- La pantalla de Perfiles es el corazón de la configuración: pestañas Empresa y
  Personas, plantillas, filtro por nivel, matriz de cargos. Es también la más
  compleja de todo el producto. ¿Es comprensible? ¿Qué reordenarías?
- Las plantillas (Arranque, Legal completa, Obra física): ¿se entiende qué hace
  cada una **antes** de apretarla, y que reemplaza lo que había?
- La matriz de cargos: filas de requisitos por columnas de cargos. ¿Se entiende
  que no marcar nada significa "se le exige a todos"? Esa regla es contraintuitiva
  y crítica.

### 3. Mandante en operación — revisar y decidir

Cuenta: `mandante.qa@ejemplo.cl`, que ya tiene contratistas, servicios y
documentos en distintos estados.

- La bandeja de Revisión es donde pasa su día. ¿Se puede revisar rápido? ¿Se ve
  el documento sin salir? ¿Aprobar y observar tienen el peso visual correcto?
- Al observar, hay que escribir un motivo que el contratista leerá. ¿La interfaz
  ayuda a escribir un buen motivo, o invita a poner "falta"?
- El detalle de un contratista tiene cuatro pestañas (Estado, Documentos,
  Trabajadores, Servicios). ¿Es la división correcta? ¿Cuál abre por defecto y
  debería?
- La pregunta que este usuario trae siempre: **"¿puedo dejar entrar a esta
  empresa, sí o no?"** ¿La aplicación la responde de un vistazo?
- La aprobación por excepción deja pasar un documento con la brecha abierta y
  compromete a quien la firma. ¿La interfaz transmite ese peso?

### 4. Prevencionista del mandante — permisos acotados

Invítalo desde Equipo, con alcance sobre **un solo pilar**, y actívalo.

- Entra con su cuenta. ¿Entiende qué puede y qué no? Al abrir Revisión ve
  entregas que no puede resolver, en "Solo lectura".
- ¿Le queda claro **por qué** y qué tiene que pedir para poder aprobarlas?
- ¿Hay pantallas o botones que ve y no le sirven de nada?

### 5. Contratista — el que tiene que cumplir

Cuenta: `contratista.qa@ejemplo.cl`. Es quien más sufre si esto está mal
diseñado, y el que menos tiempo tiene.

- Su pregunta es una sola: **"¿qué me falta para poder trabajar?"** ¿La pantalla
  de inicio la responde sin hacer clic?
- Subir un documento: ¿se entiende qué archivo se pide, en qué formato, y para
  qué cliente? Un mismo documento puede servirle a varios mandantes.
- Un documento observado: ¿encuentra el motivo, y desde ahí puede corregir
  directo?
- Trabajadores y cargos: ¿entiende que el cargo decide qué documentos se le
  exigen a cada persona, y que no declararlo se lo exige todo?
- La carga masiva de nómina: ¿se entiende cómo, y qué hacer con las filas que
  fallan?
- **Pruébalo en 375px de ancho.** Es su escenario real.

---

## Qué entregar

Un archivo `informe-ux.md` con esta estructura:

### Por hallazgo

```
### [ALTO|MEDIO|BAJO] Título en una línea

- Usuario: contratista | mandante | prevencionista | BERISA
- Pantalla: ruta concreta
- Qué observé: lo que se ve hoy, descrito sin juicio
- Por qué es un problema: qué le pasa al usuario por esto
- Qué propongo: la alternativa concreta
- Esfuerzo estimado: bajo | medio | alto
```

Criterio de severidad, en términos de usuario y no de código:

| Nivel | Qué significa |
|---|---|
| **ALTO** | El usuario no puede completar su tarea, o la completa creyendo algo falso |
| **MEDIO** | La completa, pero con esfuerzo, dudas o pasos de más |
| **BAJO** | Roce, inconsistencia visual, oportunidad de mejora |

### Además, en prosa

1. **Los tres cambios de mayor impacto**, si sólo se pudieran hacer tres. Con su
   porqué.
2. **¿Qué pantalla está peor y cuál está mejor?** Sé concreto sobre qué hace bien
   la mejor, para poder replicarlo.
3. **Coherencia del sistema de diseño**: dónde se rompe, dónde hay valores
   sueltos que deberían ser tokens, dónde el mismo concepto se ve distinto en dos
   pantallas.
4. **La prueba del usuario nuevo**: para cada uno de los cinco perfiles, ¿podría
   usar la aplicación sin que nadie le explique? Si no, ¿en qué punto exacto se
   traba?
5. **Qué está bien y no hay que tocar.** Importa tanto como lo demás: sin esto,
   una próxima iteración puede romper lo que ya funcionaba.

---

## Qué no reportar

- Que no haya análisis de documentos con IA: no está implementado y es sabido.
- Advertencias de HMR o websockets en la consola.
- Que los correos se impriman en el log: es el comportamiento de desarrollo.
- Preferencias personales de estilo sin argumento. "Usaría otra tipografía" no
  es un hallazgo; "la jerarquía tipográfica no distingue el dato principal del
  secundario, y por eso el usuario lee primero lo que menos importa" sí lo es.
- Propuestas de rediseño total. Lo útil es lo que se puede hacer sobre lo que ya
  existe, salvo que argumentes por qué lo existente no tiene arreglo.
