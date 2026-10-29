# Prompt definitivo: SantiSinPlata

Copia todo lo que está entre las líneas `=== INICIO ===` y `=== FIN ===` y pégalo en Claude (idealmente Claude Code, para que cree los archivos y corra las pruebas).

=== INICIO ===

# ROL

Eres un ingeniero de software senior y diseñador de producto, experto en apps web móviles sin backend. Vas a construir **SantiSinPlata**, una calculadora/control de gastos personal. Trabaja con rigor: no entregues pseudocódigo ni "TODO"; entrega código completo, funcionando y probado.

# OBJETIVO DEL PRODUCTO

Controlar gastos, ahorrar y organizar ingresos. El usuario registra valores **todos los días** y la app debe responder, en pocos toques, a: **¿en qué se me está yendo la plata?**, **¿cuánto me queda este mes?** y **¿voy bien con mis metas?**

# REQUISITOS FIJOS (no negociables)

| Aspecto | Decisión |
|---|---|
| Nombre | SantiSinPlata |
| Usuario | Una sola persona (sin cuentas, sin login) |
| Moneda | COP (peso colombiano), **sin decimales** |
| Dispositivo | Celular (mobile-first, 360–430 px de ancho; en escritorio, columna centrada máx. 480 px) |
| Tipo | 100 % local: sin servidor, sin backend, sin peticiones de red |
| Almacenamiento | `localStorage` |
| Complejidad | Básico: HTML + CSS + JavaScript vanilla, sin frameworks, sin build, sin npm para correr la app |
| Diseño | Minimalista premium |
| Color principal | `#1E293B` |
| Idioma de la interfaz | Español (Colombia) |

# FUNCIONES (alcance completo)

1. **Ingresos y gastos**: registro diario rápido, con categoría, nota y fecha.
2. **Presupuestos**: límite mensual por categoría y/o total, con alertas de avance.
3. **Metas de ahorro**: objetivo, fecha límite opcional, aportes, progreso y aporte sugerido.
4. **Gráficas y reportes**: dónde se va el dinero, tendencia, comparativo contra el mes anterior.
5. **Exportar datos**: CSV y JSON (respaldo), más importar JSON para restaurar.
6. **Gastos recurrentes**: suscripciones, arriendo, servicios; se generan solos.
7. **Deudas y cuotas**: deudas con saldo, pagos y compras a cuotas (con o sin interés).
8. **Gastos compartidos**: dividir un gasto entre personas y llevar quién le debe a quién.

No agregues funciones fuera de esta lista (sin multiusuario, sin sincronización, sin bancos, sin IA, sin multimoneda).

# ARQUITECTURA

## Principios
- **Una sola página (SPA)** con navegación por pestañas inferiores. Sin librerías externas ni CDN: la app debe funcionar **offline y abriéndose con doble clic en `index.html`** (protocolo `file://`).
- Por eso: **no uses módulos ES (`import`/`export`)**, porque fallan en `file://`. Usa scripts clásicos con un patrón IIFE/UMD que exponga un único espacio de nombres `SSP` en el navegador y `module.exports` en Node (para poder probar la lógica).
- **Separación estricta** en tres capas:
  1. **Dominio (puro)**: funciones sin DOM ni `localStorage`, deterministas, testeables. Reciben `state` y `hoy` como parámetros (nunca llaman a `new Date()` por dentro, excepto en un único helper inyectable).
  2. **Persistencia**: lectura/escritura de `localStorage`, migraciones, import/export.
  3. **UI**: render y eventos; solo llama al dominio y a la persistencia.
- Flujo de datos unidireccional: `acción del usuario → validar → mutar estado vía dominio → guardar → re-render`.

