'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../js/validators.js');
const domain = require('../js/domain.js');

const HOY = '2026-03-14';
const est = () => domain.estadoVacio('2026-03-14T12:00:00.000Z');
const ctx = (e, extra) => Object.assign({ hoy: HOY, estado: e || est() }, extra);

test('monto: entero entre 1 y el máximo', () => {
  assert.equal(v.validarMonto('25.000').ok, true);
  assert.equal(v.validarMonto('25.000').datos.monto, 25000);
  ['', '0', '-5', '12,5', 'abc', '1e3', '1000000000000'].forEach((s) => {
    const r = v.validarMonto(s);
    assert.equal(r.ok, false, s);
    assert.ok(r.errores.monto);
  });
});

test('transacción válida e inválidas', () => {
  const e = est();
  const base = { tipo: 'gasto', monto: '25000', fecha: HOY, categoriaId: 'cat_mercado', nota: ' Almuerzo ' };
  const ok = v.validarTransaccion(base, ctx(e));
  assert.equal(ok.ok, true);
  assert.equal(ok.datos.nota, 'Almuerzo');
  assert.equal(ok.datos.monto, 25000);
  assert.ok(v.validarTransaccion(Object.assign({}, base, { fecha: '2026-02-31' }), ctx(e)).errores.fecha);
  assert.ok(v.validarTransaccion(Object.assign({}, base, { fecha: '2028-01-01' }), ctx(e)).errores.fecha, 'más de 1 año futuro');
  assert.ok(v.validarTransaccion(Object.assign({}, base, { fecha: '1999-12-31' }), ctx(e)).errores.fecha);
  assert.ok(v.validarTransaccion(Object.assign({}, base, { nota: 'x'.repeat(121) }), ctx(e)).errores.nota);
  assert.ok(v.validarTransaccion(Object.assign({}, base, { categoriaId: 'nope' }), ctx(e)).errores.categoriaId);
  assert.ok(v.validarTransaccion(Object.assign({}, base, { categoriaId: 'cat_salario' }), ctx(e)).errores.categoriaId, 'categoría de otro tipo');
  assert.ok(v.validarTransaccion(Object.assign({}, base, { tipo: 'otro' }), ctx(e)).errores.tipo);
  e.categorias.find((c) => c.id === 'cat_ropa').archivada = true;
  assert.ok(v.validarTransaccion(Object.assign({}, base, { categoriaId: 'cat_ropa' }), ctx(e)).errores.categoriaId);
  assert.equal(v.validarTransaccion(Object.assign({}, base, { categoriaId: 'cat_ropa' }), ctx(e, { categoriaActual: 'cat_ropa' })).ok, true);
});

test('categoría: nombre único por tipo sin distinguir tildes ni mayúsculas', () => {
  const e = est();
  assert.equal(v.validarCategoria({ nombre: 'Gimnasio', tipo: 'gasto' }, ctx(e)).ok, true);
  assert.ok(v.validarCategoria({ nombre: 'EDUCACION', tipo: 'gasto' }, ctx(e)).errores.nombre);
  assert.ok(v.validarCategoria({ nombre: '   ', tipo: 'gasto' }, ctx(e)).errores.nombre);
  assert.equal(v.validarCategoria({ nombre: 'Otros', tipo: 'ingreso' }, ctx(e, { editId: 'cat_otros_i' })).ok, true);
  assert.ok(v.validarCategoria({ nombre: 'x'.repeat(41), tipo: 'gasto' }, ctx(e)).errores.nombre);
});

