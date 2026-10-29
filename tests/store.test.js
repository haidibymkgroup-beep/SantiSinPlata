'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../js/store.js');
const domain = require('../js/domain.js');

const HOY = '2026-03-14';

function falsoStorage(opts) {
  const m = new Map();
  opts = opts || {};
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (opts.sinEspacio && !k.endsWith('probe')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
      if (opts.prohibido) throw new Error('SecurityError');
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); }
  };
}

test('primer arranque: estado nuevo con categorías por defecto', () => {
  const s = store.crearStore(falsoStorage());
  const r = s.cargar();
  assert.equal(r.status, 'nuevo');
  assert.equal(r.estado.version, 1);
  assert.ok(r.estado.categorias.some((c) => c.nombre === 'Mercado'));
  assert.ok(r.estado.categorias.some((c) => c.id === 'cat_ahorro' && c.sistema));
});

test('guardar y leer devuelve lo mismo', () => {
  const st = falsoStorage();
  const s = store.crearStore(st);
  const e = domain.datosEjemplo(HOY, '2026-03-14T12:00:00.000Z');
  assert.equal(s.guardar(e).ok, true);
  const r = store.crearStore(st).cargar();
  assert.equal(r.status, 'ok');
  assert.equal(r.estado.transacciones.length, e.transacciones.length);
  assert.deepEqual(r.estado.deudas, e.deudas);
  assert.deepEqual(r.estado.personas, e.personas);
  assert.ok(s.bytesUsados() > 1000);
});

test('JSON corrupto: no se sobrescribe, se guarda una copia y se avisa', () => {
  const st = falsoStorage();
  st.setItem(store.KEY, '{"version":1,"transacciones":[');
  const s = store.crearStore(st);
  const r = s.cargar();
  assert.equal(r.status, 'corrupto');
  assert.equal(r.estado, null);
  assert.equal(st.getItem(store.KEY), '{"version":1,"transacciones":[', 'el original sigue intacto');
  const copias = [...st.m.keys()].filter((k) => k.startsWith('santisinplata:corrupto:'));
  assert.equal(copias.length, 1);
  assert.equal(st.getItem(copias[0]), '{"version":1,"transacciones":[');
});

test('estado con estructura inválida también se trata como corrupto', () => {
  const st = falsoStorage();
  const e = domain.estadoVacio();
  e.transacciones.push({ id: 'tx_1', tipo: 'gasto', monto: -5, fecha: '2026-03-01', categoriaId: 'cat_mercado' });
  st.setItem(store.KEY, JSON.stringify(e));
  assert.equal(store.crearStore(st).cargar().status, 'corrupto');
});

test('respaldo: se guarda y se restaura', () => {
  const st = falsoStorage();
  const s = store.crearStore(st);
  assert.equal(s.leerRespaldo(), null);
  const e = domain.datosEjemplo(HOY, '2026-03-14T12:00:00.000Z');
  s.respaldar(e);
  const r = s.leerRespaldo();
  assert.equal(r.transacciones.length, e.transacciones.length);
});

test('cuota llena: guardar informa el error sin lanzar', () => {
  const st = falsoStorage();
  const s = store.crearStore(st);
  st.setItem = () => { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; };
  const r = s.guardar(domain.estadoVacio());
  assert.deepEqual(r, { ok: false, error: 'cuota' });
});

test('sin almacenamiento disponible (modo privado) la app sigue funcionando en memoria', () => {
  const r = store.crearStore(falsoStorage({ prohibido: true })).cargar();
  assert.equal(r.status, 'sin-almacenamiento');
  assert.ok(r.estado);
  assert.equal(store.crearStore(null).cargar().status, 'sin-almacenamiento');
});

test('migrar: rechaza versiones futuras o sin versión', () => {
  assert.equal(store.migrar({ version: 99 }).ok, false);
  assert.equal(store.migrar({}).ok, false);
  assert.equal(store.migrar(null).ok, false);
  assert.equal(store.migrar(domain.estadoVacio()).ok, true);
});

test('exportar JSON → importar JSON restaura idéntico', () => {
  const e = domain.datosEjemplo(HOY, '2026-03-14T12:00:00.000Z');
  const texto = store.exportarJSON(e);
  const r = store.importarJSON(texto);
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.deepEqual(r.estado, JSON.parse(texto));
  assert.equal(r.resumen.movimientos, e.transacciones.length);
  assert.equal(r.resumen.deudas, 2);
});