## Estructura de archivos
```
SantiSinPlata/
├── index.html            # estructura, <meta viewport>, CSP, carga de scripts
├── css/
│   └── styles.css        # tokens de diseño + componentes
├── js/
│   ├── money.js          # COP: parseo, formato, redondeo, reparto exacto
│   ├── dates.js          # fechas locales, meses, fin de mes, recurrencias
│   ├── validators.js     # validaciones de todas las entidades
│   ├── store.js          # localStorage, versión, migraciones, backup, import/export
│   ├── domain.js         # transacciones, presupuestos, metas, deudas, compartidos, reportes
│   ├── charts.js         # gráficas en SVG propio (sin librerías)
│   ├── ui.js             # vistas, formularios, navegación, toasts, diálogos
│   └── app.js            # arranque: carga estado, materializa recurrentes, primer render
├── tests/
│   ├── run.js            # ejecutor con node:test o aserciones simples (sin dependencias)
│   └── *.test.js         # pruebas de money, dates, validators, domain, store
├── manifest.webmanifest  # (opcional) para "Añadir a pantalla de inicio"
├── README.md             # instrucciones de ejecución, pruebas y respaldo
└── package.json          # solo con script "test": "node tests/run.js" (sin dependencias)
```

## Navegación (barra inferior, 5 destinos)
1. **Inicio** (resumen y botón `+` flotante)
2. **Movimientos** (lista y filtros)
3. **Planear** (presupuestos, metas, recurrentes)
4. **Deudas** (deudas, cuotas y compartidos)
5. **Reportes** (gráficas y exportar)

Ajustes (respaldo, importar, borrar todo, tema) se abre desde un ícono en el encabezado de Inicio.

# MODELO DE DATOS

Un único objeto de estado en `localStorage`, clave **`santisinplata:v1`**. Todo el dinero se guarda como **entero en pesos COP** (nunca `float`). Las fechas se guardan como texto `YYYY-MM-DD` (fecha local, sin hora ni zona) y los instantes como ISO-8601 UTC. Los `id` son `crypto.randomUUID()` con respaldo propio si no existe.

```jsonc
{
  "version": 1,
  "creadoEn": "2026-01-01T12:00:00.000Z",
  "actualizadoEn": "2026-01-01T12:00:00.000Z",
  "ajustes": {
    "diaInicioMes": 1,            // 1–28; permite "mes" que arranca el día de pago
    "tema": "auto",               // "auto" | "claro" | "oscuro"
    "nombreUsuario": ""           // opcional, solo para saludo
  },
  "categorias": [
    { "id": "cat_x", "nombre": "Mercado", "tipo": "gasto",   "icono": "🛒", "color": "#64748B", "archivada": false },
    { "id": "cat_y", "nombre": "Salario", "tipo": "ingreso", "icono": "💼", "color": "#0F766E", "archivada": false }
  ],
  "transacciones": [
    {
      "id": "tx_x",
      "tipo": "gasto",            // "gasto" | "ingreso"
      "monto": 25000,             // entero > 0
      "fecha": "2026-03-14",
      "categoriaId": "cat_x",
      "nota": "Almuerzo",         // máx. 120 caracteres
      "origen": "manual",         // "manual" | "recurrente" | "cuota" | "meta" | "compartido"
      "origenId": null,           // id de la regla/deuda/meta/gasto compartido que lo generó
      "creadoEn": "..."
    }
  ],
  "presupuestos": [
    { "id": "pr_x", "categoriaId": "cat_x", "limiteMensual": 600000, "alertaPct": 80 }
    // categoriaId = null  → presupuesto TOTAL del mes
  ],
  "metas": [
    {
      "id": "me_x", "nombre": "Viaje", "objetivo": 3000000, "fechaLimite": "2026-12-01",
      "aportes": [ { "id": "ap_x", "monto": 200000, "fecha": "2026-03-01", "txId": "tx_y" } ],
      "completada": false, "archivada": false
    }
  ],
  "recurrentes": [
    {
      "id": "re_x", "tipo": "gasto", "monto": 45000, "categoriaId": "cat_x", "nota": "Netflix",
      "frecuencia": "mensual",    // "semanal" | "quincenal" | "mensual" | "anual"
      "diaDelMes": 5,             // 1–31 (si el mes es más corto → último día)
      "diaSemana": null,          // 0–6, solo si semanal
      "inicio": "2026-01-05", "fin": null,
      "ultimaGeneracion": "2026-03-05", "activa": true
    }
  ],
  "deudas": [
    {
      "id": "de_x", "nombre": "Crédito moto", "acreedor": "Banco X",
      "tipo": "cuotas",           // "cuotas" | "libre"
      "capitalInicial": 6000000,
      "tasaMensualPct": 1.8,      // 0 si no hay interés (puede tener decimales: es un porcentaje, no dinero)
      "numCuotas": 24, "valorCuota": 0,   // valorCuota = 0 → se calcula (ver reglas)
      "primeraCuota": "2026-02-10", "diaPago": 10,
      "pagos": [ { "id": "pa_x", "fecha": "2026-02-10", "monto": 305000, "txId": "tx_z" } ],
      "archivada": false
    }
  ],
  "compartidos": [
    {
      "id": "co_x", "descripcion": "Cena de grupo", "fecha": "2026-03-14", "total": 180000,
      "categoriaId": "cat_x",
      "pagadoPor": "yo",          // "yo" o id de persona
      "participantes": [
        { "personaId": "yo", "parte": 60000 },
        { "personaId": "pe_a", "parte": 60000 },
        { "personaId": "pe_b", "parte": 60000 }
      ],
      "txId": "tx_w"              // el gasto propio (solo mi parte, o el total si yo pagué: ver reglas)
    }
  ],
  "personas": [ { "id": "pe_a", "nombre": "Ana" } ],
  "liquidaciones": [ { "id": "li_x", "personaId": "pe_a", "monto": 60000, "fecha": "2026-03-20", "sentido": "me_pagan" } ]
}
```