test('presupuesto: límite, alerta y unicidad', () => {
  const e = est();
  const ok = v.validarPresupuesto({ categoriaId: 'cat_mercado', limiteMensual: '600000', alertaPct: 80 }, ctx(e));
  assert.equal(ok.ok, true);
  assert.equal(v.validarPresupuesto({ categoriaId: 'total', limiteMensual: '3000000', alertaPct: '80' }, ctx(e)).datos.categoriaId, null);
  assert.ok(v.validarPresupuesto({ categoriaId: 'cat_mercado', limiteMensual: '0', alertaPct: 80 }, ctx(e)).errores.limiteMensual);
  assert.ok(v.validarPresupuesto({ categoriaId: 'cat_mercado', limiteMensual: '1000', alertaPct: 49 }, ctx(e)).errores.alertaPct);
  assert.ok(v.validarPresupuesto({ categoriaId: 'cat_mercado', limiteMensual: '1000', alertaPct: 101 }, ctx(e)).errores.alertaPct);
  assert.ok(v.validarPresupuesto({ categoriaId: 'cat_salario', limiteMensual: '1000', alertaPct: 80 }, ctx(e)).errores.categoriaId);
  e.presupuestos.push({ id: 'pr_1', categoriaId: 'cat_mercado', limiteMensual: 1000, alertaPct: 80 });
  assert.ok(v.validarPresupuesto({ categoriaId: 'cat_mercado', limiteMensual: '1000', alertaPct: 80 }, ctx(e)).errores.categoriaId);
  assert.equal(v.validarPresupuesto({ categoriaId: 'cat_mercado', limiteMensual: '2000', alertaPct: 80 }, ctx(e, { editId: 'pr_1' })).ok, true);
});

test('meta y aporte', () => {
  assert.equal(v.validarMeta({ nombre: 'Viaje', objetivo: '3000000', fechaLimite: '2026-12-01' }, ctx()).ok, true);
  assert.equal(v.validarMeta({ nombre: 'Viaje', objetivo: '3000000', fechaLimite: '' }, ctx()).ok, true);
  assert.ok(v.validarMeta({ nombre: 'Viaje', objetivo: '3000000', fechaLimite: HOY }, ctx()).errores.fechaLimite);
  assert.ok(v.validarMeta({ nombre: 'Viaje', objetivo: '3000000', fechaLimite: '2026-01-01' }, ctx()).errores.fechaLimite);
  assert.ok(v.validarMeta({ nombre: '', objetivo: '0' }, ctx()).errores.nombre);
  assert.equal(v.validarAporte({ monto: '200000', fecha: HOY }, ctx()).ok, true);
  assert.ok(v.validarAporte({ monto: '-1', fecha: HOY }, ctx()).errores.monto);
});

test('recurrente: frecuencia, días y fechas', () => {
  const base = { tipo: 'gasto', monto: '45000', categoriaId: 'cat_suscripciones', nota: 'Netflix', frecuencia: 'mensual', diaDelMes: '5', inicio: HOY, fin: '' };
  assert.equal(v.validarRecurrente(base, ctx()).ok, true);
  assert.ok(v.validarRecurrente(Object.assign({}, base, { frecuencia: 'diaria' }), ctx()).errores.frecuencia);
  assert.ok(v.validarRecurrente(Object.assign({}, base, { diaDelMes: '32' }), ctx()).errores.diaDelMes);
  assert.ok(v.validarRecurrente(Object.assign({}, base, { diaDelMes: '0' }), ctx()).errores.diaDelMes);
  assert.ok(v.validarRecurrente(Object.assign({}, base, { fin: '2026-01-01' }), ctx()).errores.fin);
  assert.ok(v.validarRecurrente(Object.assign({}, base, { monto: '0' }), ctx()).errores.monto);
  assert.equal(v.validarRecurrente(Object.assign({}, base, { frecuencia: 'semanal', diaSemana: '1' }), ctx()).ok, true);
  assert.ok(v.validarRecurrente(Object.assign({}, base, { frecuencia: 'semanal', diaSemana: '7' }), ctx()).errores.diaSemana);
  assert.equal(v.validarRecurrente(Object.assign({}, base, { frecuencia: 'quincenal' }), ctx()).ok, true);
});

test('deuda: capital, cuotas, tasa y cuota fija', () => {
  const base = { nombre: 'Moto', acreedor: 'Banco', tipo: 'cuotas', capitalInicial: '6000000', tasaMensualPct: '1,8', numCuotas: '24', valorCuota: '', primeraCuota: '2026-04-10' };
  const ok = v.validarDeuda(base, ctx());
  assert.equal(ok.ok, true);
  assert.equal(ok.datos.tasaMensualPct, 1.8);
  assert.equal(ok.datos.diaPago, 10);
  assert.ok(v.validarDeuda(Object.assign({}, base, { numCuotas: '0' }), ctx()).errores.numCuotas);
  assert.ok(v.validarDeuda(Object.assign({}, base, { numCuotas: '601' }), ctx()).errores.numCuotas);
  assert.ok(v.validarDeuda(Object.assign({}, base, { tasaMensualPct: '101' }), ctx()).errores.tasaMensualPct);
  assert.ok(v.validarDeuda(Object.assign({}, base, { tasaMensualPct: '1.234' }), ctx()).errores.tasaMensualPct);
  assert.ok(v.validarDeuda(Object.assign({}, base, { capitalInicial: '0' }), ctx()).errores.capitalInicial);
  assert.ok(v.validarDeuda(Object.assign({}, base, { valorCuota: '100000' }), ctx()).errores.valorCuota, 'no cubre intereses');
  assert.equal(v.validarDeuda(Object.assign({}, base, { valorCuota: '400000' }), ctx()).ok, true);
  const libre = v.validarDeuda({ nombre: 'Préstamo', tipo: 'libre', capitalInicial: '500000' }, ctx());
  assert.equal(libre.ok, true);
  assert.equal(libre.datos.numCuotas, 0);
});

