/* SantiSinPlata · dinero en COP (enteros, sin decimales) */
(function (root) {
  'use strict';

  var MAX = 999999999999;

  // Acepta "25000", "25.000", "25,000", "$ 25.000". Rechaza decimales,
  // notación científica, negativos y separadores mezclados. Devuelve entero >= 0 o null.
  function parse(entrada) {
    if (typeof entrada === 'number') {
      return Number.isSafeInteger(entrada) && entrada >= 0 && entrada <= MAX ? entrada : null;
    }
    if (typeof entrada !== 'string') return null;
    var s = entrada.replace(/[\s ]/g, '').replace(/^\$/, '').replace(/^COP/i, '').replace(/^\$/, '');
    if (s === '' || s.length > 20) return null;
    var n;
    if (/^\d+$/.test(s)) n = Number(s);
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = Number(s.replace(/\./g, ''));
    else if (/^\d{1,3}(,\d{3})+$/.test(s)) n = Number(s.replace(/,/g, ''));
    else return null;
    return n <= MAX ? n : null;
  }

  function esMonto(n) {
    return Number.isSafeInteger(n) && n >= 1 && n <= MAX;
  }

  function agrupar(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // $ 25.000 · determinista (no depende de ICU del navegador). Usa espacio duro tras el $ para no partir la cifra.
  function format(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? '-' : '') + '$\u00a0' + agrupar(Math.abs(n));
  }

  // Para etiquetas de gráficas: $ 450 mil · $ 1,2 M
  function formatCorto(n) {
    n = Math.round(Number(n) || 0);
    var a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (a >= 1e6) return sg + '$\u00a0' + String(Math.round(a / 1e5) / 10).replace('.', ',') + '\u00a0M';
    if (a >= 1e3) return sg + '$\u00a0' + Math.round(a / 1e3) + '\u00a0mil';
    return sg + '$\u00a0' + a;
  }

  // Formato mientras se escribe: deja solo dígitos (máx. 12) y agrupa miles.
  function formatoEntrada(texto) {
    var d = String(texto == null ? '' : texto).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
    return d === '' ? '' : agrupar(d);
  }

  // Reparte total en n partes enteras; la suma siempre es exactamente total.
  function repartir(total, n) {
    if (!Number.isInteger(total) || total < 0 || !Number.isInteger(n) || n < 1) {
      throw new Error('repartir: argumentos inválidos');
    }
    var base = Math.floor(total / n), resto = total - base * n, partes = [];
    for (var i = 0; i < n; i++) partes.push(base + (i < resto ? 1 : 0));
    return partes;
  }

  // Reparte por porcentajes (deben sumar 100) con el método del mayor resto.
  function repartirPorcentajes(total, pcts) {
    var suma = pcts.reduce(function (a, b) { return a + b; }, 0);
    if (Math.abs(suma - 100) > 1e-9) throw new Error('repartirPorcentajes: no suman 100');
    var exactos = pcts.map(function (p) { return total * p / 100; });
    var partes = exactos.map(Math.floor);
    var falta = total - partes.reduce(function (a, b) { return a + b; }, 0);
    var orden = exactos.map(function (e, i) { return { i: i, f: e - Math.floor(e) }; })
      .sort(function (a, b) { return b.f - a.f || a.i - b.i; });
    for (var k = 0; k < falta; k++) partes[orden[k].i] += 1;
    return partes;
  }

  function suma(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  var api = {
    MAX: MAX, parse: parse, esMonto: esMonto, format: format, formatCorto: formatCorto,
    formatoEntrada: formatoEntrada, repartir: repartir, repartirPorcentajes: repartirPorcentajes, suma: suma
  };
  root.SSP = root.SSP || {};
  root.SSP.money = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