**Categorías por defecto** (se siembran en el primer arranque): Gasto → Mercado, Comida fuera, Transporte, Vivienda, Servicios, Salud, Educación, Ocio, Ropa, Suscripciones, Deudas, Otros. Ingreso → Salario, Extra, Otros. El usuario puede crear, renombrar y archivar (nunca borrar si tiene movimientos).

# REGLAS DE CÁLCULO

Implementa todas en `domain.js`/`money.js`, puras y con pruebas.

## Dinero
- **Entrada**: acepta `25000`, `25.000`, `25,000`, `$ 25.000` y los normaliza a entero. Rechaza decimales, notación científica y negativos en los formularios.
- **Formato**: `Intl.NumberFormat('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0})` → `$ 25.000`. Con respaldo manual si `Intl` falla.
- **Redondeo**: `Math.round` al peso. Los porcentajes se calculan sobre enteros y se redondean una sola vez al final.
- **Reparto exacto** `repartir(total, n)`: la suma de las partes **siempre** es igual al total; el resto (centavos de reparto) se asigna de a 1 peso a las primeras partes.
- Máximo por monto: `999.999.999.999` (evita desbordes y entradas absurdas).

## Periodo ("mes")
- El mes va del `diaInicioMes` al día anterior del mes siguiente. Con `diaInicioMes = 1` es el mes calendario. Función `rangoDelMes(fechaRef, diaInicio)`.
- Todo cálculo mensual usa ese rango (inclusivo en ambos extremos).

## Resumen de Inicio
- `ingresos` = suma de transacciones tipo ingreso del periodo.
- `gastos` = suma de transacciones tipo gasto del periodo.
- `balance` = `ingresos − gastos`.
- `tasaAhorro` = `balance / ingresos` (si `ingresos = 0` → `null` y se muestra "—").
- `gastoDiarioPromedio` = `gastos / díasTranscurridos` (mínimo 1).
- `proyeccionFinDeMes` = `gastoDiarioPromedio × díasDelPeriodo` (solo informativa, rotulada como estimado).
- `disponibleDiario` = `max(0, ingresos − gastos − comprometido) / díasRestantes` (mínimo 1 día), donde `comprometido` = recurrentes pendientes del periodo + cuotas de deudas pendientes del periodo.
- Los aportes a metas y los pagos de deuda **sí son gastos** (salidas de caja) con `origen` distinto, pero en los reportes por categoría se agrupan en "Ahorro" y "Deudas" para no distorsionar el análisis. Nunca se cuentan dos veces.

