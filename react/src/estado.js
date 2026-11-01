// Estado global de la app (fuera de React) + hooks. Reglas de negocio: js/domain.js y js/store.js (compartidas).
import { useSyncExternalStore } from 'react';
import { domain, dates, store as storeMod, fondo } from './lib.js';

let almacenamiento = null;
try { almacenamiento = window.localStorage; } catch { almacenamiento = null; }
export const almacen = storeMod.crearStore(almacenamiento);

export const ORDEN_VISTAS = ['inicio', 'movs', 'planear', 'deudas', 'reportes', 'ajustes'];

const S = {
  estado: null, aviso: '', bloqueado: false, sinAlmacenamiento: false, corrupto: null, toast: null,
  vista: 'inicio', dir: 1, sub: { planear: 'presupuestos', deudas: 'deudas' },
  mov: { q: '', tipo: 'todos', cat: 'todas', rango: 'mes', limite: 80 },
  rep: { clave: 'mes', desde: '', hasta: '' },
  v: 0
};
let snap = S;
const oyentes = new Set();

function emitir() {
  S.v += 1;
  snap = { ...S, sub: { ...S.sub }, mov: { ...S.mov }, rep: { ...S.rep } };
  oyentes.forEach((f) => f());
}
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const leer = () => snap;

export function useApp() {
  const s = useSyncExternalStore(suscribir, leer);
  return { ...s, hoy: dates.hoy() };
}
export const hoy = () => dates.hoy();
export const estadoActual = () => S.estado;

// ---------- navegación y filtros ----------
export function irA(vista, sub) {
  S.dir = ORDEN_VISTAS.indexOf(vista) >= ORDEN_VISTAS.indexOf(S.vista) ? 1 : -1;
  S.vista = vista;
  if (sub && vista === 'planear') S.sub.planear = sub;
  if (sub && vista === 'deudas') S.sub.deudas = sub;
  emitir();
  window.scrollTo(0, 0);
}
export function setSub(vista, valor) { S.sub[vista] = valor; emitir(); }
export function setMov(patch) { Object.assign(S.mov, patch); emitir(); }
export function setRep(patch) { Object.assign(S.rep, patch); emitir(); }

// ---------- avisos ----------
let temporizador = null;
export function toast(msg, o = {}) {
  clearTimeout(temporizador);
  S.toast = { id: Math.random(), msg, error: !!o.error, accion: o.accion || null };
  emitir();
  temporizador = setTimeout(quitarToast, o.ms || 6000);
}
export function quitarToast() {
  clearTimeout(temporizador);
  if (S.toast) { S.toast = null; emitir(); }
}

