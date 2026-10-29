/* SantiSinPlata · componentes de interfaz: DOM seguro (sin innerHTML), hojas, formularios, avisos */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};
  var money = SSP.money;

  // ---------- DOM ----------
  function anexar(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { anexar(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  // h('div', {class:'x', texto:'hola', onclick:fn}, hijos...) · todo texto entra como textContent
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'texto') el.textContent = v;
      else if (k === 'estilo') Object.keys(v).forEach(function (p) { el.style[p] = v[p]; });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'hidden' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) anexar(el, arguments[i]);
    return el;
  }

  function vaciar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  var secuencia = 0;
  function nuevoId(p) { return (p || 'id') + (++secuencia); }

  function enfocables(el) {
    return Array.prototype.filter.call(
      el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.hidden && n.offsetParent !== null; }
    );
  }

  // ---------- hojas modales ----------
  var pila = [];

  // opts: { titulo, clase, bloqueante, onCerrar } → { el (cuerpo), panel, cerrar }
  function hoja(opts) {
    var previo = document.activeElement, cerrada = false, idT = nuevoId('titulo');
    var capa = h('div', { class: 'capa' });
    var cuerpo = h('div', { class: 'hoja-cuerpo' });
    var btnX = opts.bloqueante ? null : h('button', { type: 'button', class: 'icono-btn', 'aria-label': 'Cerrar', onclick: function () { api.cerrar(); }, texto: '✕' });
    var panel = h('section', { class: 'hoja ' + (opts.clase || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idT },
      h('div', { class: 'hoja-enc' }, h('h2', { id: idT, texto: opts.titulo }), btnX), cuerpo);
    var fondo = h('div', { class: 'fondo', onclick: function () { if (!opts.bloqueante) api.cerrar(); } });
    capa.appendChild(fondo);
    capa.appendChild(panel);
    document.getElementById('capas').appendChild(capa);
    document.body.classList.add('sin-scroll');
    requestAnimationFrame(function () { capa.classList.add('abierta'); });

    var api = {
      el: cuerpo, panel: panel, bloqueante: !!opts.bloqueante,
      cerrar: function () {
        if (cerrada) return;
        cerrada = true;
        pila.splice(pila.indexOf(api), 1);
        capa.classList.remove('abierta');
        setTimeout(function () { if (capa.parentNode) capa.parentNode.removeChild(capa); }, 220);
        if (!pila.length) document.body.classList.remove('sin-scroll');
        if (previo && previo.focus && document.body.contains(previo)) previo.focus();
        if (opts.onCerrar) opts.onCerrar();
      },
      panelEl: panel
    };
    pila.push(api);
    setTimeout(function () {
      var f = enfocables(cuerpo)[0] || btnX;
      if (f && !cerrada) f.focus();
    }, 30);
    return api;
  }

  document.addEventListener('keydown', function (e) {
    if (!pila.length) return;
    var top = pila[pila.length - 1];
    if (e.key === 'Escape' && !top.bloqueante) { e.preventDefault(); top.cerrar(); return; }
    if (e.key === 'Tab') {
      var f = enfocables(top.panel);
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !top.panel.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  // opts: { titulo, mensaje, textoOk, peligro, escribir } → Promise<boolean>
  function confirmar(opts) {
    return new Promise(function (resolve) {
      var resuelto = false;
      function fin(v) { if (!resuelto) { resuelto = true; resolve(v); } }
      var h2 = hoja({ titulo: opts.titulo, clase: 'dialogo', onCerrar: function () { fin(false); } });
      var entrada = null;
      var ok = h('button', { type: 'button', class: 'btn ' + (opts.peligro ? 'peligro' : 'primario'), texto: opts.textoOk || 'Aceptar', 'aria-disabled': opts.escribir ? 'true' : null });
      if (opts.escribir) {
        entrada = h('input', {
          type: 'text', class: 'entrada', autocomplete: 'off', 'aria-label': 'Escribe ' + opts.escribir + ' para confirmar',
          oninput: function () { ok.setAttribute('aria-disabled', entrada.value.trim() === opts.escribir ? 'false' : 'true'); }
        });
      }
      ok.addEventListener('click', function () {
        if (ok.getAttribute('aria-disabled') === 'true') return;
        fin(true); h2.cerrar();
      });
      h2.el.appendChild(h('p', { class: 'dialogo-msg', texto: opts.mensaje }));
      if (entrada) h2.el.appendChild(h('div', { class: 'campo' }, h('p', { class: 'ayuda', texto: 'Escribe ' + opts.escribir + ' para confirmar.' }), entrada));
      h2.el.appendChild(h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'btn secundario', texto: 'Cancelar', onclick: function () { fin(false); h2.cerrar(); } }), ok));
    });
  }

  // ---------- avisos ----------
  function toast(msg, o) {
    o = o || {};
    var cont = document.getElementById('toasts');
    while (cont.firstChild) cont.removeChild(cont.firstChild); // un solo aviso a la vez: evita "Deshacer" obsoletos
    var timer = null;
    function quitar() { clearTimeout(timer); if (t.parentNode) t.parentNode.removeChild(t); }
    var t = h('div', { class: 'toast' + (o.error ? ' error' : '') },
      h('span', { class: 'toast-msg', texto: msg }),
      o.accion ? h('button', { type: 'button', class: 'toast-accion', texto: o.accion.texto, onclick: function () { quitar(); o.accion.fn(); } }) : null);
    cont.appendChild(t);
    timer = setTimeout(quitar, o.ms || 6000);
    return quitar;
  }

  function descargar(nombre, mime, texto) {
    var blob = new Blob([texto], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: nombre, hidden: true });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  // ---------- piezas visuales ----------
  function tarjeta(clase) {
    var el = h('section', { class: 'tarjeta' + (clase ? ' ' + clase : '') });
    for (var i = 1; i < arguments.length; i++) anexar(el, arguments[i]);
    return el;
  }

  function seccion(titulo, accion) {
    return h('div', { class: 'seccion' }, h('h2', { texto: titulo }),
      accion ? h('button', { type: 'button', class: 'btn texto', texto: accion.texto, onclick: accion.fn }) : null);
  }

  function barra(pct, estado, etiqueta) {
    var relleno = h('div', { class: 'barra-relleno est-' + (estado || 'ok') });
    relleno.style.width = Math.max(0, Math.min(100, pct * 100)) + '%';
    return h('div', { class: 'barra', role: 'progressbar', 'aria-label': etiqueta || 'Progreso', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(Math.min(1, pct) * 100) }, relleno);
  }

  function vacio(icono, titulo, texto, accion) {
    return h('div', { class: 'vacio' },
      h('div', { class: 'vacio-icono', 'aria-hidden': 'true', texto: icono }),
      h('p', { class: 'vacio-titulo', texto: titulo }),
      texto ? h('p', { class: 'vacio-texto', texto: texto }) : null,
      accion ? h('button', { type: 'button', class: 'btn primario', texto: accion.texto, onclick: accion.fn }) : null);
  }

  function montoEl(valor, tipo, clase) {
    var signo = tipo === 'ingreso' ? '+' : (tipo === 'gasto' ? '−' : '');
    return h('span', { class: 'monto ' + (tipo || '') + (clase ? ' ' + clase : ''), texto: signo + money.format(Math.abs(valor)).replace('-', '') });
  }

  function iconoCat(c) {
    return h('span', { class: 'icono-cat', 'aria-hidden': 'true', texto: c ? c.icono : '•' });
  }

  // fila de lista: { icono(node|string), titulo, sub, derecha(node), onclick, clase }
  function fila(o) {
    var cuerpo = h('span', { class: 'fila-cuerpo' }, h('span', { class: 'fila-titulo', texto: o.titulo }), o.sub ? h('span', { class: 'fila-sub', texto: o.sub }) : null);
    var hijos = [o.icono ? (typeof o.icono === 'string' ? h('span', { class: 'icono-cat', 'aria-hidden': 'true', texto: o.icono }) : o.icono) : null, cuerpo, o.derecha ? h('span', { class: 'fila-der' }, o.derecha) : null];
    return o.onclick
      ? h('button', { type: 'button', class: 'fila ' + (o.clase || ''), onclick: o.onclick }, hijos)
      : h('div', { class: 'fila ' + (o.clase || '') }, hijos);
  }

  // pestañas internas: opciones [{v,t}]
  function tabs(opciones, actual, onSel, etiqueta) {
    return h('div', { class: 'tabs', role: 'tablist', 'aria-label': etiqueta || 'Secciones' }, opciones.map(function (o) {
      return h('button', {
        type: 'button', class: 'tab' + (o.v === actual ? ' activa' : ''), role: 'tab', 'aria-selected': o.v === actual ? 'true' : 'false',
        texto: o.t, onclick: function () { onSel(o.v); }
      });
    }));
  }

  // ---------- formularios ----------
  function crearFormulario(def) {
    var fid = nuevoId('f'), reg = {}, res = { ok: false, errores: {}, datos: null }, intentado = false;
    var el = h('form', { class: 'formulario', novalidate: true, autocomplete: 'off' });
    var general = h('p', { class: 'error general', role: 'alert', hidden: true });
    var form = { el: el, reg: reg, onValidar: null };

    function envolver(c, id, esGrupo) {
      var errId = id + '-err', ayId = id + '-ay';
      var et = c.et ? (esGrupo ? h('span', { class: 'etiqueta', id: id + '-et', texto: c.et }) : h('label', { class: 'etiqueta', for: id, texto: c.et })) : null;
      var ay = c.ayuda ? h('p', { class: 'ayuda', id: ayId, texto: c.ayuda }) : null;
      var err = h('p', { class: 'error', id: errId, hidden: true });
      return { et: et, ay: ay, err: err, desc: errId + (ay ? ' ' + ayId : '') };
    }

    function atajos(c, input) {
      if (!c.atajos || !c.atajos.length) return null;
      return h('div', { class: 'atajos' }, c.atajos.map(function (a) {
        return h('button', {
          type: 'button', class: 'chip chip-sm', texto: a.t,
          onclick: function () { input.value = typeof a.v === 'function' ? a.v() : a.v; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }
        });
      }));
    }

    function construir(c) {
      var id = fid + '-' + c.n, f = {}, env, ctl;
      if (c.t === 'texto' || c.t === 'monto' || c.t === 'numero' || c.t === 'decimal') {
        env = envolver(c, id, false);
        var input = h('input', {
          type: 'text', id: id, class: 'entrada' + (c.t === 'monto' ? ' entrada-monto' : ''), maxlength: c.max, placeholder: c.placeholder,
          inputmode: c.t === 'texto' ? null : (c.t === 'decimal' ? 'decimal' : 'numeric'), autocomplete: 'off', enterkeyhint: 'done',
          'aria-describedby': env.desc
        });
        if (c.t === 'monto') {
          input.addEventListener('input', function () { var v = money.formatoEntrada(input.value); if (v !== input.value) input.value = v; });
          ctl = h('div', { class: 'entrada-grupo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true', texto: '$' }), input);
        } else ctl = input;
        f.foc = input;
        f.get = function () { return input.value; };
        f.set = function (v) { input.value = v === null || v === undefined ? '' : (c.t === 'monto' && v !== '' ? money.formatoEntrada(String(v)) : String(v)); };
      } else if (c.t === 'fecha') {
        env = envolver(c, id, false);
        var d = h('input', { type: 'date', id: id, class: 'entrada', min: c.min, max: c.max, 'aria-describedby': env.desc });
        ctl = h('div', null, d, atajos(c, d));
        f.foc = d;
        f.get = function () { return d.value; };
        f.set = function (v) { d.value = v || ''; };
      } else if (c.t === 'select') {
        env = envolver(c, id, false);
        var sel = h('select', { id: id, class: 'entrada', 'aria-describedby': env.desc });
        f.setOpciones = function (ops, valor) {
          vaciar(sel);
          ops.forEach(function (o) { sel.appendChild(h('option', { value: o.v, texto: o.t })); });
          if (valor !== undefined) sel.value = valor;
        };
        f.setOpciones(c.opciones || []);
        ctl = sel; f.foc = sel;
        f.get = function () { return sel.value; };
        f.set = function (v) { sel.value = v === null || v === undefined ? '' : v; };
      } else if (c.t === 'chips' || c.t === 'segmentado') {
        env = envolver(c, id, true);
        var grupo = h('div', { class: c.t === 'chips' ? 'chips' : 'segmentado', role: 'radiogroup', 'aria-labelledby': c.et ? id + '-et' : null, 'aria-describedby': env.desc });
        var valor = null, ops = [];
        var pintarChips = function () {
          vaciar(grupo);
          ops.forEach(function (o) {
            grupo.appendChild(h('button', {
              type: 'button', class: (c.t === 'chips' ? 'chip' : 'seg') + (o.v === valor ? ' activo' : ''), role: 'radio',
              'aria-checked': o.v === valor ? 'true' : 'false', tabindex: o.v === valor || (valor === null && o === ops[0]) ? '0' : '-1',
              onclick: function () { if (valor !== o.v) { valor = o.v; pintarChips(); grupo.dispatchEvent(new Event('change', { bubbles: true })); } }
            }, o.icono ? h('span', { 'aria-hidden': 'true', texto: o.icono + ' ' }) : null, o.t));
          });
        };
        f.setOpciones = function (nuevas, v) { ops = nuevas; valor = v !== undefined ? v : valor; pintarChips(); };
        f.setOpciones(c.opciones || [], c.valor !== undefined ? c.valor : null);
        ctl = grupo;
        f.foc = grupo;
        f.get = function () { return valor; };
        f.set = function (v) { valor = v; pintarChips(); };
      } else if (c.t === 'check') {
        env = envolver({ ayuda: c.ayuda }, id, false);
        var cb = h('input', { type: 'checkbox', id: id, 'aria-describedby': env.desc });
        ctl = h('label', { class: 'check', for: id }, cb, h('span', { texto: c.et }));
        env.et = null; f.foc = cb;
        f.get = function () { return cb.checked; };
        f.set = function (v) { cb.checked = !!v; };
      } else if (c.t === 'info') {
        env = envolver({}, id, false);
        var info = h('p', { class: 'info', id: id, 'aria-live': 'polite' });
        ctl = info; f.foc = null; f.info = true;
        f.get = function () { return undefined; };
        f.set = function (v) { info.textContent = v || ''; info.hidden = !v; };
        info.hidden = true;
      } else if (c.t === 'custom') {
        env = envolver(c, id, true);
        var cu = c.render(form, id);
        ctl = cu.el; f.foc = cu.foc || null; f.get = cu.get; f.set = cu.set; f.refrescar = cu.refrescar;
        if (f.foc && f.foc.setAttribute) f.foc.setAttribute('aria-describedby', env.desc);
      }
      f.err = env.err;
      f.wrap = h('div', { class: 'campo' + (c.clase ? ' ' + c.clase : ''), 'data-campo': c.n }, env.et, ctl, env.ay, env.err);
      if (f.foc && f.foc.setAttribute && c.t !== 'custom') f.foc.setAttribute('aria-describedby', env.desc);
      if (c.valor !== undefined && c.t !== 'chips' && c.t !== 'segmentado') f.set(c.valor);
      f.wrap.addEventListener('focusout', function () { f.tocado = true; if (form.validar) form.validar(); });
      f.wrap.addEventListener('change', function () {
        f.tocado = true;
        if (c.onchange) c.onchange(f.get(), form);
      });
      return f;
    }

    def.campos.forEach(function (c) {
      var f = construir(c);
      f.def = c; f.claves = c.claves || [c.n]; f.tocado = !!f.tocado;
      reg[c.n] = f;
      el.appendChild(f.wrap);
    });
    el.appendChild(general);

    form.datos = function () {
      var o = {};
      Object.keys(reg).forEach(function (n) { if (!reg[n].info) o[n] = reg[n].get(); });
      return o;
    };
    form.get = function (n) { return reg[n].get(); };
    form.set = function (n, v) { reg[n].set(v); };
    form.setOpciones = function (n, ops, v) { reg[n].setOpciones(ops, v); };
    form.mostrar = function (n, visible) { reg[n].wrap.hidden = !visible; };
    form.foco = function (n) { var f = reg[n] && reg[n].foc; if (f && f.focus) f.focus(); };
    form.reiniciar = function () {
      intentado = false;
      Object.keys(reg).forEach(function (n) { reg[n].tocado = false; });
      form.validar();
    };

    function pintar() {
      var usados = {};
      Object.keys(reg).forEach(function (n) {
        var f = reg[n], msg = null;
        f.claves.forEach(function (k) { usados[k] = true; if (!msg && res.errores[k]) msg = res.errores[k]; });
        var ver = !!msg && (f.tocado || intentado) && !f.wrap.hidden;
        f.err.textContent = ver ? msg : '';
        f.err.hidden = !ver;
        if (f.foc && f.foc.setAttribute) { if (ver) f.foc.setAttribute('aria-invalid', 'true'); else f.foc.removeAttribute('aria-invalid'); }
      });
      var extra = Object.keys(res.errores).filter(function (k) { return !usados[k]; }).map(function (k) { return res.errores[k]; });
      general.textContent = extra.join(' ');
      general.hidden = !extra.length;
    }

    form.validar = function () {
      var datos = form.datos();
      res = def.validar ? def.validar(datos, form) : { ok: true, errores: {}, datos: datos };
      Object.keys(reg).forEach(function (n) { if (reg[n].refrescar) reg[n].refrescar(datos, res); });
      pintar();
      if (form.onValidar) form.onValidar(res);
      return res;
    };
    form.intentar = function () {
      intentado = true;
      pintar();
      var primero = Object.keys(reg).filter(function (n) {
        return !reg[n].wrap.hidden && reg[n].claves.some(function (k) { return res.errores[k]; });
      })[0];
      if (primero) form.foco(primero);
    };
    el.addEventListener('input', function () { form.validar(); });
    el.addEventListener('change', function () { form.validar(); });
    return form;
  }

  // Formulario dentro de una hoja. o: { titulo, campos, validar, guardar, onGuardar(datos), secundario, eliminar, aviso }
  function abrirFormulario(o) {
    var hj = hoja({ titulo: o.titulo, clase: o.clase });
    var form = crearFormulario({ campos: o.campos, validar: o.validar });
    var btnGuardar = h('button', { type: 'submit', class: 'btn primario', texto: o.guardar || 'Guardar', 'aria-disabled': 'true' });
    var acciones = h('div', { class: 'acciones' });
    if (o.eliminar) acciones.appendChild(h('button', { type: 'button', class: 'btn peligro-suave', texto: o.eliminar.texto || 'Eliminar', onclick: function () { o.eliminar.fn(hj); } }));
    if (o.secundario) {
      acciones.appendChild(h('button', {
        type: 'button', class: 'btn secundario', texto: o.secundario.texto,
        onclick: function () {
          var r = form.validar();
          if (!r.ok) { form.intentar(); return; }
          o.secundario.fn(r.datos, form, hj);
        }
      }));
    }
    acciones.appendChild(btnGuardar);
    if (o.aviso) form.el.appendChild(h('p', { class: 'ayuda', texto: o.aviso }));
    form.el.appendChild(acciones);
    form.onValidar = function (r) {
      btnGuardar.setAttribute('aria-disabled', r.ok ? 'false' : 'true');
      btnGuardar.classList.toggle('inactivo', !r.ok);
    };
    form.el.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = form.validar();
      if (!r.ok) { form.intentar(); return; }
      if (o.onGuardar(r.datos, form, hj) !== false) hj.cerrar();
    });
    hj.el.appendChild(form.el);
    form.validar();
    return { hoja: hj, form: form };
  }

  function aplicarTema(tema) {
    var r = document.documentElement;
    if (tema === 'claro' || tema === 'oscuro') r.setAttribute('data-tema', tema); else r.removeAttribute('data-tema');
    var oscuro = tema === 'oscuro' || (tema !== 'claro' && root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuro ? '#0B1220' : '#1E293B');
  }

  SSP.ui = {
    h: h, vaciar: vaciar, anexar: anexar, nuevoId: nuevoId, hoja: hoja, confirmar: confirmar, toast: toast, descargar: descargar,
    tarjeta: tarjeta, seccion: seccion, barra: barra, vacio: vacio, montoEl: montoEl, iconoCat: iconoCat, fila: fila, tabs: tabs,
    crearFormulario: crearFormulario, abrirFormulario: abrirFormulario, aplicarTema: aplicarTema
  };
})(typeof window !== 'undefined' ? window : globalThis);
