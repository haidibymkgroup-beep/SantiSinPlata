'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../js/domain.js');
const validators = require('../js/validators.js');
const money = require('../js/money.js');

const HOY = '2026-03-14';
const nuevo = () => domain.estadoVacio('2026-03-14T12:00:00.000Z');
const gasto = (e, monto, fecha, cat, extra) => domain.crearTx(e, Object.assign({ tipo: 'gasto', monto, fecha, categoriaId: cat || 'cat_mercado', nota: 'x' }, extra));
const ingreso = (e, monto, fecha) => domain.crearTx(e, { tipo: 'ingreso', monto, fecha, categoriaId: 'cat_salario', nota: 'Salario' });

// ---------- resumen ----------
test('resumen: balance, tasa de ahorro, promedio y proyección', () => {
  const e = nuevo();
  ingreso(e, 3000000, '2026-03-01');
  gasto(e, 700000, '2026-03-05');
  gasto(e, 700000, '2026-03-10');
  gasto(e, 999, '2026-02-28'); // fuera del periodo
  const r = domain.resumen(e, HOY);
  assert.equal(r.ingresos, 3000000);
  assert.equal(r.gastos, 1400000);
  assert.equal(r.balance, 1600000);
  assert.equal(r.tasaAhorro, 1600000 / 3000000);
  assert.equal(r.diasTranscurridos, 14);
  assert.equal(r.diasPeriodo, 31);
  assert.equal(r.gastoDiarioPromedio, 100000);
  assert.equal(r.proyeccionFinDeMes, 3100000);
  assert.equal(r.diasRestantes, 18);
  assert.equal(r.comprometido, 0);
  assert.equal(r.disponibleDiario, Math.round(1600000 / 18));
});

test('resumen: tasa de ahorro nula cuando no hay ingresos y sin movimientos no rompe', () => {
  const e = nuevo();
  gasto(e, 50000, '2026-03-03');
  const r = domain.resumen(e, HOY);
  assert.equal(r.tasaAhorro, null);
  assert.equal(r.balance, -50000);
  assert.equal(r.disponibleDiario, 0);
  const v = domain.resumen(nuevo(), HOY);
  assert.equal(v.gastos, 0);
  assert.equal(v.proyeccionFinDeMes, 0);
});

test('resumen: último día del periodo cuenta 1 día restante', () => {
  const e = nuevo();
  ingreso(e, 100000, '2026-03-01');
  const r = domain.resumen(e, '2026-03-31');
  assert.equal(r.diasRestantes, 1);
  assert.equal(r.disponibleDiario, 100000);
});

test('resumen: lo comprometido (recurrentes y cuotas) reduce el disponible diario', () => {
  const e = nuevo();
  ingreso(e, 2000000, '2026-03-01');
  domain.crearRecurrente(e, { tipo: 'gasto', monto: 300000, categoriaId: 'cat_vivienda', nota: 'Arriendo', frecuencia: 'mensual', diaDelMes: 28, diaSemana: null, inicio: '2026-01-28' });
  const r = domain.resumen(e, HOY);
  assert.equal(r.comprometido, 300000);
  assert.equal(r.disponibleDiario, Math.round((2000000 - 300000) / 18));
});

// ---------- presupuestos ----------
test('presupuestos: estados en los umbrales exactos', () => {
  const casos = [[790, 'ok'], [799, 'ok'], [800, 'atencion'], [1000, 'atencion'], [1001, 'excedido'], [1010, 'excedido']];
  casos.forEach(([gastado, esperado]) => {
    const e = nuevo();
    domain.crearPresupuesto(e, { categoriaId: 'cat_mercado', limiteMensual: 1000, alertaPct: 80 });
    gasto(e, gastado, '2026-03-05');
    const s = domain.estadoPresupuestos(e, HOY)[0];
    assert.equal(s.estado, esperado, gastado + ' de 1000');
    assert.equal(s.restante, 1000 - gastado);
  });
});