## Presupuestos
- `gastado(cat)` = suma de gastos del periodo en esa categoría. `pct = gastado / limite`.
- Estados: **ok** (< `alertaPct`), **atención** (≥ `alertaPct` y ≤ 100 %), **excedido** (> 100 %).
- `restante = limite − gastado` (puede ser negativo; se muestra como "te pasaste por $X").
- `ritmoEsperado = limite × díasTranscurridos / díasDelPeriodo`; si `gastado > ritmoEsperado × 1.15` muestra aviso "vas más rápido de lo planeado".
- Presupuesto total (`categoriaId = null`) suma todos los gastos del periodo, incluidos los de categorías sin presupuesto propio.
- Un solo presupuesto por categoría (validado).

## Metas de ahorro
- `ahorrado = Σ aportes`; `pct = min(100, ahorrado / objetivo)`; `faltante = max(0, objetivo − ahorrado)`.
- Con `fechaLimite`: `mesesRestantes = max(1, meses completos hasta la fecha)`; `aporteSugeridoMensual = ceil(faltante / mesesRestantes)`.
- Estado: **completada** si `ahorrado ≥ objetivo`; **atrasada** si hay fecha límite vencida y no se completó; **en curso** en otro caso.
- Cada aporte crea una transacción de gasto con `origen = "meta"`. Retirar un aporte elimina también esa transacción (con confirmación).

## Gastos recurrentes
- Función `ocurrenciasPendientes(regla, hoy)` devuelve las fechas entre `ultimaGeneracion` (exclusive) y `hoy` (inclusive), respetando `inicio` y `fin`.
- Mensual con `diaDelMes` mayor que los días del mes → se usa el **último día** de ese mes (29/30/31 → 28/29/30 en febrero, etc.).
- Quincenal: días 15 y último del mes. Semanal: según `diaSemana`. Anual: misma fecha, ajustando 29-feb a 28-feb en años no bisiestos.
- Al abrir la app, `app.js` genera las transacciones pendientes (tope de seguridad: 366 ocurrencias por regla por ejecución) y actualiza `ultimaGeneracion`. **Idempotente**: abrir la app 10 veces no duplica nada.
- Pausar una regla no borra lo generado. Eliminar una regla conserva las transacciones ya creadas.
- Una ocurrencia generada puede editarse o borrarse sin afectar la regla.

## Deudas y cuotas
- Cuota con interés (sistema francés): `cuota = capital × i / (1 − (1 + i)^−n)` con `i = tasaMensualPct / 100`; si `i = 0` → `capital / n`. Redondea al peso, y la **última cuota ajusta** la diferencia para que el saldo cierre exactamente en 0.
- Tabla de amortización: por cuota → `interés = round(saldo × i)`, `abonoCapital = cuota − interés`, `saldo = saldo − abonoCapital`.
- Si el usuario fija `valorCuota` a mano, se respeta y se recalcula el número de cuotas restantes.
- `saldoPendiente` = capital inicial − Σ abonos a capital de los pagos registrados (en deudas "libre", = capital − Σ pagos).
- `proximaCuota` = primera cuota sin pago; `cuotasPagadas / numCuotas`; marca **vencida** si su fecha < hoy y no está pagada.
- Registrar un pago crea una transacción de gasto (`origen = "cuota"`, categoría Deudas) y la vincula. Un pago puede ser mayor que la cuota (abono extra: reduce capital y recalcula el plan) pero **nunca mayor que el saldo + interés del periodo**.
- Resumen: deuda total, pagos del mes, y la próxima fecha de pago más cercana.
- **Compras a cuotas con tarjeta** se modelan como deuda `cuotas` con `tasaMensualPct` configurable (0 si es sin interés).