test('pago: no excede saldo + interés y cubre los intereses', () => {
  const c = ctx(est(), { maxPago: 1050000, minPago: 50000 });
  assert.equal(v.validarPago({ monto: '300000', fecha: HOY, tipo: 'cuota' }, c).ok, true);
  assert.equal(v.validarPago({ monto: '1050000', fecha: HOY, tipo: 'cuota' }, c).ok, true);
  assert.ok(v.validarPago({ monto: '1050001', fecha: HOY, tipo: 'cuota' }, c).errores.monto);
  assert.ok(v.validarPago({ monto: '10000', fecha: HOY, tipo: 'cuota' }, c).errores.monto, 'no cubre intereses');
  assert.equal(v.validarPago({ monto: '10000', fecha: HOY, tipo: 'extra' }, c).ok, true);
});

test('compartido: ≥2 participantes, partes suman el total, pagador participa', () => {
  const e = est();
  e.personas.push({ id: 'pe_a', nombre: 'Ana' });
  const base = {
    descripcion: 'Cena', total: '90000', fecha: HOY, categoriaId: 'cat_comida', pagadoPor: 'yo',
    participantes: [{ personaId: 'yo', parte: 45000 }, { personaId: 'pe_a', parte: 45000 }]
  };
  assert.equal(v.validarCompartido(base, ctx(e)).ok, true);
  assert.ok(v.validarCompartido(Object.assign({}, base, { participantes: [{ personaId: 'yo', parte: 90000 }] }), ctx(e)).errores.participantes);
  assert.ok(v.validarCompartido(Object.assign({}, base, { participantes: [{ personaId: 'yo', parte: 40000 }, { personaId: 'pe_a', parte: 45000 }] }), ctx(e)).errores.partes);
  assert.ok(v.validarCompartido(Object.assign({}, base, { pagadoPor: 'pe_x' }), ctx(e)).errores.pagadoPor);
  assert.ok(v.validarCompartido(Object.assign({}, base, { participantes: [{ personaId: 'pe_a', parte: 45000 }, { personaId: 'pe_z', parte: 45000 }] }), ctx(e)).errores.participantes);
  assert.ok(v.validarCompartido(Object.assign({}, base, { participantes: [{ personaId: 'yo', parte: 45000 }, { personaId: 'yo', parte: 45000 }] }), ctx(e)).errores.participantes);
});

test('persona y liquidación', () => {
  const e = est();
  e.personas.push({ id: 'pe_a', nombre: 'Ana' });
  assert.equal(v.validarPersona({ nombre: 'Camilo' }, ctx(e)).ok, true);
  assert.ok(v.validarPersona({ nombre: 'ana' }, ctx(e)).errores.nombre);
  assert.ok(v.validarPersona({ nombre: 'Yo' }, ctx(e)).errores.nombre);
  assert.equal(v.validarLiquidacion({ monto: '5000', fecha: HOY }, ctx(e, { saldoAbs: 5000 })).ok, true);
  assert.ok(v.validarLiquidacion({ monto: '5001', fecha: HOY }, ctx(e, { saldoAbs: 5000 })).errores.monto);
});

test('ajustes', () => {
  assert.equal(v.validarAjustes({ diaInicioMes: '25', tema: 'oscuro', nombreUsuario: 'Santi' }).ok, true);
  assert.ok(v.validarAjustes({ diaInicioMes: '29', tema: 'auto' }).errores.diaInicioMes);
  assert.ok(v.validarAjustes({ diaInicioMes: '0', tema: 'auto' }).errores.diaInicioMes);
});