test('presupuesto total suma todos los gastos; el de categoría solo los suyos (con Ahorro y Deudas agrupados)', () => {
  const e = nuevo();
  domain.crearPresupuesto(e, { categoriaId: null, limiteMensual: 1000000, alertaPct: 80 });
  domain.crearPresupuesto(e, { categoriaId: 'cat_ahorro', limiteMensual: 500000, alertaPct: 80 });
  gasto(e, 100000, '2026-03-05', 'cat_mercado');
  gasto(e, 50000, '2026-03-06', 'cat_ocio');
  const meta = domain.crearMeta(e, { nombre: 'Viaje', objetivo: 1000000 });
  domain.agregarAporte(e, meta.id, { monto: 200000, fecha: '2026-03-07' });
  const [total, ahorro] = domain.estadoPresupuestos(e, HOY);
  assert.equal(total.gastado, 350000);
  assert.equal(ahorro.gastado, 200000);
});

test('presupuesto: aviso de ritmo cuando se gasta más rápido de lo planeado', () => {
  const e = nuevo();
  domain.crearPresupuesto(e, { categoriaId: 'cat_mercado', limiteMensual: 310000, alertaPct: 90 });
  gasto(e, 200000, '2026-03-02'); // 14 días: ritmo = 140000 → 200000 > 161000
  const s = domain.estadoPresupuestos(e, HOY)[0];
  assert.equal(s.ritmoEsperado, 140000);
  assert.equal(s.estado, 'ok');
  assert.equal(s.rapido, true);
});

// ---------- metas ----------
test('meta: aporte sugerido, vencida y completada', () => {
  const e = nuevo();
  const m = domain.crearMeta(e, { nombre: 'Viaje', objetivo: 3000000, fechaLimite: '2026-12-01' });
  domain.agregarAporte(e, m.id, { monto: 600000, fecha: '2026-03-01' });
  let s = domain.estadoMeta(m, HOY);
  assert.equal(s.ahorrado, 600000);
  assert.equal(s.faltante, 2400000);
  assert.equal(s.mesesRestantes, 8);
  assert.equal(s.sugeridoMensual, 300000);
  assert.equal(s.estado, 'en-curso');
  assert.equal(s.pct, 0.2);

  m.fechaLimite = '2026-03-01';
  assert.equal(domain.estadoMeta(m, HOY).estado, 'atrasada');

  domain.agregarAporte(e, m.id, { monto: 2400000, fecha: '2026-03-10' });
  s = domain.estadoMeta(m, HOY);
  assert.equal(s.estado, 'completada');
  assert.equal(s.pct, 1);
  assert.equal(s.sugeridoMensual, null);
  assert.equal(m.completada, true);
});

test('meta: sugerido con menos de un mes restante usa 1 mes; sin fecha límite no hay sugerido', () => {
  const m = { aportes: [], objetivo: 100001, fechaLimite: '2026-03-20' };
  const s = domain.estadoMeta(m, HOY);
  assert.equal(s.mesesRestantes, 1);
  assert.equal(s.sugeridoMensual, 100001);
  assert.equal(domain.estadoMeta({ aportes: [], objetivo: 5, fechaLimite: null }, HOY).sugeridoMensual, null);
});

test('meta: quitar un aporte elimina también su movimiento', () => {
  const e = nuevo();
  const m = domain.crearMeta(e, { nombre: 'Moto', objetivo: 1000 });
  const a = domain.agregarAporte(e, m.id, { monto: 1000, fecha: HOY });
  assert.equal(e.transacciones.length, 1);
  assert.equal(e.transacciones[0].origen, 'meta');
  assert.equal(m.completada, true);
  assert.equal(domain.quitarAporte(e, m.id, a.id), true);
  assert.equal(e.transacciones.length, 0);
  assert.equal(m.aportes.length, 0);
  assert.equal(m.completada, false);
});