## Gastos compartidos
- Modos de división: **igual**, **montos exactos** y **porcentajes**. Siempre se valida que las partes sumen exactamente el total (igual usa `repartir`).
- Si **yo pagué**: mi gasto real = mi parte; lo demás es un "me deben" por persona. Se crea una transacción de gasto **solo por mi parte** (`origen = "compartido"`), no por el total.
- Si **otra persona pagó**: yo le debo mi parte. Se crea la transacción de gasto por mi parte (el gasto es mío aunque aún no pague) y queda "debo" a esa persona.
- `saldo(persona)` = Σ lo que esa persona me debe − Σ lo que yo le debo − liquidaciones. Positivo → "te debe", negativo → "le debes".
- Liquidar un saldo registra una `liquidacion`; **no** crea ingreso ni gasto adicional (solo mueve la deuda entre personas). Aclarar esto en la interfaz.
- No permitir eliminar una persona con saldo ≠ 0.

## Reportes
- **Dona**: gasto por categoría del periodo (máx. 6 porciones + "Otros"), con porcentaje y monto.
- **Barras**: ingresos vs. gastos de los últimos 6 meses.
- **Línea/área**: gasto acumulado del mes actual frente al mes anterior (día a día).
- **Top 5** de categorías y **top 5** de gastos individuales del periodo.
- **Comparativo**: variación porcentual vs. el mes anterior por categoría (`↑ 12 %` / `↓ 8 %`; si el mes anterior es 0 → "nuevo").
- Selector de periodo: este mes, mes anterior, últimos 3 meses, año, rango personalizado.
- Estado vacío amable cuando no hay datos (nunca una gráfica rota).

# VALIDACIONES

Centralizadas en `validators.js`. Cada función devuelve `{ ok: boolean, errores: { campo: "mensaje en español" } }`. La UI muestra el error junto al campo, con `aria-describedby`, y no cierra el formulario.

| Entidad | Reglas |
|---|---|
| Monto | entero, `1 ≤ monto ≤ 999.999.999.999`; sin decimales ni texto |
| Fecha | formato `YYYY-MM-DD` válido en calendario real (rechaza 31-feb); no más de 1 año en el futuro; no anterior a 2000 |
| Nota / nombres | `trim`, máx. 120 (nota) y 40 (nombres); sin solo espacios |
| Categoría | nombre único por tipo (sin distinguir mayúsculas/tildes); debe existir y no estar archivada al crear movimientos |
| Presupuesto | límite > 0; una sola entrada por categoría; `alertaPct` entre 50 y 100 |
| Meta | objetivo > 0; fecha límite posterior a hoy; aporte > 0 |
| Recurrente | frecuencia válida; día 1–31; `fin` ≥ `inicio`; monto > 0 |
| Deuda | capital > 0; `numCuotas` entero 1–600; tasa 0–100 con hasta 2 decimales; pago > 0 y ≤ saldo + interés del periodo |
| Compartido | ≥ 2 participantes; partes ≥ 0 que suman el total exacto; pagador entre los participantes |
| Importación | ver Seguridad |

Reglas generales de UX en formularios: foco automático en el monto, teclado numérico (`inputmode="numeric"`), formato de miles mientras se escribe, botón deshabilitado mientras el formulario sea inválido, y confirmación antes de cualquier borrado.

# DISEÑO DE INTERFAZ

## Sensación
Minimalista premium: mucho aire, tipografía clara, una sola jerarquía por pantalla, cero ruido. Piensa "banca privada", no "app de finanzas colorida". Nada de degradados llamativos ni sombras pesadas.

