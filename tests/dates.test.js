'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../js/dates.js');

test('esValida rechaza fechas imposibles', () => {
  assert.equal(dates.esValida('2026-02-31'), false);
  assert.equal(dates.esValida('2026-13-01'), false);
  assert.equal(dates.esValida('2026-00-10'), false);
  assert.equal(dates.esValida('2026-3-5'), false);
  assert.equal(dates.esValida('abc'), false);
  assert.equal(dates.esValida(null), false);
  assert.equal(dates.esValida('2026-03-14'), true);
});

test('años bisiestos', () => {
  assert.equal(dates.esValida('2024-02-29'), true);
  assert.equal(dates.esValida('2025-02-29'), false);
  assert.equal(dates.esValida('2100-02-29'), false);
  assert.equal(dates.esValida('2000-02-29'), true);
  assert.equal(dates.diasDelMes(2024, 2), 29);
  assert.equal(dates.diasDelMes(2026, 2), 28);
});

test('sumar días y meses con ajuste a fin de mes', () => {
  assert.equal(dates.sumarDias('2026-02-28', 1), '2026-03-01');
  assert.equal(dates.sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(dates.sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(dates.sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(dates.sumarMeses('2024-01-31', 1), '2024-02-29');
  assert.equal(dates.sumarMeses('2026-11-15', 3), '2027-02-15');
  assert.equal(dates.sumarMeses('2026-01-15', -2), '2025-11-15');
  assert.equal(dates.diferenciaDias('2026-03-01', '2026-03-31'), 30);
});

test('rangoDelMes con inicio el día 1', () => {
  assert.deepEqual(dates.rangoDelMes('2026-03-14', 1), { desde: '2026-03-01', hasta: '2026-03-31', dias: 31 });
  assert.deepEqual(dates.rangoDelMes('2026-02-10', 1), { desde: '2026-02-01', hasta: '2026-02-28', dias: 28 });
});

test('rangoDelMes con inicio el día 25 y cambio de año', () => {
  assert.deepEqual(dates.rangoDelMes('2026-03-10', 25), { desde: '2026-02-25', hasta: '2026-03-24', dias: 28 });
  assert.deepEqual(dates.rangoDelMes('2026-03-25', 25), { desde: '2026-03-25', hasta: '2026-04-24', dias: 31 });
  assert.deepEqual(dates.rangoDelMes('2026-01-10', 25), { desde: '2025-12-25', hasta: '2026-01-24', dias: 31 });
  assert.deepEqual(dates.rangoDelMes('2025-12-30', 25), { desde: '2025-12-25', hasta: '2026-01-24', dias: 31 });
});

test('desplazarPeriodo', () => {
  assert.deepEqual(dates.desplazarPeriodo('2026-03-14', 1, -1), { desde: '2026-02-01', hasta: '2026-02-28', dias: 28 });
  assert.deepEqual(dates.desplazarPeriodo('2026-01-14', 1, -1), { desde: '2025-12-01', hasta: '2025-12-31', dias: 31 });
  assert.deepEqual(dates.desplazarPeriodo('2026-03-10', 25, -1), { desde: '2026-01-25', hasta: '2026-02-24', dias: 31 });
  assert.deepEqual(dates.desplazarPeriodo('2026-03-14', 1, 1), { desde: '2026-04-01', hasta: '2026-04-30', dias: 30 });
});

test('mesesCompletos', () => {
  assert.equal(dates.mesesCompletos('2026-03-14', '2026-12-01'), 8);
  assert.equal(dates.mesesCompletos('2026-03-14', '2026-04-14'), 1);
  assert.equal(dates.mesesCompletos('2026-03-14', '2026-04-13'), 0);
  assert.equal(dates.mesesCompletos('2026-03-14', '2026-03-01'), 0);
  assert.equal(dates.mesesCompletos('2025-11-15', '2026-02-15'), 3);
});

test('etiquetas', () => {
  assert.equal(dates.etiquetaPeriodo({ desde: '2026-03-01', hasta: '2026-03-31' }, 1), 'Marzo 2026');
  assert.equal(dates.etiquetaPeriodo({ desde: '2026-02-25', hasta: '2026-03-24' }, 25), '25 feb – 24 mar');
  assert.equal(dates.etiquetaDia('2026-03-14', '2026-03-14'), 'Hoy');
  assert.equal(dates.etiquetaDia('2026-03-13', '2026-03-14'), 'Ayer');
  assert.equal(dates.etiquetaDia('2026-03-10', '2026-03-14'), 'mar 10 mar');
  assert.equal(dates.diaSemana('2026-03-14'), 6);
});
