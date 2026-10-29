/* SantiSinPlata · estructura de la app y pantallas Inicio, Movimientos, Reportes y Ajustes */
(function (root) {
  'use strict';
  var SSP = root.SSP;
  var ui = SSP.ui, h = ui.h, money = SSP.money, dates = SSP.dates, domain = SSP.domain, V = SSP.validators, charts = SSP.charts, store = SSP.store;

  var App = null;
  var registro = {}; // vista → función(cont) · Planear y Deudas se registran desde sus archivos
  var estadoUI = {
    vista: 'inicio',
    sub: { planear: 'presupuestos', deudas: 'deudas' },
    mov: { q: '', tipo: 'todos', cat: 'todas', rango: 'mes', limite: 80 },
    rep: { clave: 'mes', desde: '', hasta: '' }
  };

  var NAV = [
    { v: 'inicio', t: 'Inicio', i: 'home' }, { v: 'movs', t: 'Movimientos', i: 'list' }, { v: 'planear', t: 'Planear', i: 'target' },
    { v: 'deudas', t: 'Deudas', i: 'card' }, { v: 'reportes', t: 'Reportes', i: 'chart' }
  ];
  var TITULOS = { inicio: 'SantiSinPlata', movs: 'Movimientos', planear: 'Planear', deudas: 'Deudas', reportes: 'Reportes', ajustes: 'Ajustes' };
  var ORIGEN = { manual: '', recurrente: 'Recurrente', cuota: 'Pago de deuda', meta: 'Aporte a meta', compartido: 'Compartido' };

  // ---------- íconos SVG ----------
  var ICONOS = {
    home: [['path', 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10']],
    list: [['path', 'M4 6h16M4 12h16M4 18h10']],
    target: [['circle', null, { cx: 12, cy: 12, r: 9 }], ['circle', null, { cx: 12, cy: 12, r: 4.5 }]],
    card: [['rect', null, { x: 3, y: 5.5, width: 18, height: 13, rx: 2.5 }], ['path', 'M3 10h18M7 15h3']],
    chart: [['path', 'M5 20V11M12 20V4M19 20v-6']],
    ajustes: [['path', 'M4 7h9M17 7h3M4 17h3M11 17h9'], ['circle', null, { cx: 15, cy: 7, r: 2 }], ['circle', null, { cx: 9, cy: 17, r: 2 }]],
    plus: [['path', 'M12 5v14M5 12h14']],
    atras: [['path', 'M15 5l-7 7 7 7']]
  };
  function icono(nombre) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ico');
    svg.setAttribute('aria-hidden', 'true');
    ICONOS[nombre].forEach(function (p) {
      var el = document.createElementNS(ns, p[0]);
      if (p[1]) el.setAttribute('d', p[1]);
      Object.keys(p[2] || {}).forEach(function (k) { el.setAttribute(k, p[2][k]); });
      svg.appendChild(el);
    });
    return svg;
  }

  // ---------- estructura ----------
  function irA(vista, sub) {
    estadoUI.vista = vista;
    if (sub) {
      if (vista === 'planear') estadoUI.sub.planear = sub;
      if (vista === 'deudas') estadoUI.sub.deudas = sub;
    }
    renderTodo();
    window.scrollTo(0, 0);
    var cont = document.getElementById('vista');
    if (cont) cont.focus({ preventScroll: true });
  }

  function renderEncabezado() {
    var enc = ui.vaciar(document.getElementById('encabezado'));
    var est = App.estado, v = estadoUI.vista;
    var per = dates.etiquetaPeriodo(domain.periodo(est, App.hoy()), est.ajustes.diaInicioMes);
    var izq = h('div', { class: 'enc-titulo' },
      v === 'ajustes' ? h('button', { type: 'button', class: 'icono-btn claro', 'aria-label': 'Volver', onclick: function () { irA('inicio'); } }, icono('atras'))
        : h('span', { class: 'marca-h', role: 'img', 'aria-label': 'Haidiby Marketing Group' }),
      h('div', null, h('h1', { texto: TITULOS[v] }), h('p', { class: 'enc-sub', texto: v === 'ajustes' ? 'Preferencias y datos' : per })));
    var der = v === 'inicio' ? h('button', { type: 'button', class: 'icono-btn claro', 'aria-label': 'Ajustes', onclick: function () { irA('ajustes'); } }, icono('ajustes')) : null;
    enc.appendChild(h('div', { class: 'enc-fila' }, izq, der));
    if (App.aviso) enc.appendChild(h('p', { class: 'enc-aviso', role: 'status', texto: App.aviso }));
  }

  function renderNav() {
    var nav = ui.vaciar(document.getElementById('nav'));
    NAV.forEach(function (n) {
      var activo = estadoUI.vista === n.v;
      nav.appendChild(h('button', {
        type: 'button', class: 'nav-btn' + (activo ? ' activo' : ''), 'aria-current': activo ? 'page' : null, onclick: function () { irA(n.v); }
      }, icono(n.i), h('span', { texto: n.t })));
    });
  }

  function renderTodo() {
    if (!App || !App.estado) return;
    var y = window.scrollY;
    renderEncabezado();
    renderNav();
    var fab = document.getElementById('fab');
    fab.hidden = !(estadoUI.vista === 'inicio' || estadoUI.vista === 'movs');
    var cont = ui.vaciar(document.getElementById('vista'));
    (registro[estadoUI.vista] || registro.inicio)(cont);
    window.scrollTo(0, y);
  }

  // ---------- utilidades compartidas ----------
  function cat(id) { return domain.cat(App.estado, id); }

  function catOpciones(tipo, actualId, incluirSistema) {
    var uso = domain.usoCategorias(App.estado, App.hoy());
    var lista = App.estado.categorias.map(function (c, i) { return { c: c, i: i }; }).filter(function (o) {
      var c = o.c;
      return c.tipo === tipo && ((!c.archivada && (incluirSistema || !c.sistema)) || c.id === actualId);
    });
    lista.sort(function (a, b) { return (uso[b.c.id] || 0) - (uso[a.c.id] || 0) || a.i - b.i; });
    return lista.map(function (o) { return { v: o.c.id, t: o.c.nombre, icono: o.c.icono }; });
  }

  function confirmarEliminar(titulo, mensaje) {
    return ui.confirmar({ titulo: titulo, mensaje: mensaje, textoOk: 'Eliminar', peligro: true });
  }

  // ---------- registro rápido ----------
  function abrirRegistro(tx) {
    var editando = !!tx, hoy = App.hoy();
    var tipoIni = tx ? tx.tipo : 'gasto';
    var ops = catOpciones(tipoIni, tx && tx.categoriaId);
    var catIni = tx ? tx.categoriaId : (ops[0] && ops[0].v);
    ui.abrirFormulario({
      titulo: editando ? 'Editar movimiento' : 'Nuevo movimiento',
      clase: 'registro',
      campos: [
        {
          n: 'tipo', t: 'segmentado', opciones: [{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }], valor: tipoIni,
          onchange: function (v, f) { var o = catOpciones(v); f.setOpciones('categoriaId', o, o[0] && o[0].v); }
        },
        { n: 'monto', t: 'monto', et: 'Monto', placeholder: '0', valor: tx ? String(tx.monto) : '' },
        { n: 'categoriaId', t: 'chips', et: 'Categoría', opciones: ops, valor: catIni },
        { n: 'fecha', t: 'fecha', et: 'Fecha', valor: tx ? tx.fecha : hoy, min: '2000-01-01', max: dates.sumarMeses(hoy, 12), atajos: [{ t: 'Hoy', v: function () { return App.hoy(); } }, { t: 'Ayer', v: function () { return dates.sumarDias(App.hoy(), -1); } }] },
        { n: 'nota', t: 'texto', et: 'Nota (opcional)', max: 120, placeholder: 'Ej. Almuerzo con Ana', valor: tx ? tx.nota : '' }
      ],
      validar: function (raw) { return V.validarTransaccion(raw, { hoy: App.hoy(), estado: App.estado, categoriaActual: tx && tx.categoriaId }); },
      guardar: 'Guardar',
      secundario: editando ? null : {
        texto: 'Guardar y agregar otro',
        fn: function (datos, form) {
          App.commit(function (est) { domain.crearTx(est, datos); }, { mensaje: (datos.tipo === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado') + ': ' + money.format(datos.monto) });
          form.set('monto', ''); form.set('nota', '');
          form.reiniciar();
          form.foco('monto');
        }
      },
      eliminar: editando ? { texto: 'Eliminar', fn: function (hj) { eliminarMovimiento(tx, hj); } } : null,
      onGuardar: function (datos) {
        App.commit(function (est) {
          if (editando) domain.actualizarTx(est, tx.id, datos); else domain.crearTx(est, datos);
        }, { mensaje: editando ? 'Cambios guardados' : (datos.tipo === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado') + ': ' + money.format(datos.monto) });
      }
    });
  }

  function eliminarMovimiento(tx, hj) {
    var extra = tx.origen === 'meta' ? ' También se quitará ese aporte de la meta.' : tx.origen === 'cuota' ? ' También se quitará ese pago de la deuda.' : tx.origen === 'compartido' ? ' También se eliminará ese gasto compartido.' : '';
    confirmarEliminar('¿Eliminar movimiento?', money.format(tx.monto) + (tx.nota ? ' · ' + tx.nota : '') + '.' + extra).then(function (ok) {
      if (!ok) return;
      App.commit(function (est) { domain.eliminarTx(est, tx.id); }, { mensaje: 'Movimiento eliminado' });
      if (hj) hj.cerrar();
    });
  }

  function abrirEdicion(tx) {
    if (tx.origen === 'manual' || tx.origen === 'recurrente') { abrirRegistro(tx); return; }
    var c = cat(tx.categoriaId);
    var hj = ui.hoja({ titulo: ORIGEN[tx.origen] });
    var destino = tx.origen === 'meta' ? ['planear', 'metas', 'Ir a Metas'] : tx.origen === 'cuota' ? ['deudas', 'deudas', 'Ir a Deudas'] : ['deudas', 'compartidos', 'Ir a Compartidos'];
    hj.el.appendChild(h('div', { class: 'detalle' },
      h('p', { class: 'detalle-monto', texto: money.format(tx.monto) }),
      h('p', { texto: (c ? c.icono + ' ' + c.nombre : '') + ' · ' + dates.largo(tx.fecha) }),
      tx.nota ? h('p', { class: 'ayuda', texto: tx.nota }) : null,
      h('p', { class: 'ayuda', texto: 'Este movimiento se creó automáticamente, por eso no se edita aquí. Para cambiarlo, hazlo desde su sección o elimínalo.' })));
    hj.el.appendChild(h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn peligro-suave', texto: 'Eliminar', onclick: function () { eliminarMovimiento(tx, hj); } }),
      h('button', { type: 'button', class: 'btn secundario', texto: destino[2], onclick: function () { hj.cerrar(); irA(destino[0], destino[1]); } })));
  }

  function filaMov(t) {
    var c = cat(t.categoriaId);
    var origen = ORIGEN[t.origen], nombre = c ? c.nombre : '';
    return ui.fila({
      icono: ui.iconoCat(c), titulo: t.nota || nombre || 'Movimiento',
      sub: [t.nota ? nombre : '', origen].filter(Boolean).join(' · '), derecha: ui.montoEl(t.monto, t.tipo),
      onclick: function () { abrirEdicion(t); }
    });
  }

  function ordenarMovs(txs) {
    return txs.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : 0);
    });
  }

  function pieMarca() {
    return h('div', { class: 'pie-marca' },
      h('span', { class: 'logo-marca', role: 'img', 'aria-label': 'Haidiby Marketing Group' }),
      h('p', { texto: 'SantiSinPlata · una app de Haidiby Marketing Group' }));
  }

  // ---------- Inicio ----------
  registro.inicio = function (cont) {
    var est = App.estado, hoy = App.hoy(), r = domain.resumen(est, hoy);
    var nombre = est.ajustes.nombreUsuario;
    cont.appendChild(h('p', { class: 'saludo', texto: 'Hola' + (nombre ? ', ' + nombre : '') }));

    var pres = domain.estadoPresupuestos(est, hoy).filter(function (p) { return p.presupuesto.categoriaId === null; })[0];
    cont.appendChild(ui.tarjeta('principal',
      h('p', { class: 'principal-et', texto: r.balance >= 0 ? 'Te queda este mes' : 'Vas en rojo este mes' }),
      h('p', { class: 'monto-grande', texto: money.format(r.balance) }),
      h('div', { class: 'dos-col' },
        h('div', null, h('span', { class: 'mini-et', texto: 'Ingresos' }), h('strong', { class: 'mini-valor', texto: money.format(r.ingresos) })),
        h('div', null, h('span', { class: 'mini-et', texto: 'Gastos' }), h('strong', { class: 'mini-valor', texto: money.format(r.gastos) }))),
      pres ? h('div', { class: 'principal-pres' },
        h('div', { class: 'fila-dos' }, h('span', { texto: 'Presupuesto del mes' }), h('strong', { texto: Math.round(pres.pct * 100) + ' %' })),
        ui.barra(pres.pct, pres.estado, 'Presupuesto total del mes'),
        h('p', { class: 'detalle-pres', texto: money.format(pres.gastado) + ' de ' + money.format(pres.presupuesto.limiteMensual) })) : null));

    if (r.ingresos > 0) {
      cont.appendChild(h('p', { class: 'chip-info' },
        'Puedes gastar ', h('strong', { texto: '~' + money.format(r.disponibleDiario) }), ' por día',
        h('span', { class: 'chip-sub', texto: ' · quedan ' + r.diasRestantes + (r.diasRestantes === 1 ? ' día' : ' días') + (r.comprometido ? ' · ya comprometido ' + money.format(r.comprometido) : '') })));
    } else if (est.transacciones.length) {
      cont.appendChild(h('p', { class: 'chip-info suave', texto: 'Registra un ingreso de este periodo para saber cuánto puedes gastar al día.' }));
    }

    var alertas = domain.alertas(est, hoy);
    if (alertas.length) {
      var lista = h('div', { class: 'alertas', role: 'region', 'aria-label': 'Avisos' });
      alertas.slice(0, 5).forEach(function (a) {
        lista.appendChild(h('p', { class: 'alerta nivel-' + a.nivel }, h('span', { class: 'alerta-punto', 'aria-hidden': 'true' }), h('span', { texto: a.texto })));
      });
      cont.appendChild(lista);
    }

    if (r.gastos > 0) {
      cont.appendChild(ui.tarjeta('ritmo',
        h('div', null, h('span', { class: 'mini-et', texto: 'Gasto diario promedio' }), h('strong', { class: 'mini-valor', texto: money.format(r.gastoDiarioPromedio) })),
        h('div', null, h('span', { class: 'mini-et', texto: 'Proyección a fin de mes (estimado)' }), h('strong', { class: 'mini-valor', texto: money.format(r.proyeccionFinDeMes) }))));
    }

    cont.appendChild(ui.seccion('Últimos movimientos', est.transacciones.length ? { texto: 'Ver todos', fn: function () { irA('movs'); } } : null));
    var ult = ordenarMovs(est.transacciones).slice(0, 3);
    if (!ult.length) {
      cont.appendChild(ui.vacio('🧾', 'Aún no hay movimientos', 'Registra tu primer gasto o ingreso para empezar a ver en qué se te va la plata.', { texto: 'Registrar movimiento', fn: function () { abrirRegistro(); } }));
      cont.appendChild(h('p', { class: 'centro' }, h('button', { type: 'button', class: 'btn texto', texto: 'Explorar con datos de ejemplo', onclick: cargarEjemplo })));
    } else {
      cont.appendChild(h('div', { class: 'lista tarjeta' }, ult.map(filaMov)));
    }
    cont.appendChild(pieMarca());
  };

  // ---------- Movimientos ----------
  registro.movs = function (cont) {
    var est = App.estado, hoy = App.hoy(), F = estadoUI.mov;
    var q = h('input', { type: 'search', class: 'entrada', placeholder: 'Buscar por nota o categoría', 'aria-label': 'Buscar movimientos', value: F.q, oninput: function () { F.q = q.value; F.limite = 80; pintar(); } });
    function sel(etiqueta, valor, ops, alCambiar) {
      return h('select', { class: 'entrada', 'aria-label': etiqueta, onchange: function (e) { alCambiar(e.target.value); F.limite = 80; pintar(); } },
        ops.map(function (o) { return h('option', { value: o.v, texto: o.t, selected: o.v === valor }); }));
    }
    var catOps = [{ v: 'todas', t: 'Todas las categorías' }].concat(est.categorias.map(function (c) { return { v: c.id, t: c.icono + ' ' + c.nombre + (c.tipo === 'ingreso' ? ' (ingreso)' : '') }; }));
    cont.appendChild(h('div', { class: 'filtros' }, q,
      h('div', { class: 'filtros-fila' },
        sel('Periodo', F.rango, [{ v: 'mes', t: 'Este periodo' }, { v: 'anterior', t: 'Periodo anterior' }, { v: 'todo', t: 'Todo' }], function (v) { F.rango = v; }),
        sel('Tipo', F.tipo, [{ v: 'todos', t: 'Todos' }, { v: 'gasto', t: 'Gastos' }, { v: 'ingreso', t: 'Ingresos' }], function (v) { F.tipo = v; })),
      sel('Categoría', F.cat, catOps, function (v) { F.cat = v; })));
    var resumen = h('p', { class: 'resumen-lista', 'aria-live': 'polite' });
    var lista = h('div', { class: 'movs' });
    cont.appendChild(resumen);
    cont.appendChild(lista);

    function pintar() {
      var rango = F.rango === 'mes' ? domain.periodo(est, hoy) : F.rango === 'anterior' ? dates.desplazarPeriodo(hoy, est.ajustes.diaInicioMes, -1) : null;
      var nq = V.normalizar(F.q);
      var txs = est.transacciones.filter(function (t) {
        if (rango && (t.fecha < rango.desde || t.fecha > rango.hasta)) return false;
        if (F.tipo !== 'todos' && t.tipo !== F.tipo) return false;
        if (F.cat !== 'todas' && t.categoriaId !== F.cat) return false;
        if (nq) { var c = cat(t.categoriaId); if (V.normalizar(t.nota + ' ' + (c ? c.nombre : '')).indexOf(nq) < 0) return false; }
        return true;
      });
      txs = ordenarMovs(txs);
      ui.vaciar(lista);
      var ing = money.suma(txs.filter(function (t) { return t.tipo === 'ingreso'; }).map(function (t) { return t.monto; }));
      var gas = money.suma(txs.filter(function (t) { return t.tipo === 'gasto'; }).map(function (t) { return t.monto; }));
      resumen.textContent = txs.length ? txs.length + (txs.length === 1 ? ' movimiento' : ' movimientos') + ' · Ingresos ' + money.format(ing) + ' · Gastos ' + money.format(gas) : '';
      if (!txs.length) {
        lista.appendChild(est.transacciones.length
          ? ui.vacio('🔍', 'Sin resultados', 'No hay movimientos con esos filtros.')
          : ui.vacio('🧾', 'Aún no hay movimientos', 'Toca + para registrar el primero.', { texto: 'Registrar movimiento', fn: function () { abrirRegistro(); } }));
        return;
      }
      var visibles = txs.slice(0, F.limite), actual = null, grupo = null;
      visibles.forEach(function (t) {
        if (t.fecha !== actual) {
          actual = t.fecha;
          var total = money.suma(visibles.filter(function (x) { return x.fecha === actual && x.tipo === 'gasto'; }).map(function (x) { return x.monto; }));
          grupo = h('div', { class: 'grupo' },
            h('div', { class: 'grupo-enc' }, h('span', { texto: dates.etiquetaDia(actual, hoy) }), total ? h('span', { class: 'grupo-total', texto: 'Gastos ' + money.format(total) }) : null));
          lista.appendChild(grupo);
          grupo = grupo.appendChild(h('div', { class: 'tarjeta lista' }));
        }
        grupo.appendChild(filaMov(t));
      });
      if (txs.length > visibles.length) {
        lista.appendChild(h('p', { class: 'centro' }, h('button', { type: 'button', class: 'btn secundario', texto: 'Ver más (' + (txs.length - visibles.length) + ')', onclick: function () { F.limite += 80; pintar(); } })));
      }
    }
    pintar();
  };

  // ---------- Reportes ----------
  function barraRelativa(valor, max, color) {
    var b = h('div', { class: 'barra fina' }, h('div', { class: 'barra-relleno' }));
    b.firstChild.style.width = (max ? Math.min(100, valor / max * 100) : 0) + '%';
    if (color) b.firstChild.style.background = color;
    return b;
  }

  function abrirExportar() {
    var hj = ui.hoja({ titulo: 'Exportar datos' });
    hj.el.appendChild(h('p', { class: 'ayuda', texto: 'El CSV trae tus movimientos (para Excel o Google Sheets). El JSON es la copia completa para restaurar la app.' }));
    hj.el.appendChild(h('div', { class: 'lista tarjeta' },
      ui.fila({ icono: '📄', titulo: 'Movimientos (CSV)', sub: 'Se abre en Excel y Google Sheets', onclick: function () { exportar('csv'); hj.cerrar(); } }),
      ui.fila({ icono: '💾', titulo: 'Respaldo completo (JSON)', sub: 'Todo: metas, deudas, presupuestos…', onclick: function () { exportar('json'); hj.cerrar(); } })));
  }

  function exportar(tipo) {
    var hoy = App.hoy();
    if (tipo === 'csv') ui.descargar('santisinplata-' + hoy + '.csv', 'text/csv', store.exportarCSV(App.estado));
    else ui.descargar('santisinplata-respaldo-' + hoy + '.json', 'application/json', store.exportarJSON(App.estado));
    App.commit(function (est) { est.ajustes.ultimoExport = hoy; }, { mensaje: 'Archivo exportado', deshacer: false });
  }

  registro.reportes = function (cont) {
    var est = App.estado, hoy = App.hoy(), R = estadoUI.rep, dia = est.ajustes.diaInicioMes;
    if (R.clave === 'rango' && (!R.desde || !R.hasta)) { var p0 = domain.periodo(est, hoy); R.desde = p0.desde; R.hasta = hoy; }
    var rango = domain.rangoPorClave(est, R.clave, hoy, { desde: R.desde, hasta: R.hasta });

    var opciones = [{ v: 'mes', t: 'Este periodo' }, { v: 'anterior', t: 'Periodo anterior' }, { v: '3m', t: 'Últimos 3 meses' }, { v: 'anio', t: 'Este año' }, { v: 'rango', t: 'Personalizado' }];
    var selector = h('select', { class: 'entrada', 'aria-label': 'Periodo del reporte', onchange: function (e) { R.clave = e.target.value; renderTodo(); } },
      opciones.map(function (o) { return h('option', { value: o.v, texto: o.t, selected: o.v === R.clave }); }));
    cont.appendChild(h('div', { class: 'rep-barra' }, selector, h('button', { type: 'button', class: 'btn secundario', texto: 'Exportar', onclick: abrirExportar })));
    if (R.clave === 'rango') {
      var d1 = h('input', { type: 'date', class: 'entrada', 'aria-label': 'Desde', value: R.desde, min: '2000-01-01' });
      var d2 = h('input', { type: 'date', class: 'entrada', 'aria-label': 'Hasta', value: R.hasta, min: '2000-01-01' });
      var cambio = function () {
        if (!dates.esValida(d1.value) || !dates.esValida(d2.value)) return;
        if (d1.value > d2.value) { ui.toast('La fecha inicial no puede ser posterior a la final.', { error: true }); return; }
        R.desde = d1.value; R.hasta = d2.value; renderTodo();
      };
      d1.addEventListener('change', cambio); d2.addEventListener('change', cambio);
      cont.appendChild(h('div', { class: 'filtros-fila' }, d1, d2));
    }
    cont.appendChild(h('p', { class: 'rep-periodo', texto: rango.etiqueta }));

    var res = domain.resumen(est, hoy, { desde: rango.desde, hasta: rango.hasta, dias: rango.dias });
    cont.appendChild(ui.tarjeta('kpis',
      h('div', null, h('span', { class: 'mini-et', texto: 'Ingresos' }), h('strong', { class: 'mini-valor ingreso', texto: money.format(res.ingresos) })),
      h('div', null, h('span', { class: 'mini-et', texto: 'Gastos' }), h('strong', { class: 'mini-valor gasto', texto: money.format(res.gastos) })),
      h('div', null, h('span', { class: 'mini-et', texto: 'Balance' }), h('strong', { class: 'mini-valor', texto: money.format(res.balance) })),
      h('div', null, h('span', { class: 'mini-et', texto: 'Tasa de ahorro' }), h('strong', { class: 'mini-valor', texto: res.tasaAhorro === null ? '—' : Math.round(res.tasaAhorro * 100) + ' %' }))));

    var cats = domain.gastosPorCategoria(est, rango.desde, rango.hasta);
    cont.appendChild(ui.seccion('¿En qué se va la plata?'));
    if (!cats.length) {
      cont.appendChild(ui.tarjeta('', ui.vacio('📊', 'Sin gastos en este periodo', 'Cuando registres gastos verás aquí la distribución por categoría.')));
    } else {
      var agr = domain.agruparTop(cats, 6);
      cont.appendChild(ui.tarjeta('grafica',
        h('div', { class: 'dona-caja' }, charts.dona(agr, { etiqueta: 'Gastos' })),
        h('ul', { class: 'leyenda' }, agr.map(function (c) {
          var punto = h('span', { class: 'punto', 'aria-hidden': 'true' });
          punto.style.background = c.color;
          return h('li', null, punto, h('span', { class: 'ley-nombre', texto: (c.icono ? c.icono + ' ' : '') + c.nombre }), h('span', { class: 'ley-pct', texto: Math.round(c.pct * 100) + ' %' }), h('span', { class: 'ley-monto', texto: money.format(c.monto) }));
        }))));
    }

    cont.appendChild(ui.seccion('Ingresos vs. gastos · 6 meses'));
    cont.appendChild(ui.tarjeta('grafica',
      charts.barras(domain.serieMensual(est, hoy, 6)),
      h('div', { class: 'leyenda-linea' },
        h('span', { class: 'ley-chip ingreso' }, 'Ingresos'), h('span', { class: 'ley-chip gasto' }, 'Gastos'))));

    if (R.clave === 'mes' || R.clave === 'anterior') {
      var previo = { desde: rango.previo.desde, hasta: rango.previo.hasta, dias: dates.diferenciaDias(rango.previo.desde, rango.previo.hasta) + 1 };
      var actualSerie = domain.acumuladoDiario(est, { desde: rango.desde, hasta: rango.hasta, dias: rango.dias }, hoy);
      var previoSerie = domain.acumuladoDiario(est, previo, hoy);
      var n = Math.max(actualSerie.length, previoSerie.length);
      cont.appendChild(ui.seccion('Gasto acumulado'));
      cont.appendChild(ui.tarjeta('grafica',
        charts.lineas(actualSerie, previoSerie, [{ i: 0, texto: '1' }, { i: Math.floor((n - 1) / 2), texto: String(Math.floor((n - 1) / 2) + 1) }, { i: n - 1, texto: String(n) }]),
        h('div', { class: 'leyenda-linea' }, h('span', { class: 'ley-chip actual' }, 'Este periodo'), h('span', { class: 'ley-chip previa' }, 'Periodo anterior'))));
    }

    if (cats.length) {
      cont.appendChild(ui.seccion('Top 5 categorías'));
      var top = cats.slice(0, 5);
      cont.appendChild(h('div', { class: 'lista tarjeta' }, top.map(function (c) {
        return h('div', { class: 'fila fila-barra' },
          h('div', { class: 'fila-dos' }, h('span', { class: 'fila-titulo', texto: c.icono + ' ' + c.nombre }), h('span', { class: 'monto', texto: money.format(c.monto) })),
          barraRelativa(c.monto, top[0].monto, c.color));
      })));
      cont.appendChild(ui.seccion('Top 5 gastos'));
      cont.appendChild(h('div', { class: 'lista tarjeta' }, domain.topGastos(est, rango.desde, rango.hasta, 5).map(function (t) {
        var c = cat(t.categoriaId);
        return ui.fila({ icono: ui.iconoCat(c), titulo: t.nota || (c ? c.nombre : ''), sub: dates.corto(t.fecha) + ' · ' + (c ? c.nombre : ''), derecha: ui.montoEl(t.monto, 'gasto'), onclick: function () { abrirEdicion(t); } });
      })));

      var cmp = domain.comparativo(est, rango, rango.previo).slice(0, 8);
      cont.appendChild(ui.seccion('Comparativo con el periodo anterior'));
      cont.appendChild(h('div', { class: 'lista tarjeta' }, cmp.map(function (c) {
        var txt, clase = '';
        if (c.nuevo) { txt = 'nuevo'; clase = 'sube'; }
        else if (c.variacion === null) { txt = '—'; }
        else if (c.actual === 0) { txt = '↓ 100 %'; clase = 'baja'; }
        else if (c.variacion === 0) { txt = '= 0 %'; }
        else { txt = (c.variacion > 0 ? '↑ ' : '↓ ') + Math.round(Math.abs(c.variacion) * 100) + ' %'; clase = c.variacion > 0 ? 'sube' : 'baja'; }
        return ui.fila({ icono: c.icono, titulo: c.nombre, sub: 'Antes ' + money.format(c.previo), derecha: h('span', { class: 'var-col' }, h('span', { class: 'monto', texto: money.format(c.actual) }), h('span', { class: 'variacion ' + clase, texto: txt })) });
      })));
    }
  };

  // ---------- Ajustes ----------
  function cargarEjemplo() {
    var hay = App.estado.transacciones.length > 0;
    var seguir = function () {
      App.reemplazar(domain.datosEjemplo(App.hoy()), 'Datos de ejemplo cargados. Tus datos anteriores quedaron en el respaldo.');
    };
    if (!hay) { seguir(); return; }
    ui.confirmar({ titulo: 'Cargar datos de ejemplo', mensaje: 'Esto reemplaza tus datos actuales por datos ficticios. Se guarda una copia de seguridad que puedes restaurar en Ajustes.', textoOk: 'Reemplazar', peligro: true }).then(function (ok) { if (ok) seguir(); });
  }

  function textoResumen(r) {
    return r.movimientos + ' movimientos, ' + r.presupuestos + ' presupuestos, ' + r.metas + ' metas, ' + r.recurrentes + ' recurrentes, ' + r.deudas + ' deudas y ' + r.compartidos + ' gastos compartidos';
  }

  function procesarImportacion(texto) {
    var r = store.importarJSON(texto);
    if (!r.ok) {
      var hj = ui.hoja({ titulo: 'No se pudo importar' });
      hj.el.appendChild(h('p', { class: 'ayuda', texto: 'El archivo no es un respaldo válido de SantiSinPlata. Tus datos actuales no se tocaron.' }));
      hj.el.appendChild(h('ul', { class: 'errores-lista' }, r.errores.map(function (e) { return h('li', { texto: e }); })));
      return;
    }
    ui.confirmar({ titulo: 'Reemplazar tus datos', mensaje: 'El archivo trae ' + textoResumen(r.resumen) + '. Se reemplazarán tus datos actuales (antes se guarda una copia de seguridad automática).', textoOk: 'Importar', peligro: true })
      .then(function (ok) { if (ok) App.reemplazar(r.estado, 'Datos importados'); });
  }

  function abrirCategorias() {
    var hj = ui.hoja({ titulo: 'Categorías' });
    var cuerpo = h('div');
    hj.el.appendChild(cuerpo);
    function pintar() {
      ui.vaciar(cuerpo);
      cuerpo.appendChild(h('button', { type: 'button', class: 'btn primario bloque', texto: 'Nueva categoría', onclick: nueva }));
      ['gasto', 'ingreso'].forEach(function (tipo) {
        cuerpo.appendChild(ui.seccion(tipo === 'gasto' ? 'De gasto' : 'De ingreso'));
        cuerpo.appendChild(h('div', { class: 'lista tarjeta' }, App.estado.categorias.filter(function (c) { return c.tipo === tipo; }).map(function (c) {
          var acciones = h('span', { class: 'fila-acciones' });
          if (c.sistema) acciones.appendChild(h('span', { class: 'etiqueta-mini', texto: 'Sistema' }));
          else {
            acciones.appendChild(h('button', {
              type: 'button', class: 'btn texto', texto: c.archivada ? 'Restaurar' : 'Archivar',
              onclick: function () { App.commit(function (est) { domain.archivarCategoria(est, c.id, !c.archivada); }, { deshacer: false }); pintar(); }
            }));
            acciones.appendChild(h('button', {
              type: 'button', class: 'btn texto peligro-txt', texto: 'Eliminar',
              onclick: function () {
                if (domain.categoriaEnUso(App.estado, c.id)) { ui.toast('Tiene movimientos o presupuestos: archívala en lugar de eliminarla.', { error: true }); return; }
                confirmarEliminar('¿Eliminar categoría?', '«' + c.nombre + '» se eliminará.').then(function (ok) {
                  if (ok) { App.commit(function (est) { domain.eliminarCategoria(est, c.id); }, { deshacer: false }); pintar(); }
                });
              }
            }));
          }
          return ui.fila({ icono: ui.iconoCat(c), titulo: c.nombre + (c.archivada ? ' (archivada)' : ''), derecha: acciones, clase: c.archivada ? 'tenue' : '' });
        })));
      });
    }
    function nueva() {
      ui.abrirFormulario({
        titulo: 'Nueva categoría',
        campos: [
          { n: 'nombre', t: 'texto', et: 'Nombre', max: 40 },
          { n: 'tipo', t: 'segmentado', et: 'Tipo', opciones: [{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }], valor: 'gasto' },
          { n: 'icono', t: 'texto', et: 'Ícono (un emoji)', max: 8, valor: '🏷️' },
          {
            n: 'color', t: 'custom', et: 'Color',
            render: function () {
              var i = h('input', { type: 'color', class: 'entrada-color', value: '#64748B' });
              return { el: i, foc: i, get: function () { return i.value; }, set: function (v) { i.value = v; } };
            }
          }
        ],
        validar: function (raw) { return V.validarCategoria(raw, { estado: App.estado }); },
        onGuardar: function (datos) { App.commit(function (est) { domain.crearCategoria(est, datos); }, { mensaje: 'Categoría creada', deshacer: false }); pintar(); }
      });
    }
    pintar();
  }

  // Fondo de la app: foto de la fototeca o degradado de la marca. Se guarda aparte de los datos.
  function seccionFondo(cont) {
    var F = SSP.fondo, cfg = F.cargar();
    cont.appendChild(ui.seccion('Fondo de la app'));
    var velo = cfg ? cfg.velo : F.VELO_DEF;
    var vista = h('div', { class: 'fondo-vista', role: 'img', 'aria-label': cfg ? 'Vista previa del fondo actual' : 'Sin fondo personalizado' },
      h('div', { class: 'fondo-velo' }), cfg ? null : h('span', { texto: 'Sin fondo personalizado' }));
    function pintarVista(c) {
      var n = F.normalizar(c);
      vista.style.backgroundImage = !n ? 'none' : (n.tipo === 'foto' ? 'url("' + n.img + '")' : F.DEGRADADO);
      vista.style.setProperty('--velo', String((n ? n.velo : F.VELO_DEF) / 100));
    }
    pintarVista(cfg);

    var archivo = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Elegir una foto de fondo' });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      archivo.value = '';
      if (!f) return;
      ui.toast('Preparando la foto…', { ms: 2500 });
      F.procesarFoto(f).then(function (img) {
        var nuevo = { tipo: 'foto', img: img, velo: velo };
        var r = F.guardar(nuevo);
        if (!r.ok) { ui.toast(r.error === 'cuota' ? 'No hay espacio para guardar esa foto. Prueba con otra más liviana.' : 'No se pudo guardar el fondo en este navegador.', { error: true }); return; }
        F.aplicar(nuevo);
        renderTodo();
        ui.toast('Fondo actualizado.', {});
      }).catch(function (e) { ui.toast((e && e.message) || 'No se pudo usar esa foto.', { error: true }); });
    });

    var rango = h('input', { type: 'range', class: 'rango', min: '0', max: String(F.VELO_MAX), step: '5', value: String(velo), disabled: !cfg, 'aria-label': 'Qué tanto se atenúa el fondo' });
    rango.addEventListener('input', function () {
      velo = Number(rango.value);
      var c = F.cargar();
      if (c) { c.velo = velo; F.aplicar(c); pintarVista(c); }
    });
    rango.addEventListener('change', function () {
      var c = F.cargar();
      if (c) { c.velo = Number(rango.value); F.guardar(c); }
    });

    cont.appendChild(ui.tarjeta('',
      vista,
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'btn primario', texto: 'Elegir foto', onclick: function () { archivo.click(); } }),
        h('button', {
          type: 'button', class: 'btn secundario', texto: 'Degradado de la marca',
          onclick: function () { var n = { tipo: 'degradado', velo: velo }; F.guardar(n); F.aplicar(n); renderTodo(); }
        })),
      h('div', { class: 'campo' },
        h('span', { class: 'etiqueta', texto: 'Intensidad del fondo' }), rango,
        h('div', { class: 'rango-pie' }, h('span', { texto: 'Más fondo' }), h('span', { texto: 'Más legible' }))),
      cfg ? h('button', {
        type: 'button', class: 'btn texto peligro-txt', texto: 'Quitar fondo',
        onclick: function () { F.quitar(); F.aplicar(null); renderTodo(); ui.toast('Fondo quitado.', {}); }
      }) : null,
      h('p', { class: 'ayuda', texto: 'La foto se elige de la fototeca de tu celular y se reduce para ocupar poco espacio. Se guarda solo en este dispositivo y no va en los respaldos.' }),
      archivo));
  }

  registro.ajustes = function (cont) {
    var est = App.estado, a = est.ajustes;
    cont.appendChild(ui.seccion('Preferencias'));
    var form = ui.crearFormulario({
      campos: [
        { n: 'nombreUsuario', t: 'texto', et: 'Tu nombre (opcional)', max: 40, valor: a.nombreUsuario },
        { n: 'diaInicioMes', t: 'numero', et: 'Día en que empieza tu mes', ayuda: '1 = mes calendario. Si cobras el 15, pon 15 y tus reportes irán del 15 al 14 (máx. 28).', valor: String(a.diaInicioMes) },
        { n: 'tema', t: 'segmentado', et: 'Tema', opciones: [{ v: 'auto', t: 'Auto' }, { v: 'claro', t: 'Claro' }, { v: 'oscuro', t: 'Oscuro' }], valor: a.tema }
      ],
      validar: function (raw) { return V.validarAjustes(raw); }
    });
    var guardar = h('button', { type: 'submit', class: 'btn primario', texto: 'Guardar preferencias', 'aria-disabled': 'false' });
    form.onValidar = function (r) { guardar.setAttribute('aria-disabled', r.ok ? 'false' : 'true'); guardar.classList.toggle('inactivo', !r.ok); };
    form.el.appendChild(h('div', { class: 'acciones' }, guardar));
    form.el.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = form.validar();
      if (!r.ok) { form.intentar(); return; }
      App.commit(function (s) { s.ajustes.nombreUsuario = r.datos.nombreUsuario; s.ajustes.diaInicioMes = r.datos.diaInicioMes; s.ajustes.tema = r.datos.tema; }, { mensaje: 'Preferencias guardadas', deshacer: false });
      ui.aplicarTema(r.datos.tema);
    });
    cont.appendChild(ui.tarjeta('', form.el));
    form.validar();

    seccionFondo(cont);

    cont.appendChild(ui.seccion('Inicio de la app'));
    var chkIntro = h('input', { type: 'checkbox', id: 'chk-intro', checked: SSP.intro.preferenciaActiva() });
    chkIntro.addEventListener('change', function () { SSP.intro.fijarPreferencia(chkIntro.checked); });
    cont.appendChild(ui.tarjeta('',
      h('label', { class: 'check', for: 'chk-intro' }, chkIntro, h('span', { texto: 'Mostrar la animación al abrir la app' })),
      h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'btn secundario', texto: 'Ver animación', onclick: function () { SSP.intro.mostrar(); } }))));

    cont.appendChild(ui.seccion('Categorías'));
    cont.appendChild(h('div', { class: 'lista tarjeta' }, ui.fila({ icono: '🏷️', titulo: 'Administrar categorías', sub: 'Crear, archivar o eliminar', onclick: abrirCategorias })));

    cont.appendChild(ui.seccion('Tus datos'));
    var archivo = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Archivo JSON para importar' });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      if (f.size > store.MAX_IMPORT) { ui.toast('El archivo supera los 5 MB.', { error: true }); archivo.value = ''; return; }
      var lector = new FileReader();
      lector.onload = function () { procesarImportacion(String(lector.result)); };
      lector.onerror = function () { ui.toast('No se pudo leer el archivo.', { error: true }); };
      lector.readAsText(f);
      archivo.value = '';
    });
    var respaldo = App.store.leerRespaldo();
    var filas = [
      ui.fila({ icono: '📄', titulo: 'Exportar movimientos (CSV)', sub: 'Para Excel o Google Sheets', onclick: function () { exportar('csv'); } }),
      ui.fila({ icono: '💾', titulo: 'Exportar respaldo (JSON)', sub: 'Copia completa de la app', onclick: function () { exportar('json'); } }),
      ui.fila({ icono: '📥', titulo: 'Importar respaldo (JSON)', sub: 'Reemplaza los datos actuales', onclick: function () { archivo.click(); } })
    ];
    if (respaldo) filas.push(ui.fila({
      icono: '⏪', titulo: 'Restaurar copia automática', sub: textoResumen(store.resumenEstado(respaldo)),
      onclick: function () {
        ui.confirmar({ titulo: 'Restaurar copia', mensaje: 'Se reemplazarán tus datos actuales por la última copia automática.', textoOk: 'Restaurar', peligro: true })
          .then(function (ok) { if (ok) App.reemplazar(respaldo, 'Copia restaurada'); });
      }
    }));
    filas.push(ui.fila({ icono: '🧪', titulo: 'Cargar datos de ejemplo', sub: 'Para explorar la app llena', onclick: cargarEjemplo }));
    cont.appendChild(h('div', { class: 'lista tarjeta' }, filas));
    cont.appendChild(archivo);

    cont.appendChild(ui.seccion('Almacenamiento'));
    var kb = Math.max(1, Math.round(App.store.bytesUsados() / 1024));
    cont.appendChild(ui.tarjeta('nota',
      h('p', { texto: 'Usando aprox. ' + kb + ' KB de ~5.000 KB disponibles en este navegador.' }),
      h('p', { class: 'ayuda', texto: 'Tus datos viven solo en este navegador de este dispositivo. Si borras los datos del sitio, usas modo privado o desinstalas el navegador, se pierden. Exportar el JSON es tu respaldo real: hazlo de vez en cuando. No hay cifrado ni clave.' }),
      App.aviso ? h('p', { class: 'error', texto: App.aviso }) : null));

    cont.appendChild(ui.seccion('Zona de peligro'));
    cont.appendChild(h('button', {
      type: 'button', class: 'btn peligro bloque', texto: 'Borrar todos los datos',
      onclick: function () {
        ui.confirmar({ titulo: '¿Borrar todo?', mensaje: 'Se eliminarán movimientos, presupuestos, metas, deudas y todo lo demás de este dispositivo. Considera exportar un respaldo antes.', textoOk: 'Continuar', peligro: true }).then(function (ok) {
          if (!ok) return;
          ui.confirmar({ titulo: 'Confirmación final', mensaje: 'Esta acción no se puede deshacer.', textoOk: 'Borrar todo', peligro: true, escribir: 'BORRAR' }).then(function (ok2) {
            if (ok2) App.borrarTodo();
          });
        });
      }
    }));
    cont.appendChild(ui.seccion('Acerca de'));
    cont.appendChild(ui.tarjeta('acerca',
      h('span', { class: 'logo-marca', role: 'img', 'aria-label': 'Haidiby Marketing Group' }),
      h('p', { texto: 'SantiSinPlata es una app de Haidiby Marketing Group.' })));
    cont.appendChild(h('p', { class: 'version', texto: 'SantiSinPlata · versión de datos ' + domain.VERSION }));
  };

  // ---------- API ----------
  SSP.vistas = {
    registro: registro, estadoUI: estadoUI, irA: irA, render: renderTodo, icono: icono,
    montar: function (app) {
      App = app;
      var fab = document.getElementById('fab');
      ui.vaciar(fab).appendChild(icono('plus'));
      fab.addEventListener('click', function () { abrirRegistro(); });
    },
    util: {
      app: function () { return App; }, cat: cat, catOpciones: catOpciones, abrirRegistro: abrirRegistro, abrirEdicion: abrirEdicion,
      confirmarEliminar: confirmarEliminar, barraRelativa: barraRelativa, irA: irA
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