## Tokens (definir como variables CSS en `:root`)
```
--primario:        #1E293B   /* slate-800: encabezados, botón principal, barra activa */
--primario-hover:  #0F172A
--superficie:      #FFFFFF
--fondo:           #F8FAFC
--borde:           #E2E8F0
--texto:           #0F172A
--texto-suave:     #64748B
--ingreso:         #0F766E   /* verde sobrio */
--gasto:           #B45309   /* ámbar quemado; evitar rojo chillón para el gasto normal */
--alerta:          #B91C1C   /* solo para excedido/vencido */
--acento:          #C8A24A   /* dorado tenue, uso mínimo: metas completadas, detalle premium */
--radio:           16px      --radio-sm: 10px
--sombra:          0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.06)
--espacio:         4px base (escala 4/8/12/16/24/32)
```
- **Modo oscuro** automático con `prefers-color-scheme` (+ opción manual): fondo `#0B1220`, superficie `#111B2E`, texto `#E5E7EB`; el `#1E293B` pasa a ser superficie elevada. Los contrastes deben cumplir **WCAG AA** (≥ 4.5:1 en texto).
- **Tipografía**: pila del sistema (`-apple-system, "Segoe UI", Roboto, sans-serif`), sin fuentes externas. Montos con `font-variant-numeric: tabular-nums`. Escala: 12 / 14 / 16 / 20 / 28 / 36.
- **Íconos**: emojis o SVG inline. Sin librerías de íconos.

## Pantallas (describir y construir todas)
1. **Inicio**: saludo discreto → tarjeta principal `#1E293B` con "Te queda este mes" (balance) en grande, y debajo ingresos/gastos; barra de avance del presupuesto total; chip "Puedes gastar ~$X por día"; los 3 últimos movimientos; alertas activas (presupuesto cerca/excedido, cuota próxima, recurrente de hoy). Botón flotante `+`.
2. **Registro rápido** (hoja inferior): selector Gasto/Ingreso, teclado numérico grande para el monto, chips de categorías más usadas, fecha (por defecto hoy, con atajos Hoy/Ayer), nota opcional, botón "Guardar". Debe completarse en **≤ 4 toques**. Opción "Guardar y agregar otro".
3. **Movimientos**: lista agrupada por día con total diario, búsqueda por nota, filtros (tipo, categoría, rango), deslizar o tocar para editar/eliminar con opción de **deshacer** (toast de 6 s).
4. **Planear**: pestañas internas *Presupuestos · Metas · Recurrentes*. Presupuestos con barra de color según estado; metas con anillo de progreso; recurrentes con próxima fecha.
5. **Deudas**: pestañas internas *Deudas · Compartidos*. Tarjeta por deuda (saldo, barra de cuotas, próxima cuota, botón "Registrar pago"); detalle con tabla de amortización. Compartidos: lista de personas con su saldo ("Ana te debe $60.000"), crear gasto compartido, liquidar.
6. **Reportes**: selector de periodo, dona, barras, línea, tops y comparativo; botón "Exportar".
7. **Ajustes**: día de inicio del mes, tema, exportar CSV/JSON, importar JSON, borrar todos los datos (doble confirmación escribiendo "BORRAR").

## Interacción y accesibilidad
- Objetivos táctiles ≥ 44×44 px; navegación inferior fija con `env(safe-area-inset-bottom)`.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` y `theme-color` = `#1E293B`.
- Etiquetas `<label>` reales, `aria-live="polite"` para toasts, foco visible, orden de tabulación lógico, `prefers-reduced-motion` respetado. Animaciones sutiles (150–250 ms).
- Hojas modales con `role="dialog"`, cierre con Esc y retorno del foco.
- Gráficas en **SVG propio**, con `role="img"`, `aria-label` descriptivo y tabla/lista equivalente accesible; nunca depender solo del color (agregar etiquetas y porcentajes).
- Estados vacíos con mensaje corto y un botón de acción. Estados de error claros y en español.

# SEGURIDAD Y PRIVACIDAD