test('importación maliciosa o inválida se rechaza', () => {
  const base = () => JSON.parse(store.exportarJSON(domain.estadoVacio()));
  const malos = [];
  malos.push('no es json');
  malos.push('[]');
  malos.push('null');
  malos.push('{"version":1,"__proto__":{"polluted":true}}');
  malos.push('{"version":1,"ajustes":{"constructor":{"prototype":{"x":1}}}}');
  let e = base(); e.transacciones = [{ id: 'tx_1', tipo: 'gasto', monto: '25000', fecha: '2026-03-01', categoriaId: 'cat_mercado' }]; malos.push(JSON.stringify(e));
  e = base(); e.transacciones = [{ id: 'tx_1', tipo: 'gasto', monto: 1000, fecha: '2026-03-01', categoriaId: 'inexistente' }]; malos.push(JSON.stringify(e));
  e = base(); e.transacciones = [{ id: 'tx_1', tipo: 'gasto', monto: 1000, fecha: '2026-02-31', categoriaId: 'cat_mercado' }]; malos.push(JSON.stringify(e));
  e = base(); e.transacciones = [{ id: 'a b', tipo: 'gasto', monto: 1000, fecha: '2026-03-01', categoriaId: 'cat_mercado' }]; malos.push(JSON.stringify(e));
  const tx = { id: 'tx_1', tipo: 'gasto', monto: 1000, fecha: '2026-03-01', categoriaId: 'cat_mercado' };
  e = base(); e.transacciones = [tx, tx]; malos.push(JSON.stringify(e));
  e = base(); e.version = 2; malos.push(JSON.stringify(e));
  e = base(); e.compartidos = [{ id: 'co_1', descripcion: 'x', fecha: '2026-03-01', total: 100, categoriaId: 'cat_comida', pagadoPor: 'yo', participantes: [{ personaId: 'yo', parte: 10 }, { personaId: 'pe_x', parte: 90 }] }]; malos.push(JSON.stringify(e));
  e = base(); e.metas = [{ id: 'me_1', nombre: 'x', objetivo: 100, aportes: [{ id: 'ap_1', monto: 10, fecha: '2026-03-01', txId: 'tx_zzz' }] }]; malos.push(JSON.stringify(e));
  e = base(); e.transacciones = [{ id: 'tx_1', tipo: 'gasto', monto: 1000, fecha: '2026-03-01', categoriaId: 'cat_mercado', nota: 'x'.repeat(500) }]; malos.push(JSON.stringify(e));
  malos.forEach((t, i) => {
    const r = store.importarJSON(t);
    assert.equal(r.ok, false, 'caso ' + i + ' debería rechazarse');
    assert.ok(r.errores.length > 0);
  });
  assert.equal(({}).polluted, undefined);
  assert.equal(store.importarJSON('x'.repeat(store.MAX_IMPORT + 1)).ok, false);
  assert.equal(store.importarJSON(123).ok, false);
});

test('importar descarta claves desconocidas y completa valores por defecto', () => {
  const e = JSON.parse(store.exportarJSON(domain.estadoVacio()));
  e.clavePirata = 'x';
  e.ajustes.otra = 1;
  delete e.ajustes.tema;
  const r = store.importarJSON(JSON.stringify(e));
  assert.equal(r.ok, true);
  assert.equal(r.estado.clavePirata, undefined);
  assert.equal(r.estado.ajustes.otra, undefined);
  assert.equal(r.estado.ajustes.tema, 'auto');
});

test('CSV: neutraliza inyección de fórmulas, escapa comillas y comas, incluye BOM', () => {
  const e = domain.estadoVacio();
  domain.crearTx(e, { tipo: 'gasto', monto: 5000, fecha: '2026-03-02', categoriaId: 'cat_mercado', nota: '=cmd|\' /C calc\'!A0' });
  domain.crearTx(e, { tipo: 'gasto', monto: 6000, fecha: '2026-03-03', categoriaId: 'cat_mercado', nota: '+SUMA(1;1)' });
  domain.crearTx(e, { tipo: 'gasto', monto: 7000, fecha: '2026-03-04', categoriaId: 'cat_mercado', nota: '@usuario' });
  domain.crearTx(e, { tipo: 'gasto', monto: 8000, fecha: '2026-03-05', categoriaId: 'cat_mercado', nota: '-1+1' });
  domain.crearTx(e, { tipo: 'gasto', monto: 9000, fecha: '2026-03-06', categoriaId: 'cat_mercado', nota: 'pan, "integral"' });
  const csv = store.exportarCSV(e);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const lineas = csv.slice(1).trim().split('\r\n');
  assert.equal(lineas[0], 'Fecha,Tipo,Categoría,Monto,Nota,Origen');
  assert.ok(lineas[1].includes(",'=cmd|"), lineas[1]);
  assert.ok(lineas[2].includes(",'+SUMA(1;1),"));
  assert.ok(lineas[3].includes(",'@usuario,"));
  assert.ok(lineas[4].includes(",'-1+1,"));
  assert.ok(lineas[5].includes('"pan, ""integral"""'));
  assert.equal(store.csvCelda('normal'), 'normal');
  assert.equal(store.csvCelda('\tx'), "'\tx");
  assert.equal(store.csvCelda(null), '');
});