test('eliminar el movimiento de un aporte, pago o compartido elimina su origen', () => {
  const e = nuevo();
  const m = domain.crearMeta(e, { nombre: 'Moto', objetivo: 1000 });
  const a = domain.agregarAporte(e, m.id, { monto: 500, fecha: HOY });
  assert.ok(domain.eliminarTx(e, a.txId));
  assert.equal(m.aportes.length, 0);

  const d = domain.crearDeuda(e, { nombre: 'X', tipo: 'libre', capitalInicial: 1000, tasaMensualPct: 0, numCuotas: 0, primeraCuota: null, diaPago: null });
  const p = domain.registrarPago(e, d.id, { monto: 400, fecha: HOY, tipo: 'cuota' });
  assert.equal(domain.estadoDeuda(d, HOY).saldo, 600);
  domain.eliminarTx(e, p.txId);
  assert.equal(domain.estadoDeuda(d, HOY).saldo, 1000);

  const ana = domain.crearPersona(e, { nombre: 'Ana' });
  const co = domain.crearCompartido(e, { descripcion: 'Cena', fecha: HOY, total: 100, categoriaId: 'cat_comida', pagadoPor: 'yo', participantes: [{ personaId: 'yo', parte: 50 }, { personaId: ana.id, parte: 50 }] });
  domain.eliminarTx(e, co.txId);
  assert.equal(e.compartidos.length, 0);
  assert.equal(domain.eliminarTx(e, 'no-existe'), null);
});

// ---------- recurrentes ----------
const regla = (extra) => Object.assign({
  id: 're_1', tipo: 'gasto', monto: 45000, categoriaId: 'cat_suscripciones', nota: 'Netflix', frecuencia: 'mensual',
  diaDelMes: 5, diaSemana: null, inicio: '2026-01-05', fin: null, ultimaGeneracion: null, activa: true
}, extra);