- **Cero red**: sin `fetch`, sin analítica, sin fuentes ni scripts externos. Añade en `index.html` una CSP: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; manifest-src 'self'; base-uri 'none'; form-action 'none'">`. Sin `style` ni `onclick` inline (los estilos dinámicos se hacen con clases o `element.style` desde JS).
- **Anti-XSS**: todo texto del usuario (notas, nombres, descripciones) se inserta con `textContent`/`createElement`, **nunca** con `innerHTML`. Prohibido `eval`, `new Function` y `document.write`.
- **Importación de JSON no confiable**: tamaño máx. 5 MB; `JSON.parse` en `try/catch`; validar **esquema completo** (tipos, rangos, ids únicos, referencias a categorías/personas existentes, sumas coherentes); descartar claves desconocidas y claves `__proto__`/`constructor`/`prototype`; mostrar resumen ("X movimientos, Y metas…") y pedir confirmación antes de **reemplazar**; hacer copia de seguridad automática del estado previo antes de reemplazar.
- **Exportar CSV**: protege contra *CSV/formula injection* anteponiendo `'` a celdas de texto que empiecen por `=`, `+`, `-`, `@`, tab o retorno de carro; escapa comillas y comas; incluye BOM UTF-8 para que Excel abra bien las tildes.
- **Persistencia segura**: `try/catch` en toda lectura/escritura de `localStorage` (modo privado, cuota llena, datos corruptos). Si el JSON guardado está corrupto, **no lo sobrescribas**: guárdalo en `santisinplata:corrupto:<timestamp>`, avisa al usuario y ofrece restaurar desde respaldo o iniciar vacío.
- **Cuota**: si `setItem` falla por cuota, avisa con un mensaje claro y ofrece exportar un respaldo inmediato. Mostrar en Ajustes el tamaño aproximado usado.
- **Respaldo rotativo**: antes de cada migración o importación, copia el estado a `santisinplata:backup`. Recordatorio suave si han pasado > 30 días sin exportar.
- **Aviso honesto** en Ajustes: los datos viven solo en este navegador; borrar los datos del sitio o desinstalar el navegador los elimina; exportar JSON es el respaldo real. No hay cifrado ni PIN (alcance básico); si quieres ofrecerlo como mejora futura, solo menciónalo en el README.
- Sin `console.log` de datos del usuario en producción.
- Migraciones: `store.js` incluye `migrar(estado)` que sube de versión paso a paso (`v1 → v2…`) para no perder datos en futuras versiones.

# PRUEBAS

Sin dependencias: usa `node:test` y `node:assert` (Node ≥ 18) o un ejecutor mínimo propio en `tests/run.js`. `npm test` debe pasar en limpio. Cubre como mínimo:

- **money**: parseo (`"25.000"`, `"$ 25,000"`, `"1e3"` rechazado, `"12,5"` rechazado), formato COP, `repartir(100000, 3)` suma exacta, límites.
- **dates**: fechas inválidas (31-feb), años bisiestos, `rangoDelMes` con `diaInicioMes` 1 y 25, cambio de año, fin de mes.
- **validators**: casos válidos e inválidos de cada entidad en la tabla anterior.
- **domain / resumen**: balance, tasa de ahorro con ingresos = 0, proyección, disponible diario.
- **presupuestos**: estados ok/atención/excedido en los umbrales exactos (79 %, 80 %, 100 %, 101 %).
- **metas**: aporte sugerido, meta vencida, meta completada, borrar aporte elimina su transacción.
- **recurrentes**: 31 → último día de febrero; **idempotencia** (generar dos veces no duplica); app cerrada 3 meses genera 3 ocurrencias; regla pausada; tope de 366.
- **deudas**: cuota francesa contra un valor conocido (p. ej. $6.000.000, 1,8 % mensual, 24 cuotas), saldo final exactamente 0, tasa 0 %, abono extra, pago mayor al saldo rechazado.
- **compartidos**: división igual con resto, porcentajes que no suman 100 rechazados, saldos netos entre varias personas, liquidación.
- **store**: guardar/leer, JSON corrupto → no se pierde, migración, importación maliciosa (`__proto__`, tipos erróneos, referencias rotas) rechazada, exportación CSV con `=cmd|...` neutralizada.
- **Prueba manual en celular** (lista de verificación en el README): registro en ≤ 4 toques, modo oscuro, sin scroll horizontal a 360 px, rotación, recarga conserva datos, offline.

Incluye también un **dataset de ejemplo** (botón en Ajustes "Cargar datos de ejemplo", con confirmación) para ver la app llena y poder probar las gráficas.

# INSTRUCCIONES DE EJECUCIÓN (deben ir en el README.md)

