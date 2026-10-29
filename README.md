# SantiSinPlata

Control de gastos personal para el celular: registra tus ingresos y gastos del día, ponle límite a cada categoría, ahorra para tus metas y entiende en qué se te va la plata. **Todo queda en tu dispositivo** (sin servidor, sin cuentas, sin internet).

- Moneda: **COP**, solo pesos enteros.
- Datos: `localStorage` del navegador.
- Tecnología: HTML + CSS + JavaScript sin frameworks ni dependencias.
- Diseño: minimalista premium, color principal `#1E293B`, modo claro/oscuro.

## Qué incluye

| Sección | Qué hace |
|---|---|
| **Inicio** | Cuánto te queda este mes, cuánto puedes gastar por día, presupuesto total, avisos y últimos movimientos. |
| **Registro rápido** (botón `+`) | Gasto o ingreso en 2–3 toques: `+` → monto → (categoría) → Guardar. Fecha por defecto: hoy. |
| **Movimientos** | Lista por día con búsqueda y filtros; toca uno para editarlo o eliminarlo (con *Deshacer*). |
| **Planear** | **Presupuestos** por categoría o totales con alertas; **metas de ahorro** con aporte sugerido; **recurrentes** (arriendo, suscripciones, salario) que se registran solos. |
| **Deudas** | Créditos y compras a cuotas con plan de pagos, abonos extra y saldo; **gastos compartidos** con saldos por persona y liquidación. |
| **Reportes** | Dona por categoría, ingresos vs. gastos (6 meses), gasto acumulado, top 5 y comparativo con el periodo anterior. |
| **Ajustes** | Día de inicio del mes, tema, categorías, exportar (CSV/JSON), importar, datos de ejemplo, borrar todo. |

## Cómo ejecutarla

### 1. En el computador (lo más simple)
Abre `index.html` con doble clic. Funciona con `file://` y sin internet.

### 2. Con un servidor local
```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

### 3. En el celular
**Opción A: misma red Wi‑Fi.**
```bash
python3 -m http.server 8080 --bind 0.0.0.0
# en el celular: http://<IP-de-tu-computador>:8080
```
Luego, en el menú del navegador, **Añadir a pantalla de inicio**.

**Opción B: publicarla** (GitHub Pages, Netlify Drop, etc.): sube la carpeta tal cual. Aunque la página esté en internet, **tus datos siguen guardándose solo en tu navegador**.

> Importante: los datos pertenecen al navegador *y al sitio* donde los registraste. Si abres la app desde otra dirección (por ejemplo `file://` y luego `localhost`), verás datos distintos. Usa **Exportar JSON** → **Importar JSON** para pasarlos de uno a otro.

## Pruebas

Requiere Node 18 o superior; no hay dependencias que instalar.
```bash
npm test          # o: node tests/run.js
```
Cubren dinero (parseo, formato, reparto exacto), fechas (bisiestos, fin de mes, periodos que empiezan el día 25), validaciones, presupuestos (umbrales 79/80/100/101 %), metas, recurrentes (idempotencia, día 31, tope de 366), deudas (cuota fija, saldo final exactamente 0, abonos extra, pago mayor al saldo), gastos compartidos (resto de la división, liquidaciones), almacenamiento (datos corruptos, cuota llena, migración), importación maliciosa y exportación CSV segura.

### Lista de verificación manual en el celular
- [ ] Registrar un gasto toma ≤ 4 toques y se refleja de inmediato en Inicio.
- [ ] Recargar la página conserva los datos.
- [ ] Sin scroll horizontal a 360 px de ancho; también al rotar el celular.
- [ ] Modo oscuro (cambiar el tema del teléfono o en Ajustes).
- [ ] Funciona en modo avión.
- [ ] Exportar JSON → Borrar todo → Importar JSON restaura todo igual.
- [ ] Un presupuesto que se pasa muestra el aviso en Inicio.

## Respaldo y datos

- **Exportar** (Reportes → Exportar, o Ajustes): `CSV` con los movimientos (se abre en Excel o Google Sheets; si Excel muestra una sola columna, usa *Datos → Desde texto/CSV* y elige la coma como separador) y `JSON` con la copia completa.
- **Importar** (Ajustes): reemplaza los datos; antes se muestra un resumen y se guarda una copia automática que puedes restaurar.
- Se recuerda exportar un respaldo si pasan más de 30 días.
- Los datos **no están cifrados** ni protegidos con clave: cualquiera con acceso a tu celular desbloqueado puede abrir la app. Un PIN o cifrado sería una mejora futura.

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| Desaparecieron los datos | Se borraron los datos del sitio o del navegador, o se usó otra dirección/navegador. Restaura con *Importar JSON*. |
| Aviso "no permite guardar datos" | Modo privado o almacenamiento bloqueado: lo que registres se pierde al cerrar. |
| Aviso "No hay espacio para guardar" | `localStorage` lleno (~5 MB). Exporta un respaldo y elimina datos viejos. |
| Pantalla "No pudimos leer tus datos" | El texto guardado está dañado. Se conserva una copia; elige restaurar la copia automática, importar un respaldo o empezar de cero. |

## Cómo está hecha

```
index.html            estructura, política de seguridad (CSP) y carga de scripts
css/styles.css        tokens de diseño y componentes (claro/oscuro)
js/money.js           dinero en COP: parseo, formato, reparto exacto
js/dates.js           fechas "AAAA-MM-DD", periodos mensuales, fin de mes
js/validators.js      validaciones de formularios y del archivo a importar
js/domain.js          reglas de cálculo (sin DOM ni localStorage)
js/store.js           localStorage, migraciones, respaldo, importar/exportar
js/charts.js          gráficas en SVG propio
js/ui.js              componentes: hojas, formularios, avisos (sin innerHTML)
js/vistas.js          estructura de la app + Inicio, Movimientos, Reportes, Ajustes
js/planear.js         presupuestos, metas y recurrentes
js/deudas.js          deudas y cuotas, gastos compartidos
js/app.js             arranque, guardado y recuperación
tests/                pruebas con node:test (sin dependencias)
```

Decisiones de diseño relevantes:
- **Dinero siempre entero.** Nada de `float` para guardar montos; los repartos cuadran al peso.
- **Scripts clásicos, no módulos ES**, para que funcione con doble clic (`file://`). La lógica de `money`, `dates`, `validators`, `domain` y `store` también se carga en Node para probarla.
- **Gasto compartido:** solo *tu parte* cuenta como gasto tuyo; lo demás queda como saldo con cada persona. Liquidar no crea ingresos ni gastos.
- **Aportes a metas y pagos de deuda** son salidas de dinero, pero en los reportes se agrupan en las categorías *Ahorro* y *Deudas*.
- **Abono extra a una deuda** reduce el capital y acorta el plazo manteniendo la cuota.
- **Seguridad:** sin peticiones de red, CSP estricta, todo texto del usuario entra al DOM con `textContent`, importación con validación de esquema y descarte de claves peligrosas, CSV protegido contra inyección de fórmulas.

## Limitaciones conocidas

- Sin cifrado ni PIN.
- Un solo dispositivo: no hay sincronización entre celular y computador (usa exportar/importar).
- Sin notificaciones push; los avisos se muestran al abrir la app.
- Los recurrentes se registran al abrir la app (no en segundo plano).
- Edición de deudas: para cambiar el capital o el plazo hay que eliminar y volver a crear la deuda.
