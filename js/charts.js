/* SantiSinPlata · gráficas SVG propias (sin librerías). Los colores dependientes del tema
   van en clases CSS; los colores de categoría llegan como atributos validados (#RRGGBB). */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};
  var money = SSP.money;
  var NS = 'http://www.w3.org/2000/svg';

  function s(tag, attrs, hijos) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (hijos || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function t(texto, attrs) {
    var el = s('text', attrs);
    el.textContent = texto;
    return el;
  }
  function svg(vb, etiqueta, clase) {
    var el = s('svg', { viewBox: vb, role: 'img', 'aria-label': etiqueta, class: clase || 'grafica-svg', preserveAspectRatio: 'xMidYMid meet' });
    var ti = s('title');
    ti.textContent = etiqueta;
    el.appendChild(ti);
    return el;
  }

  // Máximo "redondo" para el eje Y
  function techo(max) {
    if (max <= 0) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(max))), f = max / exp;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return n * exp;
  }

  // items: [{nombre, monto, color, pct}]
  function dona(items, opts) {
    opts = opts || {};
    var total = items.reduce(function (a, i) { return a + i.monto; }, 0);
    var C = 2 * Math.PI * 76;
    var desc = 'Gasto por categoría: ' + items.map(function (i) { return i.nombre + ' ' + Math.round(i.pct * 100) + ' %'; }).join(', ') + '.';
    var el = svg('0 0 200 200', desc, 'grafica-svg dona');
    el.appendChild(s('circle', { cx: 100, cy: 100, r: 76, fill: 'none', 'stroke-width': 26, class: 'dona-fondo' }));
    var acc = 0;
    items.forEach(function (i) {
      var len = C * i.monto / total, gap = items.length > 1 ? Math.min(2, len) : 0, dash = Math.max(0, len - gap);
      el.appendChild(s('circle', {
        cx: 100, cy: 100, r: 76, fill: 'none', stroke: i.color, 'stroke-width': 26,
        'stroke-dasharray': dash.toFixed(2) + ' ' + (C - dash).toFixed(2), 'stroke-dashoffset': (-acc).toFixed(2),
        transform: 'rotate(-90 100 100)'
      }));
      acc += len;
    });
    el.appendChild(t(opts.etiqueta || 'Total', { x: 100, y: 92, 'text-anchor': 'middle', class: 'dona-et' }));
    el.appendChild(t(money.formatCorto(total), { x: 100, y: 116, 'text-anchor': 'middle', class: 'dona-valor' }));
    return el;
  }

  // serie: [{etiqueta, ingresos, gastos}]
  function barras(serie) {
    var W = 340, H = 190, pl = 6, pr = 6, pt = 14, pb = 26, w = W - pl - pr, h = H - pt - pb;
    var max = techo(Math.max.apply(null, serie.map(function (x) { return Math.max(x.ingresos, x.gastos); }).concat([1])));
    var desc = 'Ingresos y gastos de los últimos ' + serie.length + ' meses: ' + serie.map(function (x) {
      return x.etiqueta + ' ingresos ' + money.format(x.ingresos) + ', gastos ' + money.format(x.gastos);
    }).join('; ') + '.';
    var el = svg('0 0 ' + W + ' ' + H, desc);
    [0, 0.5, 1].forEach(function (f) {
      var y = pt + h - h * f;
      el.appendChild(s('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'rejilla' }));
      if (f > 0) el.appendChild(t(money.formatCorto(max * f), { x: pl, y: y - 3, class: 'eje' }));
    });
    var gw = w / serie.length, bw = Math.min(18, gw / 3);
    serie.forEach(function (x, i) {
      var cx = pl + gw * i + gw / 2;
      [['ingresos', 'barra-ingreso', -bw - 1], ['gastos', 'barra-gasto', 1]].forEach(function (b) {
        var alto = Math.max(x[b[0]] > 0 ? 2 : 0, h * x[b[0]] / max);
        el.appendChild(s('rect', { x: cx + b[2], y: pt + h - alto, width: bw, height: alto, rx: 3, class: b[1] }));
      });
      el.appendChild(t(x.etiqueta, { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'eje' }));
    });
    return el;
  }

  // Acumulados diarios (null = futuro). actual y previo son arreglos de números/null.
  function lineas(actual, previo, etiquetas) {
    var W = 340, H = 170, pl = 6, pr = 10, pt = 14, pb = 24, w = W - pl - pr, h = H - pt - pb;
    var n = Math.max(actual.length, previo.length);
    var vals = actual.concat(previo).filter(function (v) { return v !== null; });
    var max = techo(Math.max.apply(null, vals.concat([1])));
    var ultimo = actual.filter(function (v) { return v !== null; });
    var desc = 'Gasto acumulado del periodo: ' + money.format(ultimo.length ? ultimo[ultimo.length - 1] : 0) +
      (previo.length ? ' frente a ' + money.format(previo[previo.length - 1] || 0) + ' del periodo anterior.' : '.');
    var el = svg('0 0 ' + W + ' ' + H, desc);
    function X(i) { return pl + (n <= 1 ? 0 : w * i / (n - 1)); }
    function Y(v) { return pt + h - h * v / max; }
    [0, 0.5, 1].forEach(function (f) {
      var y = pt + h - h * f;
      el.appendChild(s('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'rejilla' }));
      if (f > 0) el.appendChild(t(money.formatCorto(max * f), { x: pl, y: y - 3, class: 'eje' }));
    });
    function camino(arr) {
      var d = '', abierto = false;
      arr.forEach(function (v, i) {
        if (v === null) { abierto = false; return; }
        d += (abierto ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
        abierto = true;
      });
      return d.trim();
    }
    if (previo.length) el.appendChild(s('path', { d: camino(previo), fill: 'none', class: 'linea-previa', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
    var dA = camino(actual);
    if (dA) {
      var ult = -1;
      actual.forEach(function (v, i) { if (v !== null) ult = i; });
      el.appendChild(s('path', { d: dA + ' L' + X(ult).toFixed(1) + ' ' + (pt + h) + ' L' + X(0).toFixed(1) + ' ' + (pt + h) + ' Z', class: 'area-actual' }));
      el.appendChild(s('path', { d: dA, fill: 'none', class: 'linea-actual', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      el.appendChild(s('circle', { cx: X(ult).toFixed(1), cy: Y(actual[ult]).toFixed(1), r: 4, class: 'punto-actual' }));
    }
    (etiquetas || []).forEach(function (e) {
      el.appendChild(t(e.texto, { x: X(e.i), y: H - 8, 'text-anchor': e.i === 0 ? 'start' : (e.i === n - 1 ? 'end' : 'middle'), class: 'eje' }));
    });
    return el;
  }

  // Anillo de progreso (0..1)
  function anillo(pct, clase, texto) {
    var r = 26, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    var etiqueta = (texto || 'Progreso') + ': ' + Math.round(p * 100) + ' %';
    var el = svg('0 0 64 64', etiqueta, 'anillo');
    el.appendChild(s('circle', { cx: 32, cy: 32, r: r, fill: 'none', 'stroke-width': 7, class: 'anillo-fondo' }));
    el.appendChild(s('circle', {
      cx: 32, cy: 32, r: r, fill: 'none', 'stroke-width': 7, 'stroke-linecap': 'round', class: 'anillo-valor ' + (clase || ''),
      'stroke-dasharray': (C * p).toFixed(2) + ' ' + C.toFixed(2), transform: 'rotate(-90 32 32)'
    }));
    el.appendChild(t(Math.round(p * 100) + '%', { x: 32, y: 36, 'text-anchor': 'middle', class: 'anillo-txt' }));
    return el;
  }

  SSP.charts = { dona: dona, barras: barras, lineas: lineas, anillo: anillo };
})(typeof window !== 'undefined' ? window : globalThis);