test('recurrente mensual día 31 cae en el último día de cada mes', () => {
  const r = regla({ diaDelMes: 31, inicio: '2026-01-01' });
  assert.deepEqual(domain.fechasEntre(r, '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(domain.fechasEntre(regla({ diaDelMes: 30, inicio: '2024-01-01' }), '2024-02-01', '2024-02-29'), ['2024-02-29']);
});

test('recurrentes: quincenal, semanal y anual (29-feb)', () => {
  const q = regla({ frecuencia: 'quincenal', diaDelMes: null, inicio: '2026-01-01' });
  assert.deepEqual(domain.fechasEntre(q, '2026-02-01', '2026-03-10'), ['2026-02-15', '2026-02-28']);
  assert.deepEqual(domain.fechasEntre(q, '2026-03-01', '2026-03-31'), ['2026-03-15', '2026-03-31']);
  const s = regla({ frecuencia: 'semanal', diaDelMes: null, diaSemana: 1, inicio: '2026-03-02' });
  assert.deepEqual(domain.fechasEntre(s, '2026-03-01', HOY), ['2026-03-02', '2026-03-09']);
  const a = regla({ frecuencia: 'anual', diaDelMes: null, inicio: '2024-02-29' });
  assert.deepEqual(domain.fechasEntre(a, '2024-01-01', '2026-12-31'), ['2024-02-29', '2025-02-28', '2026-02-28']);
});

test('recurrentes: respetan inicio y fin', () => {
  const r = regla({ inicio: '2026-02-10', fin: '2026-03-31' });
  assert.deepEqual(domain.fechasEntre(r, '2026-01-01', '2026-12-31'), ['2026-03-05']);
});

test('materializar es idempotente: abrir la app varias veces no duplica', () => {
  const e = nuevo();
  domain.crearRecurrente(e, { tipo: 'gasto', monto: 45000, categoriaId: 'cat_suscripciones', nota: 'Netflix', frecuencia: 'mensual', diaDelMes: 5, diaSemana: null, inicio: '2026-01-05' });
  assert.equal(domain.materializarRecurrentes(e, HOY), 3); // ene, feb, mar
  for (let i = 0; i < 10; i++) assert.equal(domain.materializarRecurrentes(e, HOY), 0);
  assert.equal(e.transacciones.length, 3);
  assert.equal(e.recurrentes[0].ultimaGeneracion, '2026-03-05');
  assert.ok(e.transacciones.every((t) => t.origen === 'recurrente' && t.origenId === e.recurrentes[0].id));
});

test('app cerrada 3 meses genera 3 ocurrencias', () => {
  const e = nuevo();
  e.recurrentes.push(regla({ ultimaGeneracion: '2026-01-05' }));
  assert.equal(domain.materializarRecurrentes(e, '2026-04-10'), 3);
  assert.deepEqual(e.transacciones.map((t) => t.fecha), ['2026-02-05', '2026-03-05', '2026-04-05']);
});

test('regla pausada no genera; reanudar no genera retroactivo; eliminar conserva lo creado', () => {
  const e = nuevo();
  e.recurrentes.push(regla({ activa: false }));
  assert.equal(domain.materializarRecurrentes(e, HOY), 0);
  domain.alternarRecurrente(e, 're_1', HOY);
  assert.equal(e.recurrentes[0].activa, true);
  assert.equal(domain.materializarRecurrentes(e, HOY), 0);
  e.recurrentes[0].ultimaGeneracion = null;
  e.recurrentes[0].inicio = '2026-02-05';
  domain.materializarRecurrentes(e, HOY);
  assert.equal(e.transacciones.length, 2);
  e.recurrentes = [];
  assert.equal(e.transacciones.length, 2);
});

test('tope de seguridad: 366 ocurrencias por ejecución y luego continúa', () => {
  const e = nuevo();
  e.recurrentes.push(regla({ frecuencia: 'semanal', diaDelMes: null, diaSemana: 1, inicio: '2018-01-01' }));
  assert.equal(domain.materializarRecurrentes(e, HOY), 366);
  assert.ok(domain.materializarRecurrentes(e, HOY) > 0);
});

test('próxima ocurrencia', () => {
  assert.equal(domain.proximaOcurrencia(regla(), HOY), '2026-04-05');
  assert.equal(domain.proximaOcurrencia(regla({ fin: '2026-03-31' }), HOY), null);
});

// ---------- deudas ----------
test('cuota francesa: $6.000.000 al 1,8 % mensual en 24 cuotas', () => {
  const cuota = domain.cuotaFrancesa(6000000, 1.8, 24);
  // Verificación independiente: valor presente de las 24 cuotas = capital
  const i = 0.018;
  let vp = 0;
  for (let k = 1; k <= 24; k++) vp += cuota / Math.pow(1 + i, k);
  assert.ok(Math.abs(vp - 6000000) < 50, 'VP=' + vp);
  assert.ok(cuota > 310000 && cuota < 311000, 'cuota=' + cuota);
});

test('tabla de amortización cierra en saldo exactamente 0', () => {
  const t = domain.tablaAmortizacion(6000000, 1.8, 24);
  assert.equal(t.length, 24);
  assert.equal(t[0].interes, 108000);
  assert.equal(t[t.length - 1].saldo, 0);
  assert.equal(money.suma(t.map((f) => f.capital)), 6000000);
  t.forEach((f) => assert.equal(f.cuota, f.interes + f.capital));
  const base = t[0].cuota;
  t.slice(0, -1).forEach((f) => assert.equal(f.cuota, base));
  assert.ok(Math.abs(t[23].cuota - base) < 30, 'la última cuota solo ajusta unos pesos');
});

test('deuda sin interés: cuotas iguales y reparto exacto', () => {
  const t = domain.tablaAmortizacion(1200000, 0, 6);
  assert.equal(t.length, 6);
  t.forEach((f) => { assert.equal(f.interes, 0); assert.equal(f.cuota, 200000); });
  const u = domain.tablaAmortizacion(1000000, 0, 3);
  assert.equal(u[2].saldo, 0);
  assert.equal(money.suma(u.map((f) => f.cuota)), 1000000);
});

const deudaMoto = (e) => domain.crearDeuda(e, { nombre: 'Moto', acreedor: 'Banco', tipo: 'cuotas', capitalInicial: 6000000, tasaMensualPct: 1.8, numCuotas: 24, valorCuota: 0, primeraCuota: '2026-01-10', diaPago: 10 });

test('pagar todas las cuotas deja el saldo en 0', () => {
  const e = nuevo();
  const d = deudaMoto(e);
  let guard = 0;
  while (guard++ < 40) {
    const s = domain.estadoDeuda(d, HOY);
    if (!s.proxima) break;
    domain.registrarPago(e, d.id, { monto: s.proxima.cuota, fecha: s.proxima.fecha, tipo: 'cuota' });
  }
  const f = domain.estadoDeuda(d, HOY);
  assert.equal(f.saldo, 0);
  assert.equal(f.saldada, true);
  assert.equal(f.cuotasPagadas, 24);
  assert.equal(d.pagos.length, 24);
});

test('estado de deuda: próxima cuota, vencida y avance', () => {
  const e = nuevo();
  const d = deudaMoto(e);
  const s0 = domain.estadoDeuda(d, HOY);
  assert.equal(s0.proxima.fecha, '2026-01-10');
  assert.equal(s0.vencida, true);
  domain.registrarPago(e, d.id, { monto: s0.proxima.cuota, fecha: '2026-01-10', tipo: 'cuota' });
  domain.registrarPago(e, d.id, { monto: domain.estadoDeuda(d, HOY).proxima.cuota, fecha: '2026-02-10', tipo: 'cuota' });
  domain.registrarPago(e, d.id, { monto: domain.estadoDeuda(d, HOY).proxima.cuota, fecha: '2026-03-10', tipo: 'cuota' });
  const s = domain.estadoDeuda(d, HOY);
  assert.equal(s.cuotasPagadas, 3);
  assert.equal(s.proxima.n, 4);
  assert.equal(s.proxima.fecha, '2026-04-10');
  assert.equal(s.vencida, false);
  assert.equal(s.cuotasTotales, 24);
  assert.ok(s.saldo < 6000000 && s.saldo > 5300000);
  assert.equal(e.transacciones.filter((t) => t.origen === 'cuota').length, 3);
  assert.ok(e.transacciones.every((t) => t.categoriaId === 'cat_deudas'));
});

test('abono extra reduce capital y acorta el plan', () => {
  const e = nuevo();
  const d = deudaMoto(e);
  const antes = domain.estadoDeuda(d, HOY);
  domain.registrarPago(e, d.id, { monto: 1000000, fecha: HOY, tipo: 'extra' });
  const desp = domain.estadoDeuda(d, HOY);
  assert.equal(desp.saldo, 5000000);
  assert.equal(desp.cuotasPagadas, 0);
  assert.ok(desp.cuotasRestantes < antes.cuotasRestantes);
  assert.equal(desp.plan[desp.plan.length - 1].saldo, 0);
});

test('un pago mayor al saldo más interés se rechaza', () => {
  const e = nuevo();
  const d = deudaMoto(e);
  const s = domain.estadoDeuda(d, HOY);
  assert.equal(s.maxPagoCuota, 6000000 + 108000);
  assert.throws(() => domain.registrarPago(e, d.id, { monto: s.maxPagoCuota + 1, fecha: HOY, tipo: 'cuota' }));
  assert.throws(() => domain.registrarPago(e, d.id, { monto: 6000001, fecha: HOY, tipo: 'extra' }));
  domain.registrarPago(e, d.id, { monto: s.maxPagoCuota, fecha: HOY, tipo: 'cuota' });
  assert.equal(domain.estadoDeuda(d, HOY).saldo, 0);
  assert.equal(e.transacciones.length, 1);
});

test('cuota fija elegida por el usuario se respeta y acorta el plazo', () => {
  const t = domain.estadoDeuda({
    tipo: 'cuotas', capitalInicial: 1000000, tasaMensualPct: 2, numCuotas: 24, valorCuota: 200000,
    primeraCuota: '2026-04-01', diaPago: 1, pagos: []
  }, HOY);
  assert.equal(t.plan[0].cuota, 200000);
  assert.ok(t.plan.length < 24);
  assert.equal(t.plan[t.plan.length - 1].saldo, 0);
});

test('deuda libre: cada pago reduce el saldo; resumen de deudas', () => {
  const e = nuevo();
  const d = domain.crearDeuda(e, { nombre: 'Préstamo a papá', tipo: 'libre', capitalInicial: 500000, tasaMensualPct: 0, numCuotas: 0, primeraCuota: null, diaPago: null });
  domain.registrarPago(e, d.id, { monto: 200000, fecha: '2026-03-05', tipo: 'cuota' });
  const s = domain.estadoDeuda(d, HOY);
  assert.equal(s.saldo, 300000);
  assert.equal(s.proxima, null);
  const r = domain.resumenDeudas(e, HOY);
  assert.equal(r.deudaTotal, 300000);
  assert.equal(r.pagosDelMes, 200000);
  assert.throws(() => domain.registrarPago(e, d.id, { monto: 300001, fecha: HOY, tipo: 'cuota' }));
});

// ---------- compartidos ----------
test('compartido: división igual con resto y saldos entre varias personas', () => {
  const e = nuevo();
  const ana = domain.crearPersona(e, { nombre: 'Ana' });
  const cam = domain.crearPersona(e, { nombre: 'Camilo' });
  const ids = ['yo', ana.id, cam.id];
  const partes = domain.dividir('igual', 100000, ids, null);
  assert.deepEqual(partes, [33334, 33333, 33333]);
  const dat = { descripcion: 'Cena', fecha: HOY, total: 100000, categoriaId: 'cat_comida', pagadoPor: 'yo', participantes: ids.map((id, i) => ({ personaId: id, parte: partes[i] })) };
  assert.equal(validators.validarCompartido(dat, { hoy: HOY, estado: e }).ok, true);
  const co = domain.crearCompartido(e, dat);
  assert.equal(e.transacciones.length, 1, 'solo mi parte como gasto');
  assert.equal(e.transacciones[0].monto, 33334);
  assert.equal(e.transacciones[0].origen, 'compartido');
  assert.equal(co.txId, e.transacciones[0].id);
  assert.equal(domain.saldoPersona(e, ana.id), 33333);
  assert.equal(domain.saldoPersona(e, cam.id), 33333);

  // Ana pagó un taxi y lo dividimos entre ella y yo
  domain.crearCompartido(e, { descripcion: 'Taxi', fecha: HOY, total: 90000, categoriaId: 'cat_transporte', pagadoPor: ana.id, participantes: [{ personaId: 'yo', parte: 45000 }, { personaId: ana.id, parte: 45000 }] });
  assert.equal(domain.saldoPersona(e, ana.id), 33333 - 45000);
  assert.equal(domain.saldoPersona(e, cam.id), 33333);
  assert.equal(e.transacciones.length, 2, 'mi parte del taxi también es gasto mío');
});

test('compartido: porcentajes y montos exactos', () => {
  assert.deepEqual(domain.dividir('porcentaje', 100000, ['a', 'b'], [70, 30]), [70000, 30000]);
  assert.equal(money.suma(domain.dividir('porcentaje', 100001, ['a', 'b', 'c'], [33.33, 33.33, 33.34])), 100001);
  assert.throws(() => domain.dividir('porcentaje', 1000, ['a', 'b'], [60, 30]));
  assert.deepEqual(domain.dividir('exacto', 1000, ['a', 'b'], [400, 600]), [400, 600]);
  const e = nuevo();
  const ana = domain.crearPersona(e, { nombre: 'Ana' });
  const mal = { descripcion: 'x', fecha: HOY, total: 1000, categoriaId: 'cat_comida', pagadoPor: 'yo', participantes: [{ personaId: 'yo', parte: 400 }, { personaId: ana.id, parte: 500 }] };
  assert.ok(validators.validarCompartido(mal, { hoy: HOY, estado: e }).errores.partes);
});

test('liquidar mueve el saldo sin crear ingresos ni gastos', () => {
  const e = nuevo();
  const ana = domain.crearPersona(e, { nombre: 'Ana' });
  domain.crearCompartido(e, { descripcion: 'Cena', fecha: HOY, total: 100000, categoriaId: 'cat_comida', pagadoPor: 'yo', participantes: [{ personaId: 'yo', parte: 50000 }, { personaId: ana.id, parte: 50000 }] });
  const txs = e.transacciones.length;
  domain.liquidar(e, ana.id, { monto: 20000, fecha: HOY });
  assert.equal(domain.saldoPersona(e, ana.id), 30000);
  assert.equal(e.liquidaciones[0].sentido, 'me_pagan');
  assert.throws(() => domain.liquidar(e, ana.id, { monto: 30001, fecha: HOY }));
  domain.liquidar(e, ana.id, { monto: 30000, fecha: HOY });
  assert.equal(domain.saldoPersona(e, ana.id), 0);
  assert.equal(e.transacciones.length, txs);
  assert.throws(() => domain.liquidar(e, ana.id, { monto: 1, fecha: HOY }));
});

test('liquidar cuando yo debo: sentido le_pago', () => {
  const e = nuevo();
  const ana = domain.crearPersona(e, { nombre: 'Ana' });
  domain.crearCompartido(e, { descripcion: 'Taxi', fecha: HOY, total: 90000, categoriaId: 'cat_transporte', pagadoPor: ana.id, participantes: [{ personaId: 'yo', parte: 45000 }, { personaId: ana.id, parte: 45000 }] });
  assert.equal(domain.saldoPersona(e, ana.id), -45000);
  domain.liquidar(e, ana.id, { monto: 45000, fecha: HOY });
  assert.equal(e.liquidaciones[0].sentido, 'le_pago');
  assert.equal(domain.saldoPersona(e, ana.id), 0);
});

test('no se elimina una persona con saldo ni con historial', () => {
  const e = nuevo();
  const ana = domain.crearPersona(e, { nombre: 'Ana' });
  const sola = domain.crearPersona(e, { nombre: 'Luis' });
  const co = domain.crearCompartido(e, { descripcion: 'Cena', fecha: HOY, total: 100, categoriaId: 'cat_comida', pagadoPor: 'yo', participantes: [{ personaId: 'yo', parte: 50 }, { personaId: ana.id, parte: 50 }] });
  assert.deepEqual(domain.eliminarPersona(e, ana.id), { ok: false, error: 'saldo' });
  domain.liquidar(e, ana.id, { monto: 50, fecha: HOY });
  assert.deepEqual(domain.eliminarPersona(e, ana.id), { ok: false, error: 'historial' });
  assert.deepEqual(domain.eliminarPersona(e, sola.id), { ok: true });
  assert.ok(co);
});

// ---------- reportes ----------
test('reportes por categoría, top, comparativo y acumulado', () => {
  const e = nuevo();
  gasto(e, 300000, '2026-03-02', 'cat_mercado');
  gasto(e, 100000, '2026-03-03', 'cat_ocio');
  gasto(e, 200000, '2026-02-10', 'cat_mercado');
  gasto(e, 50000, '2026-02-11', 'cat_ropa');
  const cats = domain.gastosPorCategoria(e, '2026-03-01', '2026-03-31');
  assert.equal(cats[0].categoriaId, 'cat_mercado');
  assert.equal(cats[0].pct, 0.75);
  assert.equal(money.suma(cats.map((c) => c.monto)), 400000);
  const top = domain.topGastos(e, '2026-03-01', '2026-03-31', 1);
  assert.equal(top.length, 1);
  assert.equal(top[0].monto, 300000);

  const cmp = domain.comparativo(e, { desde: '2026-03-01', hasta: '2026-03-31' }, { desde: '2026-02-01', hasta: '2026-02-28' });
  const mercado = cmp.find((c) => c.categoriaId === 'cat_mercado');
  assert.equal(mercado.variacion, 0.5);
  assert.equal(cmp.find((c) => c.categoriaId === 'cat_ocio').nuevo, true);
  assert.equal(cmp.find((c) => c.categoriaId === 'cat_ropa').variacion, -1);

  const acum = domain.acumuladoDiario(e, { desde: '2026-03-01', hasta: '2026-03-31', dias: 31 }, HOY);
  assert.equal(acum.length, 31);
  assert.equal(acum[0], 0);
  assert.equal(acum[1], 300000);
  assert.equal(acum[2], 400000);
  assert.equal(acum[13], 400000);
  assert.equal(acum[14], null);
});

test('agruparTop: 6 porciones + Otros', () => {
  const items = [];
  for (let i = 0; i < 9; i++) items.push({ categoriaId: 'c' + i, nombre: 'C' + i, monto: 100 - i, pct: (100 - i) / 900 });
  const g = domain.agruparTop(items, 6);
  assert.equal(g.length, 7);
  assert.equal(g[6].nombre, 'Otros');
  assert.equal(g[6].monto, 94 + 93 + 92);
  assert.equal(domain.agruparTop(items.slice(0, 4), 6).length, 4);
});

test('serie mensual de 6 meses', () => {
  const e = nuevo();
  ingreso(e, 1000, '2026-03-01');
  gasto(e, 400, '2025-12-15');
  const s = domain.serieMensual(e, HOY, 6);
  assert.equal(s.length, 6);
  assert.equal(s[5].ingresos, 1000);
  assert.equal(s[5].etiqueta, 'mar');
  assert.equal(s[2].gastos, 400);
  assert.equal(s[2].etiqueta, 'dic');
});

test('rangoPorClave', () => {
  const e = nuevo();
  const mes = domain.rangoPorClave(e, 'mes', HOY);
  assert.equal(mes.desde, '2026-03-01');
  assert.equal(mes.previo.desde, '2026-02-01');
  assert.equal(domain.rangoPorClave(e, 'anterior', HOY).hasta, '2026-02-28');
  const tres = domain.rangoPorClave(e, '3m', HOY);
  assert.equal(tres.desde, '2026-01-01');
  assert.equal(tres.hasta, '2026-03-31');
  assert.equal(tres.previo.hasta, '2025-12-31');
  assert.equal(domain.rangoPorClave(e, 'anio', HOY).desde, '2026-01-01');
  const c = domain.rangoPorClave(e, 'rango', HOY, { desde: '2026-03-01', hasta: '2026-03-10' });
  assert.equal(c.previo.hasta, '2026-02-28');
  assert.equal(c.dias, 10);
});

// ---------- alertas y categorías ----------
test('alertas: presupuesto excedido, cuota vencida y recordatorio de respaldo', () => {
  const e = nuevo();
  domain.crearPresupuesto(e, { categoriaId: 'cat_ocio', limiteMensual: 1000, alertaPct: 80 });
  gasto(e, 1500, '2026-03-05', 'cat_ocio');
  deudaMoto(e);
  e.creadoEn = '2026-01-01T00:00:00.000Z';
  const a = domain.alertas(e, HOY);
  assert.ok(a.some((x) => x.tipo === 'presupuesto' && x.nivel === 'alerta'));
  assert.ok(a.some((x) => x.tipo === 'cuota' && x.nivel === 'alerta'));
  assert.ok(a.some((x) => x.tipo === 'respaldo'));
  e.ajustes.ultimoExport = '2026-03-10';
  assert.ok(!domain.alertas(e, HOY).some((x) => x.tipo === 'respaldo'));
});

test('categorías: las de sistema no se archivan; las usadas no se borran', () => {
  const e = nuevo();
  assert.throws(() => domain.archivarCategoria(e, 'cat_ahorro', true));
  const c = domain.crearCategoria(e, { nombre: 'Gym', tipo: 'gasto', icono: '🏋️', color: '#64748B' });
  gasto(e, 100, HOY, c.id);
  assert.deepEqual(domain.eliminarCategoria(e, c.id), { ok: false, error: 'uso' });
  domain.archivarCategoria(e, c.id, true);
  assert.equal(c.archivada, true);
  const libre = domain.crearCategoria(e, { nombre: 'Otra', tipo: 'gasto', icono: '🎁', color: '#64748B' });
  assert.deepEqual(domain.eliminarCategoria(e, libre.id), { ok: true });
  assert.deepEqual(domain.eliminarCategoria(e, 'cat_deudas'), { ok: false, error: 'sistema' });
  e.categorias = e.categorias.filter((x) => x.id !== 'cat_ahorro');
  domain.asegurarSistema(e);
  assert.ok(domain.cat(e, 'cat_ahorro'));
});

// ---------- datos de ejemplo ----------
test('los datos de ejemplo son un estado válido y completo', () => {
  const e = domain.datosEjemplo(HOY, '2026-03-14T12:00:00.000Z');
  const v = validators.validarEstado(JSON.parse(JSON.stringify(e)));
  assert.deepEqual(v.errores, []);
  assert.equal(v.ok, true);
  assert.ok(e.transacciones.length > 100);
  assert.ok(e.presupuestos.length >= 3 && e.metas.length === 1 && e.deudas.length === 2 && e.personas.length === 2);
  assert.equal(domain.materializarRecurrentes(e, HOY), 0, 'ya están generados');
  assert.ok(domain.saldoPersona(e, e.personas[0].id) !== 0);
  // determinista
  const otra = domain.datosEjemplo(HOY, '2026-03-14T12:00:00.000Z');
  assert.equal(otra.transacciones.length, e.transacciones.length);
});
