/* SantiSinPlata · pantalla Planear: presupuestos, metas de ahorro y gastos recurrentes */
(function (root) {
  'use strict';
  var SSP = root.SSP;
  var ui = SSP.ui, h = ui.h, money = SSP.money, dates = SSP.dates, domain = SSP.domain, V = SSP.validators, charts = SSP.charts;
  var U = SSP.vistas.util, estadoUI = SSP.vistas.estadoUI;

  function A() { return U.app(); }
  var ETIQUETA_ESTADO = { ok: 'En orden', atencion: 'Atención', excedido: 'Excedido' };

  // ---------- Presupuestos ----------
  function editarPresupuesto(p) {
    var est = A().estado, editando = !!p;
    var ops = [{ v: 'total', t: '🧮 Total del mes' }].concat(est.categorias.filter(function (c) { return c.tipo === 'gasto' && !c.archivada; }).map(function (c) { return { v: c.id, t: c.icono + ' ' + c.nombre }; }));
    var usadas = {};
    est.presupuestos.forEach(function (x) { if (!p || x.id !== p.id) usadas[x.categoriaId === null ? 'total' : x.categoriaId] = true; });
    var libre = ops.filter(function (o) { return !usadas[o.v]; })[0];
    ui.abrirFormulario({
      titulo: editando ? 'Editar presupuesto' : 'Nuevo presupuesto',
      campos: [
        { n: 'categoriaId', t: 'select', et: 'Categoría', opciones: ops, valor: editando ? (p.categoriaId === null ? 'total' : p.categoriaId) : (libre ? libre.v : 'total') },
        { n: 'limiteMensual', t: 'monto', et: 'Límite mensual', valor: editando ? String(p.limiteMensual) : '' },
        { n: 'alertaPct', t: 'numero', et: 'Avisarme al llegar a (%)', ayuda: 'Entre 50 y 100. Te avisamos en Inicio cuando llegues a ese porcentaje del límite.', valor: editando ? String(p.alertaPct) : '80' }
      ],
      validar: function (raw) { return V.validarPresupuesto(raw, { estado: A().estado, editId: p && p.id }); },
      eliminar: editando ? {
        fn: function (hj) {
          U.confirmarEliminar('¿Eliminar presupuesto?', 'Tus movimientos no cambian; solo se quita el límite.').then(function (ok) {
            if (!ok) return;
            A().commit(function (s) { s.presupuestos = s.presupuestos.filter(function (x) { return x.id !== p.id; }); }, { mensaje: 'Presupuesto eliminado' });
            hj.cerrar();
          });
        }
      } : null,
      onGuardar: function (datos) {
        A().commit(function (s) {
          if (editando) { var x = domain.porId(s.presupuestos, p.id); x.categoriaId = datos.categoriaId; x.limiteMensual = datos.limiteMensual; x.alertaPct = datos.alertaPct; }
          else domain.crearPresupuesto(s, datos);
        }, { mensaje: 'Presupuesto guardado' });
      }
    });
  }

  function vistaPresupuestos(cont) {
    var est = A().estado, hoy = A().hoy();
    cont.appendChild(h('button', { type: 'button', class: 'btn primario bloque', texto: 'Nuevo presupuesto', onclick: function () { editarPresupuesto(null); } }));
    var lista = domain.estadoPresupuestos(est, hoy);
    if (!lista.length) {
      cont.appendChild(ui.vacio('🎯', 'Sin presupuestos', 'Ponle un límite mensual a una categoría (o a todo el mes) y te avisamos antes de pasarte.'));
      return;
    }
    lista.forEach(function (e) {
      var p = e.presupuesto, c = p.categoriaId ? domain.cat(est, p.categoriaId) : null;
      cont.appendChild(h('button', { type: 'button', class: 'tarjeta pres-card', onclick: function () { editarPresupuesto(p); } },
        h('div', { class: 'fila-dos' },
          h('span', { class: 'fila-titulo', texto: c ? c.icono + ' ' + c.nombre : '🧮 Total del mes' }),
          h('span', { class: 'estado-tag est-' + e.estado, texto: ETIQUETA_ESTADO[e.estado] })),
        ui.barra(e.pct, e.estado, 'Avance del presupuesto'),
        h('div', { class: 'fila-dos sub' },
          h('span', { texto: money.format(e.gastado) + ' de ' + money.format(p.limiteMensual) }),
          h('span', { texto: e.restante >= 0 ? 'Quedan ' + money.format(e.restante) : 'Te pasaste por ' + money.format(-e.restante) })),
        e.rapido ? h('p', { class: 'aviso-mini', texto: 'Vas más rápido de lo planeado para este punto del mes.' }) : null));
    });
  }

  // ---------- Metas ----------
  function aportar(id) {
    var m = domain.porId(A().estado.metas, id);
    if (!m) return;
    var s = domain.estadoMeta(m, A().hoy());
    ui.abrirFormulario({
      titulo: 'Aportar a «' + m.nombre + '»',
      campos: [
        { n: 'monto', t: 'monto', et: 'Monto del aporte', valor: s.sugeridoMensual ? String(Math.min(s.sugeridoMensual, s.faltante)) : '', ayuda: s.faltante ? 'Faltan ' + money.format(s.faltante) + ' para la meta.' : null },
        { n: 'fecha', t: 'fecha', et: 'Fecha', valor: A().hoy(), min: '2000-01-01', max: dates.sumarMeses(A().hoy(), 12), atajos: [{ t: 'Hoy', v: function () { return A().hoy(); } }] }
      ],
      aviso: 'El aporte cuenta como una salida de dinero (categoría Ahorro) en tus movimientos.',
      validar: function (raw) { return V.validarAporte(raw, { hoy: A().hoy(), estado: A().estado }); },
      guardar: 'Aportar',
      onGuardar: function (datos) {
        var cumple = s.ahorrado + datos.monto >= m.objetivo && s.estado !== 'completada';
        A().commit(function (est) { domain.agregarAporte(est, id, datos); }, { mensaje: cumple ? '🎉 ¡Meta cumplida!' : 'Aporte guardado: ' + money.format(datos.monto) });
      }
    });
  }

  function editarMeta(m) {
    var editando = !!m;
    ui.abrirFormulario({
      titulo: editando ? 'Editar meta' : 'Nueva meta de ahorro',
      campos: [
        { n: 'nombre', t: 'texto', et: 'Nombre', max: 40, placeholder: 'Ej. Viaje a San Andrés', valor: editando ? m.nombre : '' },
        { n: 'objetivo', t: 'monto', et: 'Objetivo', valor: editando ? String(m.objetivo) : '' },
        { n: 'fechaLimite', t: 'fecha', et: 'Fecha límite (opcional)', valor: editando && m.fechaLimite ? m.fechaLimite : '', min: dates.sumarDias(A().hoy(), 1), max: dates.sumarMeses(A().hoy(), 12), atajos: [{ t: 'Sin fecha', v: '' }, { t: 'En 6 meses', v: function () { return dates.sumarMeses(A().hoy(), 6); } }, { t: 'En 1 año', v: function () { return dates.sumarMeses(A().hoy(), 12); } }] }
      ],
      validar: function (raw) { return V.validarMeta(raw, { hoy: A().hoy(), estado: A().estado }); },
      onGuardar: function (datos) {
        A().commit(function (est) {
          if (editando) { var x = domain.porId(est.metas, m.id); x.nombre = datos.nombre; x.objetivo = datos.objetivo; x.fechaLimite = datos.fechaLimite; domain.sincronizarMetas(est); }
          else domain.crearMeta(est, datos);
        }, { mensaje: 'Meta guardada' });
      }
    });
  }

  function detalleMeta(id) {
    var hj = ui.hoja({ titulo: 'Meta de ahorro' });
    var cuerpo = h('div');
    hj.el.appendChild(cuerpo);
    function pintar() {
      var m = domain.porId(A().estado.metas, id);
      if (!m) { hj.cerrar(); return; }
      var s = domain.estadoMeta(m, A().hoy());
      ui.vaciar(cuerpo);
      cuerpo.appendChild(h('div', { class: 'detalle' },
        h('p', { class: 'detalle-titulo', texto: m.nombre }),
        h('p', { class: 'detalle-monto', texto: money.format(s.ahorrado) }),
        h('p', { class: 'ayuda', texto: 'de ' + money.format(m.objetivo) + (m.fechaLimite ? ' · hasta ' + dates.largo(m.fechaLimite) : '') })));
      cuerpo.appendChild(ui.seccion('Aportes'));
      if (!m.aportes.length) cuerpo.appendChild(h('p', { class: 'ayuda', texto: 'Aún no hay aportes.' }));
      else {
        cuerpo.appendChild(h('div', { class: 'lista tarjeta' }, m.aportes.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).map(function (a) {
          return ui.fila({
            icono: '🐖', titulo: money.format(a.monto), sub: dates.largo(a.fecha),
            derecha: h('button', {
              type: 'button', class: 'btn texto peligro-txt', texto: 'Quitar',
              onclick: function () {
                U.confirmarEliminar('¿Quitar aporte?', 'Se quitan ' + money.format(a.monto) + ' de la meta y también el gasto de Ahorro asociado.').then(function (ok) {
                  if (!ok) return;
                  A().commit(function (est) { domain.quitarAporte(est, id, a.id); }, { mensaje: 'Aporte eliminado' });
                  pintar();
                });
              }
            })
          });
        })));
      }
      cuerpo.appendChild(h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'btn peligro-suave', texto: 'Eliminar meta', onclick: function () {
          U.confirmarEliminar('¿Eliminar meta?', 'Los aportes ya registrados se conservan como gastos de Ahorro en tus movimientos.').then(function (ok) {
            if (!ok) return;
            A().commit(function (est) { est.metas = est.metas.filter(function (x) { return x.id !== id; }); }, { mensaje: 'Meta eliminada' });
            hj.cerrar();
          });
        } }),
        h('button', { type: 'button', class: 'btn secundario', texto: 'Editar', onclick: function () { editarMeta(domain.porId(A().estado.metas, id)); hj.cerrar(); } })));
    }
    pintar();
  }

  function vistaMetas(cont) {
    var est = A().estado, hoy = A().hoy();
    cont.appendChild(h('button', { type: 'button', class: 'btn primario bloque', texto: 'Nueva meta', onclick: function () { editarMeta(null); } }));
    var metas = est.metas.filter(function (m) { return !m.archivada; });
    if (!metas.length) {
      cont.appendChild(ui.vacio('🐖', 'Sin metas todavía', 'Define algo para lo que quieras ahorrar y registra tus aportes.'));
      return;
    }
    metas.forEach(function (m) {
      var s = domain.estadoMeta(m, hoy);
      var lineas = [];
      if (s.estado === 'completada') lineas.push('¡Meta cumplida!');
      else {
        lineas.push('Faltan ' + money.format(s.faltante));
        if (s.estado === 'atrasada') lineas.push('Pasó la fecha límite (' + dates.corto(m.fechaLimite) + ')');
        else if (m.fechaLimite) lineas.push('Hasta ' + dates.largo(m.fechaLimite));
        if (s.sugeridoMensual) lineas.push('Aporte sugerido: ' + money.format(s.sugeridoMensual) + ' al mes');
      }
      cont.appendChild(ui.tarjeta('meta',
        h('div', { class: 'meta-top' },
          charts.anillo(s.pct, s.estado === 'completada' ? 'dorado' : (s.estado === 'atrasada' ? 'alerta' : 'primario'), m.nombre),
          h('div', { class: 'meta-datos' },
            h('p', { class: 'fila-titulo', texto: m.nombre }),
            h('p', { class: 'sub', texto: money.format(s.ahorrado) + ' de ' + money.format(m.objetivo) }),
            lineas.map(function (l, i) { return h('p', { class: 'ayuda' + (i === 0 && s.estado === 'completada' ? ' ok' : ''), texto: l }); }))),
        h('div', { class: 'acciones' },
          h('button', { type: 'button', class: 'btn secundario', texto: 'Detalle', onclick: function () { detalleMeta(m.id); } }),
          s.estado === 'completada' ? null : h('button', { type: 'button', class: 'btn primario', texto: 'Aportar', onclick: function () { aportar(m.id); } }))));
    });
  }

  // ---------- Recurrentes ----------
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function editarRecurrente(r) {
    var editando = !!r, hoy = A().hoy();
    var tipoIni = editando ? r.tipo : 'gasto';
    var ops = U.catOpciones(tipoIni, editando && r.categoriaId);
    var ctrl = ui.abrirFormulario({
      titulo: editando ? 'Editar recurrente' : 'Nuevo gasto o ingreso recurrente',
      campos: [
        { n: 'tipo', t: 'segmentado', opciones: [{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }], valor: tipoIni, onchange: function (v, f) { var o = U.catOpciones(v); f.setOpciones('categoriaId', o, o[0] && o[0].v); } },
        { n: 'nota', t: 'texto', et: 'Nombre', max: 120, placeholder: 'Ej. Arriendo, Netflix, Salario', valor: editando ? r.nota : '' },
        { n: 'monto', t: 'monto', et: 'Monto', valor: editando ? String(r.monto) : '' },
        { n: 'categoriaId', t: 'chips', et: 'Categoría', opciones: ops, valor: editando ? r.categoriaId : (ops[0] && ops[0].v) },
        {
          n: 'frecuencia', t: 'select', et: 'Se repite', valor: editando ? r.frecuencia : 'mensual',
          opciones: [{ v: 'mensual', t: 'Cada mes' }, { v: 'quincenal', t: 'Cada quincena (15 y fin de mes)' }, { v: 'semanal', t: 'Cada semana' }, { v: 'anual', t: 'Cada año' }],
          onchange: function () { vis(); }
        },
        { n: 'diaDelMes', t: 'numero', et: 'Día del mes (1–31)', ayuda: 'Si el mes tiene menos días, se usa el último.', valor: String(editando && r.diaDelMes ? r.diaDelMes : dates.partes(hoy).d) },
        { n: 'diaSemana', t: 'select', et: 'Día de la semana', valor: String(editando && r.diaSemana !== null ? r.diaSemana : 1), opciones: DIAS.map(function (d, i) { return { v: String(i), t: d }; }) },
        { n: 'inicio', t: 'fecha', et: 'Desde', valor: editando ? r.inicio : hoy, min: '2000-01-01', max: dates.sumarMeses(hoy, 12), ayuda: 'Se registran los movimientos desde esta fecha; si es del pasado, se crean los atrasados.' },
        { n: 'fin', t: 'fecha', et: 'Hasta (opcional)', valor: editando && r.fin ? r.fin : '', min: '2000-01-01', atajos: [{ t: 'Sin fin', v: '' }] }
      ].concat(editando ? [{ n: 'activa', t: 'check', et: 'Regla activa (desmárcala para pausarla)', valor: r.activa }] : []),
      validar: function (raw) { return V.validarRecurrente(raw, { hoy: A().hoy(), estado: A().estado }); },
      eliminar: editando ? {
        fn: function (hj) {
          U.confirmarEliminar('¿Eliminar regla?', 'Los movimientos que ya se crearon se conservan.').then(function (ok) {
            if (!ok) return;
            A().commit(function (s) { s.recurrentes = s.recurrentes.filter(function (x) { return x.id !== r.id; }); }, { mensaje: 'Regla eliminada' });
            hj.cerrar();
          });
        }
      } : null,
      onGuardar: function (datos, form) {
        var activa = editando ? form.get('activa') : true;
        A().commit(function (s) {
          if (editando) {
            var x = domain.porId(s.recurrentes, r.id);
            ['tipo', 'monto', 'categoriaId', 'nota', 'frecuencia', 'diaDelMes', 'diaSemana', 'inicio', 'fin'].forEach(function (k) { x[k] = datos[k]; });
            if (activa !== x.activa) domain.alternarRecurrente(s, x.id, A().hoy());
          } else domain.crearRecurrente(s, datos);
          domain.materializarRecurrentes(s, A().hoy());
        }, { mensaje: 'Recurrente guardado' });
      }
    });
    function vis() {
      var f = ctrl.form.get('frecuencia');
      ctrl.form.mostrar('diaDelMes', f === 'mensual');
      ctrl.form.mostrar('diaSemana', f === 'semanal');
    }
    vis();
  }

  function vistaRecurrentes(cont) {
    var est = A().estado, hoy = A().hoy();
    cont.appendChild(h('button', { type: 'button', class: 'btn primario bloque', texto: 'Nuevo recurrente', onclick: function () { editarRecurrente(null); } }));
    if (!est.recurrentes.length) {
      cont.appendChild(ui.vacio('🔁', 'Sin recurrentes', 'Arriendo, suscripciones, salario… se registran solos en su fecha.'));
      return;
    }
    cont.appendChild(h('div', { class: 'lista tarjeta' }, est.recurrentes.map(function (r) {
      var c = domain.cat(est, r.categoriaId), prox = r.activa ? domain.proximaOcurrencia(r, hoy) : null;
      var estado = !r.activa ? 'Pausada' : (prox ? 'Próxima: ' + dates.etiquetaDia(prox, hoy).toLowerCase() : 'Sin próximas fechas');
      return ui.fila({
        icono: ui.iconoCat(c), titulo: r.nota, sub: domain.textoFrecuencia(r) + ' · ' + estado,
        derecha: ui.montoEl(r.monto, r.tipo), onclick: function () { editarRecurrente(r); }, clase: r.activa ? '' : 'tenue'
      });
    })));
  }

  var SUBS = { presupuestos: vistaPresupuestos, metas: vistaMetas, recurrentes: vistaRecurrentes };

  SSP.vistas.registro.planear = function (cont) {
    var sub = estadoUI.sub.planear;
    cont.appendChild(ui.tabs([{ v: 'presupuestos', t: 'Presupuestos' }, { v: 'metas', t: 'Metas' }, { v: 'recurrentes', t: 'Recurrentes' }], sub, function (v) { estadoUI.sub.planear = v; SSP.vistas.render(); }, 'Secciones de Planear'));
    (SUBS[sub] || vistaPresupuestos)(cont);
  };
})(typeof window !== 'undefined' ? window : globalThis);