// ---------- archivos ----------
function descargarConEnlace(nombre, mime, texto) {
  const blob = new Blob([texto], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.hidden = true;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}

// Dentro del visor de claude.ai las descargas directas están bloqueadas: se usa su capacidad de guardado
export function descargar(nombre, mime, texto) {
  const cl = window.claude;
  if (!cl || !cl.use) { descargarConEnlace(nombre, mime, texto); return; }
  cl.use('downloads').then((d) => {
    if (!d) { descargarConEnlace(nombre, mime, texto); return; }
    return d.save({ filename: nombre, data: texto }).then(() => toast('Archivo guardado.'));
  }).catch((e) => {
    if (e && e.code === 'declined') return;
    toast('No se pudo guardar el archivo en esta vista.', { error: true });
  });
}

export function exportarRespaldo() {
  if (!S.estado) return;
  descargar('santisinplata-respaldo-' + hoy() + '.json', 'application/json', storeMod.exportarJSON(S.estado));
}

// ---------- tema ----------
export function aplicarTema(tema) {
  const r = document.documentElement;
  const visor = r.getAttribute('data-theme');
  if (visor === 'dark' || visor === 'light') tema = visor === 'dark' ? 'oscuro' : 'claro';
  if (tema === 'claro' || tema === 'oscuro') r.setAttribute('data-tema', tema); else r.removeAttribute('data-tema');
  const oscuro = tema === 'oscuro' || (tema !== 'claro' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', oscuro ? '#14091A' : '#9C297F');
}

// El visor de claude.ai fija su propio tema con data-theme: se respeta cuando aparece
(function seguirTemaDelVisor() {
  const r = document.documentElement;
  const sync = () => {
    const t = r.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') r.setAttribute('data-tema', t === 'dark' ? 'oscuro' : 'claro');
    else if (S.estado) aplicarTema(S.estado.ajustes.tema);
  };
  new MutationObserver(sync).observe(r, { attributes: true, attributeFilter: ['data-theme'] });
  if (r.getAttribute('data-theme')) sync();
})();

// ---------- guardado ----------
function guardar() {
  if (S.sinAlmacenamiento || S.bloqueado) return { ok: false, error: 'omitido' };
  const r = almacen.guardar(S.estado);
  if (!r.ok) {
    toast(r.error === 'cuota' ? 'No hay espacio para guardar. Exporta un respaldo y libera datos.' : 'No se pudo guardar en este navegador.',
      { error: true, ms: 10000, accion: { texto: 'Exportar', fn: exportarRespaldo } });
  }
  return r;
}

// Aplica un cambio: valida (el mutador lanza Error si algo no cuadra), guarda, pinta y ofrece deshacer.
export function commit(fn, op = {}) {
  const antes = JSON.stringify(S.estado);
  let r;
  try { r = fn(S.estado); }
  catch (e) {
    S.estado = JSON.parse(antes);
    emitir();
    toast((e && e.message) || 'No se pudo completar la acción.', { error: true });
    return false;
  }
  const g = guardar();
  emitir();
  if (op.mensaje && (g.ok || g.error === 'omitido')) {
    toast(op.mensaje, op.deshacer === false ? {} : {
      accion: { texto: 'Deshacer', fn: () => { S.estado = JSON.parse(antes); guardar(); emitir(); } }
    });
  }
  return r === undefined ? true : r;
}

function generarRecurrentes() {
  const n = domain.materializarRecurrentes(S.estado, hoy());
  if (n > 0) guardar();
  return n;
}

// Reemplaza todo el estado (importar, restaurar, ejemplo). Antes guarda una copia automática.
export function reemplazar(nuevo, mensaje) {
  if (!S.sinAlmacenamiento && !S.bloqueado && S.estado) almacen.respaldar(S.estado);
  S.estado = domain.asegurarSistema(nuevo);
  generarRecurrentes();
  guardar();
  aplicarTema(S.estado.ajustes.tema);
  irA('inicio');
  if (mensaje) toast(mensaje);
}

export function borrarTodo() {
  almacen.borrarTodo();
  fondo.quitar();
  fondo.aplicar(null);
  S.estado = domain.estadoVacio();
  guardar();
  aplicarTema('auto');
  irA('inicio');
  toast('Se borraron todos los datos.');
}

// Datos ilegibles: se resuelven desde la pantalla de recuperación
export function resolverCorrupto(estado, mensaje) {
  S.bloqueado = false;
  S.corrupto = null;
  S.estado = domain.asegurarSistema(estado);
  generarRecurrentes();
  guardar();
  aplicarTema(S.estado.ajustes.tema);
  irA('inicio');
  if (mensaje) toast(mensaje);
}

export function iniciar() {
  fondo.aplicar(fondo.cargar());
  const r = almacen.cargar();
  if (r.status === 'corrupto') {
    S.estado = domain.estadoVacio();
    S.bloqueado = true;
    S.corrupto = { errores: r.errores || [] };
    emitir();
    return;
  }
  S.estado = domain.asegurarSistema(r.estado);
  if (r.status === 'sin-almacenamiento') {
    S.sinAlmacenamiento = true;
    S.aviso = 'Este navegador no permite guardar datos (¿modo privado?). Lo que registres se perderá al cerrar.';
  }
  aplicarTema(S.estado.ajustes.tema);
  generarRecurrentes();
  if (r.status === 'nuevo') guardar();
  emitir();
}

// Al volver a la app (otro día, otra pestaña) se generan los recurrentes que falten
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S.estado || S.bloqueado) return;
  generarRecurrentes();
  emitir();
});
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', () => { if (S.estado) aplicarTema(S.estado.ajustes.tema); });
}
