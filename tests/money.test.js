'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const money = require('../js/money.js');
const plano = (s) => s.replace(/\u00a0/g, ' ');

test('parse acepta formatos colombianos comunes', () => {
  assert.equal(money.parse('25000'), 25000);
  assert.equal(money.parse('25.000'), 25000);
  assert.equal(money.parse('25,000'), 25000);
  assert.equal(money.parse('$ 25.000'), 25000);
  assert.equal(money.parse('$25.000'), 25000);
  assert.equal(money.parse('1.250.000'), 1250000);
  assert.equal(money.parse(1500), 1500);
});

test('parse rechaza decimales, notación científica, negativos y basura', () => {
  ['1e3', '12,5', '12.5', '-5000', '1.2.3', '1.234,567', 'abc', '', '  ', '25 000a', '1,00', '0x10'].forEach((s) => {
    assert.equal(money.parse(s), null, 'debería rechazar: ' + s);
  });
  assert.equal(money.parse(12.5), null);
  assert.equal(money.parse(-1), null);
  assert.equal(money.parse(null), null);
  assert.equal(money.parse(undefined), null);
});

test('límites del monto', () => {
  assert.equal(money.parse('999999999999'), 999999999999);
  assert.equal(money.parse('1000000000000'), null);
  assert.equal(money.esMonto(0), false);
  assert.equal(money.esMonto(1), true);
  assert.equal(money.esMonto(money.MAX), true);
  assert.equal(money.esMonto(money.MAX + 1), false);
  assert.equal(money.esMonto(1.5), false);
});

test('format muestra COP sin decimales', () => {
  assert.equal(plano(money.format(25000)), '$ 25.000');
  assert.equal(plano(money.format(0)), '$ 0');
  assert.equal(plano(money.format(1234567)), '$ 1.234.567');
  assert.equal(plano(money.format(-45000)), '-$ 45.000');
  assert.equal(plano(money.format(999.6)), '$ 1.000');
});

test('formatCorto y formatoEntrada', () => {
  assert.equal(plano(money.formatCorto(450000)), '$ 450 mil');
  assert.equal(plano(money.formatCorto(1200000)), '$ 1,2 M');
  assert.equal(plano(money.formatCorto(800)), '$ 800');
  assert.equal(money.formatoEntrada('1234567'), '1.234.567');
  assert.equal(money.formatoEntrada('12a3'), '123');
  assert.equal(money.formatoEntrada('0005'), '5');
  assert.equal(money.formatoEntrada(''), '');
});

test('repartir: la suma siempre es exactamente el total', () => {
  assert.deepEqual(money.repartir(100000, 3), [33334, 33333, 33333]);
  for (const total of [0, 1, 2, 99, 100001, 999999999]) {
    for (const n of [1, 2, 3, 7, 10]) {
      const p = money.repartir(total, n);
      assert.equal(p.length, n);
      assert.equal(money.suma(p), total);
      assert.ok(Math.max(...p) - Math.min(...p) <= 1);
    }
  }
  assert.throws(() => money.repartir(10, 0));
  assert.throws(() => money.repartir(10.5, 2));
});

test('repartirPorcentajes: suma exacta y rechaza si no suman 100', () => {
  const p = money.repartirPorcentajes(100001, [33.33, 33.33, 33.34]);
  assert.equal(money.suma(p), 100001);
  assert.deepEqual(money.repartirPorcentajes(1000, [50, 50]), [500, 500]);
  assert.deepEqual(money.repartirPorcentajes(100, [70, 20, 10]), [70, 20, 10]);
  assert.throws(() => money.repartirPorcentajes(1000, [50, 40]));
});
