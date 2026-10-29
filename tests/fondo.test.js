'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fondo = require('../js/fondo.js');

const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

function falso(opts) {
  const m = new Map();
  opts = opts || {};
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts.llena) throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}

test('escala: reduce conservando proporción y nunca agranda', () => {
  assert.deepEqual(fondo.escala(4000, 3000, 1400), { w: 1400, h: 1050 });
  assert.deepEqual(fondo.escala(3000, 4000, 1400), { w: 1050, h: 1400 });
  assert.deepEqual(fondo.escala(800, 600, 1400), { w: 800, h: 600 });
  assert.deepEqual(fondo.escala(1, 5000, 1400), { w: 1, h: 1400 });
});

test('normalizar: acepta solo configuraciones válidas', () => {
  assert.deepEqual(fondo.normalizar({ tipo: 'degradado' }), { v: 1, tipo: 'degradado', velo: 60 });
  assert.deepEqual(fondo.normalizar({ tipo: 'foto', img: JPG, velo: 30 }), { v: 1, tipo: 'foto', img: JPG, velo: 30 });
  assert.equal(fondo.normalizar({ tipo: 'foto', img: JPG, velo: 99 }).velo, 60, 'velo fuera de rango → valor por defecto');
  assert.equal(fondo.normalizar({ tipo: 'foto', img: JPG, velo: 12.5 }).velo, 60);
  [null, undefined, 'x', 5, [], {}, { tipo: 'otro' }, { tipo: 'foto' },
    { tipo: 'foto', img: 'http://malo.example/x.jpg' },
    { tipo: 'foto', img: 'data:text/html;base64,PHNjcmlwdD4=' },
    { tipo: 'foto', img: 'data:image/jpeg;base64,AAAA") ; background:url(//malo' },
    { tipo: 'foto', img: 'data:image/svg+xml;base64,AAAA' },
    { tipo: 'foto', img: 'data:image/jpeg;base64,' + 'A'.repeat(2000001) }
  ].forEach((c, i) => assert.equal(fondo.normalizar(c), null, 'caso ' + i));
});

test('guardar y cargar: ida y vuelta, y tolera datos dañados', () => {
  const st = falso();
  const f = fondo.crear(st);
  assert.equal(f.cargar(), null);
  assert.equal(f.guardar({ tipo: 'foto', img: JPG, velo: 40 }).ok, true);
  assert.equal(f.cargar().velo, 40);
  assert.equal(f.guardar({ tipo: 'foto', img: 'javascript:alert(1)' }).ok, false);
  st.setItem(fondo.KEY, '{no es json');
  assert.equal(f.cargar(), null);
  st.setItem(fondo.KEY, JSON.stringify({ tipo: 'foto', img: 'http://externo/x.png' }));
  assert.equal(f.cargar(), null, 'un valor manipulado no se aplica');
  f.guardar({ tipo: 'degradado' });
  f.quitar();
  assert.equal(f.cargar(), null);
});

test('cuota llena: guardar informa el error sin lanzar', () => {
  const f = fondo.crear(falso({ llena: true }));
  assert.deepEqual(f.guardar({ tipo: 'degradado' }), { ok: false, error: 'cuota' });
});
