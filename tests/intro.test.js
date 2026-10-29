'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const intro = require('../js/intro.js');

function falso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('la animación está activa por defecto y se puede apagar y volver a encender', () => {
  const st = falso();
  assert.equal(intro.activa(st), true);
  assert.equal(intro.fijar(st, false), true);
  assert.equal(intro.activa(st), false);
  assert.equal(intro.fijar(st, true), true);
  assert.equal(intro.activa(st), true);
});

test('si el almacenamiento falla, la animación sigue activa y no lanza', () => {
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(intro.activa(roto), true);
  assert.equal(intro.fijar(roto, false), false);
});