1. **Abrir**: doble clic en `index.html` (funciona con `file://`), o servir con `python3 -m http.server 8080` y abrir `http://localhost:8080`.
2. **En el celular**: servir en la red local (`python3 -m http.server 8080 --bind 0.0.0.0`), abrir `http://<IP-del-PC>:8080` y usar "Añadir a pantalla de inicio". Alternativa: publicar la carpeta en GitHub Pages / Netlify Drop (sigue siendo local en cuanto a datos).
3. **Pruebas**: `node tests/run.js` o `npm test`.
4. **Respaldo**: Ajustes → Exportar JSON; restaurar con Importar JSON.
5. **Solución de problemas**: datos perdidos (se borraron datos del sitio), navegador en modo privado (no persiste), cuota llena.

# ENTREGABLES Y FORMA DE TRABAJO

1. **Antes de escribir código**, responde en máximo 15 líneas: tu plan, los supuestos que tomaste y cualquier ambigüedad. Si algo no es crítico, **decide tú y documenta el supuesto**; no me hagas preguntas innecesarias.
2. Construye por etapas y verifica cada una antes de seguir: (a) `money/dates/validators` + pruebas → (b) `store` + pruebas → (c) `domain` + pruebas → (d) UI e Inicio + registro rápido → (e) Movimientos → (f) Planear → (g) Deudas y compartidos → (h) Reportes y exportar → (i) pulido, accesibilidad y README.
3. **Ejecuta las pruebas** y muestra el resultado real. No digas que algo funciona si no lo verificaste; si algo falla o quedó pendiente, dilo claramente.
4. Si tienes navegador disponible, abre la app en un viewport de 390×844, toma capturas de Inicio, Registro, Planear, Deudas y Reportes, y corrige defectos visuales.
5. Entrega **todos los archivos completos** (sin "resto igual"), el código comentado solo donde la lógica no sea obvia, y al final un **resumen**: qué se construyó, cómo correrlo, resultado de las pruebas, supuestos y limitaciones conocidas.

# CRITERIOS DE ACEPTACIÓN (auto-verifica antes de terminar)

- [ ] Abre con doble clic en `index.html`, sin red, sin errores en consola.
- [ ] Registrar un gasto toma ≤ 4 toques y actualiza Inicio al instante.
- [ ] Recargar la página conserva todos los datos; exportar → borrar todo → importar los restaura idénticos.
- [ ] Todo monto se guarda como entero y se muestra como COP sin decimales.
- [ ] Ninguna operación de dinero usa `float` para guardar; las sumas de reparto cuadran al peso.
- [ ] Los recurrentes no se duplican al recargar.
- [ ] La deuda a cuotas termina con saldo exactamente 0.
- [ ] Un JSON malicioso o corrupto no rompe ni borra los datos existentes.
- [ ] Ninguna entrada del usuario llega al DOM vía `innerHTML`.
- [ ] Sin scroll horizontal a 360 px; contraste AA en claro y oscuro; todo operable con teclado.
- [ ] `npm test` pasa en verde.
- [ ] El diseño usa `#1E293B` como color principal y se siente minimalista premium.

No agregues librerías, no cambies el alcance y no dejes funciones a medias. Empieza ahora con el plan breve y luego construye.

=== FIN ===

---

## Notas para ti (no copiar)

- **Decisiones que tomé por ti** (puedes cambiarlas editando el prompt): COP sin decimales; "mes" configurable por día de inicio (útil si cobras el 15 o 30); gastos compartidos registran solo *tu parte* como gasto real; los aportes a metas y pagos de deuda cuentan como salidas de caja pero se agrupan aparte en reportes; sin PIN/cifrado por ser alcance básico.
- **Dónde pegarlo**: lo mejor es Claude Code (crea archivos, corre `npm test` y puede revisar capturas). En claude.ai también sirve, pero tendrás que copiar los archivos a mano.
- **Si la respuesta se corta** por longitud, escribe: `Continúa desde la etapa donde quedaste, sin repetir lo ya entregado`.
