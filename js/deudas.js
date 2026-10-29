/* SantiSinPlata · pantalla Deudas: deudas y cuotas, y gastos compartidos */
(function (root) {
  'use strict';
  var SSP = root.SSP;
  var ui = SSP.ui, h = ui.h, money = SSP.money, dates = SSP.dates, domain = SSP.domain, V = SSP.validators;
  var U = SSP.vistas.util, estadoUI = SSP.vistas.estadoUI;

  function A() { return U.app(); }

  // ---------- Deudas ----------
  function registrarPago(id, tipoInicial) {
    var d0 = domain.porId(A().estado.deudas, id);
    if (!d0) return;
    var hoy = A().hoy(), conCuotas = d0.tipo === 'cuotas';
    function datosDe(tipo) {
      var d = domain.porId(A().estado.deudas, id), e = domain.estadoDeuda(d, A().hoy());
      return { d: d, e: e, extra: tipo === 'extra' || d.tipo === 'libre' };
    }
    function resumenTexto(tipo) {
      var x = datosDe(tipo), e = x.e;
      var t = 'Saldo pendiente ' + money.format(e.saldo);
      if (conCuotas && !x.extra) t += ' · Interés de este periodo ' + money.format(e.interesPeriodo) + ' · Máximo ' + money.format(e.maxPagoCuota);
      else t += ' · Máximo ' + money.format(e.maxPagoExtra);
      return t;
    }
    function sugerido(tipo) {
      var x = datosDe(tipo);
      return !x.extra && x.e.cuotaSugerida ? String(x.e.cuotaSugerida) : '';
    }
    var ini = conCuotas ? (tipoInicial || 'cuota') : 'cuota';
    var campos = [];
    if (conCuotas) {
      campos.push({
        n: 'tipo', t: 'segmentado', et: 'Tipo de pago', opciones: [{ v: 'cuota', t: 'Cuota' }, { v: 'extra', t: 'Abono extra' }], valor: ini,
        onchange: function (v, f) { f.set('monto', sugerido(v)); f.set('resumen', resumenTexto(v)); }
      });
    }
    campos.push({ n: 'monto', t: 'monto', et: 'Monto del pago', valor: sugerido(ini) });
    campos.push({ n: 'fecha', t: 'fecha', et: 'Fecha del pago', valor: hoy, min: '2000-01-01', max: dates.sumarMeses(hoy, 12), atajos: [{ t: 'Hoy', v: function () { return A().hoy(); } }] });
    campos.push({ n: 'resumen', t: 'info', valor: resumenTexto(ini) });
    ui.abrirFormulario({
      titulo: 'Pago · ' + d0.nombre,
      campos: campos,
      aviso: 'El pago se registra como gasto en la categoría Deudas. Un abono extra baja el capital y acorta el plan.',
      validar: function (raw) {
        var tipo = conCuotas ? raw.tipo : 'cuota', x = datosDe(tipo);
        return V.validarPago({ monto: raw.monto, fecha: raw.fecha, tipo: tipo }, {
          hoy: A().hoy(), estado: A().estado,
          maxPago: x.extra ? x.e.maxPagoExtra : x.e.maxPagoCuota,
          minPago: !x.extra && conCuotas ? x.e.interesPeriodo : 0
        });
      },
      guardar: 'Registrar pago',
      onGuardar: function (datos) {
        var e = datosDe(datos.tipo).e, salda = datos.monto >= (datos.tipo === 'extra' || !conCuotas ? e.maxPagoExtra : e.maxPagoCuota);
        A().commit(function (est) { domain.registrarPago(est, id, datos); }, { mensaje: salda ? '🎉 ¡Deuda saldada!' : 'Pago registrado: ' + money.format(datos.monto) });
      }
    });
  }

  function nuevaDeuda() {
    var hoy = A().hoy();
    var ctrl = ui.abrirFormulario({
      titulo: 'Nueva deuda',
      campos: [
        { n: 'nombre', t: 'texto', et: 'Nombre', max: 40, placeholder: 'Ej. Crédito moto, Tarjeta' },
        { n: 'acreedor', t: 'texto', et: 'A quién le debes (opcional)', max: 40 },
        { n: 'tipo', t: 'segmentado', et: 'Tipo', opciones: [{ v: 'cuotas', t: 'Con cuotas' }, { v: 'libre', t: 'Sin plan fijo' }], valor: 'cuotas', onchange: function () { vis(); } },
        { n: 'capitalInicial', t: 'monto', et: 'Valor de la deuda (capital)' },
        { n: 'tasaMensualPct', t: 'decimal', et: 'Interés mensual (%)', ayuda: '0 si no cobra interés. Ej. 1,8', valor: '0' },
        { n: 'numCuotas', t: 'numero', et: 'Número de cuotas', placeholder: 'Ej. 24' },
        { n: 'valorCuota', t: 'monto', et: 'Valor de la cuota (opcional)', ayuda: 'Déjalo vacío y la calculamos con el sistema de cuota fija.' },
        { n: 'primeraCuota', t: 'fecha', et: 'Fecha de la primera cuota', valor: dates.sumarMeses(hoy, 1), min: '2000-01-01', max: dates.sumarMeses(hoy, 12), ayuda: 'El día de esta fecha será tu día de pago cada mes.' },
        { n: 'estimado', t: 'info' }
      ],
      validar: function (raw, form) {
        var res = V.validarDeuda(raw, { hoy: A().hoy(), estado: A().estado });
        var txt = '';
        if (raw.tipo === 'cuotas' && res.ok && res.datos.capitalInicial) {
          var dd = res.datos, cuota = dd.valorCuota > 0 ? dd.valorCuota : domain.cuotaFrancesa(dd.capitalInicial, dd.tasaMensualPct, dd.numCuotas);
          var tabla = domain.tablaAmortizacion(dd.capitalInicial, dd.tasaMensualPct, dd.numCuotas);
          var interesTotal = dd.valorCuota > 0 ? null : money.suma(tabla.map(function (f) { return f.interes; }));
          txt = 'Cuota estimada: ' + money.format(cuota) + (interesTotal !== null ? ' · Intereses totales: ' + money.format(interesTotal) : '');
        }
        if (form) form.set('estimado', txt);
        return res;
      },
      guardar: 'Crear deuda',
      onGuardar: function (datos) {
        A().commit(function (est) { domain.crearDeuda(est, datos); }, { mensaje: 'Deuda creada' });
      }
    });
    function vis() {
      var c = ctrl.form.get('tipo') === 'cuotas';
      ['tasaMensualPct', 'numCuotas', 'valorCuota', 'primeraCuota', 'estimado'].forEach(function (n) { ctrl.form.mostrar(n, c); });
    }
    vis();
  }

  // En la tabla se omite el "$" de cada cifra para que quepan las 6 columnas en el celular
  function num(n) { return money.format(n).replace('$\u00a0', ''); }

  function tablaPlan(filas) {
    var cab = ['Nº', 'Fecha', 'Cuota', 'Interés', 'Capital', 'Saldo'];
    return h('div', { class: 'tabla-caja', tabindex: '0', role: 'region', 'aria-label': 'Plan de pagos' },
      h('table', { class: 'tabla' },
        h('thead', null, h('tr', null, cab.map(function (c) { return h('th', { scope: 'col', texto: c }); }))),
        h('tbody', null, filas.map(function (f) {
          return h('tr', null, h('td', { texto: String(f.n) }), h('td', { texto: dates.corto(f.fecha) + ' ' + String(dates.partes(f.fecha).y).slice(2) }),
            h('td', { texto: num(f.cuota) }), h('td', { texto: num(f.interes) }), h('td', { texto: num(f.capital) }), h('td', { texto: num(f.saldo) }));
        }))));
  }

  function detalleDeuda(id) {
    var hj = ui.hoja({ titulo: 'Detalle de la deuda' });
    var cuerpo = h('div');
    hj.el.appendChild(cuerpo);
    var verTodo = false;
    function pintar() {
      var d = domain.porId(A().estado.deudas, id);
      if (!d) { hj.cerrar(); return; }
      var hoy = A().hoy(), e = domain.estadoDeuda(d, hoy), cuotas = d.tipo === 'cuotas';
      ui.vaciar(cuerpo);
      cuerpo.appendChild(h('div', { class: 'detalle' },
        h('p', { class: 'detalle-titulo', texto: d.nombre + (d.acreedor ? ' · ' + d.acreedor : '') }),
        h('p', { class: 'detalle-monto', texto: money.format(e.saldo) }),
        h('p', { class: 'ayuda', texto: 'saldo pendiente de ' + money.format(d.capitalInicial) + (cuotas && d.tasaMensualPct ? ' · ' + String(d.tasaMensualPct).replace('.', ',') + ' % mensual' : '') }),
        ui.barra(e.pctPagado, e.vencida ? 'excedido' : 'ok', 'Avance de pago'),
        e.saldada ? h('p', { class: 'ayuda ok', texto: '¡Deuda saldada!' })
          : (cuotas && e.proxima ? h('p', { class: 'ayuda' + (e.vencida ? ' vencida' : ''), texto: 'Cuota ' + e.proxima.n + ' de ' + e.cuotasTotales + ' · ' + (e.vencida ? 'venció el ' : 'vence el ') + dates.largo(e.proxima.fecha) + ' · ' + money.format(e.proxima.cuota) } ) : null)));
      if (!e.saldada) {
        cuerpo.appendChild(h('div', { class: 'acciones' },
          cuotas ? h('button', { type: 'button', class: 'btn secundario', texto: 'Abono extra', onclick: function () { registrarPago(id, 'extra'); } }) : null,
          h('button', { type: 'button', class: 'btn primario', texto: cuotas ? 'Registrar cuota' : 'Registrar pago', onclick: function () { registrarPago(id, 'cuota'); } })));
      }
      if (cuotas && e.plan.length) {
        cuerpo.appendChild(ui.seccion('Plan de pagos (en pesos)', e.plan.length > 12 ? { texto: verTodo ? 'Ver menos' : 'Ver todo (' + e.plan.length + ')', fn: function () { verTodo = !verTodo; pintar(); } } : null));
        cuerpo.appendChild(tablaPlan(verTodo ? e.plan : e.plan.slice(0, 12)));
        cuerpo.appendChild(h('p', { class: 'ayuda', texto: 'La última cuota se ajusta unos pesos para cerrar el saldo exactamente en cero.' }));
      }
      cuerpo.appendChild(ui.seccion('Pagos registrados'));
      if (!e.historial.length) cuerpo.appendChild(h('p', { class: 'ayuda', texto: 'Aún no hay pagos.' }));
      else {
        cuerpo.appendChild(h('div', { class: 'lista tarjeta' }, e.historial.slice().reverse().map(function (f) {
          var p = f.pago;
          return ui.fila({
            icono: p.tipo === 'extra' ? '⚡' : '✅', titulo: money.format(p.monto) + (p.tipo === 'extra' ? ' · abono extra' : ''),
            sub: dates.largo(p.fecha) + (f.interes ? ' · interés ' + money.format(f.interes) : '') + ' · saldo ' + money.format(f.saldo),
            derecha: h('button', {
              type: 'button', class: 'btn texto peligro-txt', texto: 'Quitar',
              onclick: function () {
                U.confirmarEliminar('¿Quitar pago?', 'Se quita este pago de ' + money.format(p.monto) + ' y también el gasto asociado.').then(function (ok) {
                  if (!ok) return;
                  A().commit(function (est) { domain.eliminarPago(est, id, p.id); }, { mensaje: 'Pago eliminado' });
                  pintar();
                });
              }
            })
          });
        })));
      }
      cuerpo.appendChild(h('div', { class: 'acciones' }, h('button', {
        type: 'button', class: 'btn peligro-suave', texto: 'Eliminar deuda',
        onclick: function () {
          U.confirmarEliminar('¿Eliminar deuda?', 'Se borra la deuda. Los pagos ya registrados se conservan como gastos en tus movimientos.').then(function (ok) {
            if (!ok) return;
            A().commit(function (est) { est.deudas = est.deudas.filter(function (x) { return x.id !== id; }); }, { mensaje: 'Deuda eliminada' });
            hj.cerrar();
          });
        }
      })));
    }
    pintar();
  }

  function vistaDeudas(cont) {
    var est = A().estado, hoy = A().hoy(), rs = domain.resumenDeudas(est, hoy);
    cont.appendChild(ui.tarjeta('principal',
      h('p', { class: 'principal-et', texto: 'Deuda total' }),
      h('p', { class: 'monto-grande', texto: money.format(rs.deudaTotal) }),
      h('div', { class: 'dos-col' },
        h('div', null, h('span', { class: 'mini-et', texto: 'Pagado este periodo' }), h('strong', { class: 'mini-valor', texto: money.format(rs.pagosDelMes) })),
        h('div', null, h('span', { class: 'mini-et', texto: 'Próximo pago' }), h('strong', { class: 'mini-valor', texto: rs.proxima ? dates.corto(rs.proxima.fecha) + ' · ' + money.format(rs.proxima.cuota) : '—' })))));
    cont.appendChild(h('button', { type: 'button', class: 'btn primario bloque', texto: 'Nueva deuda', onclick: nuevaDeuda }));
    var deudas = est.deudas.filter(function (d) { return !d.archivada; });
    if (!deudas.length) {
      cont.appendChild(ui.vacio('💳', 'Sin deudas registradas', 'Registra créditos, tarjetas o compras a cuotas para saber cuánto debes y cuándo pagar.'));
      return;
    }
    deudas.forEach(function (d) {
      var e = domain.estadoDeuda(d, hoy), cuotas = d.tipo === 'cuotas';
      var linea = e.saldada ? 'Saldada' : cuotas ? 'Cuota ' + e.proxima.n + ' de ' + e.cuotasTotales + ' · ' + (e.vencida ? 'venció ' : 'próxima ') + dates.corto(e.proxima.fecha) + ' · ' + money.format(e.proxima.cuota)
        : 'Pagado ' + money.format(e.pagado) + ' de ' + money.format(d.capitalInicial);
      cont.appendChild(h('div', { class: 'tarjeta deuda-card' },
        h('button', { type: 'button', class: 'tarjeta-click', onclick: function () { detalleDeuda(d.id); }, 'aria-label': 'Ver detalle de ' + d.nombre },
          h('div', { class: 'fila-dos' }, h('span', { class: 'fila-titulo', texto: d.nombre }),
            e.saldada ? h('span', { class: 'estado-tag est-ok', texto: 'Saldada' }) : (e.vencida ? h('span', { class: 'estado-tag est-excedido', texto: 'Vencida' }) : null)),
          d.acreedor ? h('p', { class: 'sub', texto: d.acreedor }) : null,
          h('p', { class: 'monto-medio', texto: money.format(e.saldo) }),
          ui.barra(e.pctPagado, e.vencida ? 'excedido' : 'ok', 'Avance de pago de ' + d.nombre),
          h('p', { class: 'sub' + (e.vencida ? ' vencida' : ''), texto: linea })),
        e.saldada ? null : h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'btn primario', texto: cuotas ? 'Registrar cuota' : 'Registrar pago', onclick: function () { registrarPago(d.id, 'cuota'); } }))));
    });
  }

  // ---------- Compartidos ----------
  function opsPersonas() {
    return [{ v: 'yo', t: 'Yo' }].concat(A().estado.personas.map(function (p) { return { v: p.id, t: p.nombre }; }));
  }

  function agregarPersona(alCrear) {
    ui.abrirFormulario({
      titulo: 'Agregar persona',
      campos: [{ n: 'nombre', t: 'texto', et: 'Nombre', max: 40, placeholder: 'Ej. Ana' }],
      validar: function (raw) { return V.validarPersona(raw, { estado: A().estado }); },
      onGuardar: function (datos) {
        var id = null;
        A().commit(function (est) { id = domain.crearPersona(est, datos).id; }, { mensaje: datos.nombre + ' agregado/a', deshacer: false });
        if (alCrear && id) alCrear(id);
      }
    });
  }

  // Calcula la parte de cada participante según el modo; devuelve { partes, err }
  function calcularPartes(raw) {
    var p = raw.participantes, total = money.parse(raw.total), ids = p.sel, partes = ids.map(function () { return null; }), err = null;
    if (total && ids.length) {
      if (p.modo === 'igual') partes = money.repartir(total, ids.length);
      else if (p.modo === 'exacto') {
        partes = ids.map(function (id) {
          var v = p.valores[id];
          if (v === undefined || String(v).trim() === '') return 0;
          return money.parse(v);
        });
      } else {
        var pc = ids.map(function (id) {
          var s = String(p.valores[id] === undefined ? '' : p.valores[id]).replace(',', '.').trim();
          var n = s === '' ? 0 : Number(s);
          return isFinite(n) && n >= 0 && n <= 100 ? n : NaN;
        });
        var suma = pc.reduce(function (a, b) { return a + b; }, 0);
        if (pc.some(isNaN)) err = 'Revisa los porcentajes (números entre 0 y 100).';
        else if (Math.abs(suma - 100) > 1e-9) err = 'Los porcentajes deben sumar 100 % (ahora suman ' + String(Math.round(suma * 100) / 100).replace('.', ',') + ' %).';
        else partes = money.repartirPorcentajes(total, pc);
      }
    }
    return { partes: partes, err: err };
  }

  function campoParticipantes() {
    return function (form, fid) {
      var seleccion = { yo: true }, modo = 'igual', valores = {}, filas = {};
      var lista = h('div', { class: 'part-lista' });
      var ayudaEl = h('p', { class: 'ayuda', 'aria-live': 'polite' });
      var segmento = h('div', { class: 'segmentado', role: 'radiogroup', 'aria-label': 'Cómo dividir' });
      var caja = h('div', { class: 'participantes' }, segmento, lista, ayudaEl,
        h('button', { type: 'button', class: 'btn texto', texto: '＋ Agregar persona', onclick: function () { agregarPersona(function (id) { seleccion[id] = true; construir(); avisar(); form.setOpciones('pagadoPor', opsPersonas(), form.get('pagadoPor')); }); } }));

      function avisar() { caja.dispatchEvent(new Event('change', { bubbles: true })); }

      function pintarModos() {
        ui.vaciar(segmento);
        [['igual', 'Igual'], ['exacto', 'Montos'], ['porcentaje', 'Porcentajes']].forEach(function (m) {
          segmento.appendChild(h('button', {
            type: 'button', class: 'seg' + (modo === m[0] ? ' activo' : ''), role: 'radio', 'aria-checked': modo === m[0] ? 'true' : 'false',
            onclick: function () { modo = m[0]; pintarModos(); vis(); avisar(); }
          }, m[1]));
        });
      }

      function vis() {
        Object.keys(filas).forEach(function (id) {
          var f = filas[id], on = !!seleccion[id];
          f.inp.hidden = !(on && modo !== 'igual');
          f.inp.setAttribute('inputmode', modo === 'porcentaje' ? 'decimal' : 'numeric');
          f.inp.setAttribute('aria-label', 'Parte de ' + f.nombre + (modo === 'porcentaje' ? ' en %' : ' en pesos'));
          f.inp.placeholder = modo === 'porcentaje' ? '%' : '$';
          f.parte.hidden = !on;
        });
      }

      function construir() {
        ui.vaciar(lista);
        filas = {};
        [{ id: 'yo', nombre: 'Yo' }].concat(A().estado.personas).forEach(function (p) {
          var cid = fid + '-p-' + p.id;
          var cb = h('input', { type: 'checkbox', id: cid, checked: !!seleccion[p.id], onchange: function () { seleccion[p.id] = cb.checked; vis(); } });
          var inp = h('input', { type: 'text', class: 'entrada mini', value: valores[p.id] || '', hidden: true, autocomplete: 'off', oninput: function () { valores[p.id] = inp.value; } });
          var parte = h('span', { class: 'part-monto', texto: '' });
          filas[p.id] = { inp: inp, parte: parte, nombre: p.nombre };
          lista.appendChild(h('div', { class: 'part-fila' }, h('label', { class: 'check', for: cid }, cb, h('span', { texto: p.nombre })), inp, parte));
        });
        pintarModos();
        vis();
      }
      construir();

      return {
        el: caja, foc: null,
        get: function () {
          var ids = [{ id: 'yo' }].concat(A().estado.personas).map(function (p) { return p.id; }).filter(function (id) { return seleccion[id]; });
          return { sel: ids, modo: modo, valores: JSON.parse(JSON.stringify(valores)) };
        },
        set: function () { /* sin uso */ },
        refrescar: function (datos) {
          var c = calcularPartes(datos), p = datos.participantes;
          p.sel.forEach(function (id, i) { if (filas[id]) filas[id].parte.textContent = c.partes[i] === null || c.partes[i] === undefined ? '—' : money.format(c.partes[i]); });
          var total = money.parse(datos.total);
          if (modo === 'exacto' && total) {
            var s = money.suma(c.partes.map(function (x) { return x || 0; }));
            ayudaEl.textContent = 'Suman ' + money.format(s) + ' de ' + money.format(total) + (s === total ? ' ✓' : '');
          } else if (modo === 'porcentaje') {
            var sp = p.sel.reduce(function (a, id) { var n = Number(String(valores[id] || '0').replace(',', '.')); return a + (isFinite(n) ? n : 0); }, 0);
            ayudaEl.textContent = 'Suman ' + String(Math.round(sp * 100) / 100).replace('.', ',') + ' % de 100 %';
          } else ayudaEl.textContent = p.sel.length < 2 ? 'Elige al menos a otra persona o agrégala.' : 'Se divide en partes iguales.';
        }
      };
    };
  }

  function nuevoCompartido() {
    var hoy = A().hoy();
    var catsGasto = A().estado.categorias.filter(function (c) { return c.tipo === 'gasto' && !c.archivada && !c.sistema; }).map(function (c) { return { v: c.id, t: c.icono + ' ' + c.nombre }; });
    ui.abrirFormulario({
      titulo: 'Gasto compartido',
      clase: 'registro',
      campos: [
        { n: 'descripcion', t: 'texto', et: 'Descripción', max: 120, placeholder: 'Ej. Cena de cumpleaños' },
        { n: 'total', t: 'monto', et: 'Total de la cuenta' },
        { n: 'fecha', t: 'fecha', et: 'Fecha', valor: hoy, min: '2000-01-01', max: dates.sumarMeses(hoy, 12), atajos: [{ t: 'Hoy', v: function () { return A().hoy(); } }, { t: 'Ayer', v: function () { return dates.sumarDias(A().hoy(), -1); } }] },
        { n: 'categoriaId', t: 'select', et: 'Categoría', opciones: catsGasto, valor: catsGasto[0] && catsGasto[0].v },
        { n: 'pagadoPor', t: 'select', et: '¿Quién pagó?', opciones: opsPersonas(), valor: 'yo' },
        { n: 'participantes', t: 'custom', et: 'Entre quiénes se divide', claves: ['participantes', 'partes'], render: campoParticipantes() }
      ],
      aviso: 'Solo tu parte cuenta como gasto tuyo. Lo demás queda como saldo con cada persona.',
      validar: function (raw) {
        var c = calcularPartes(raw);
        var res = V.validarCompartido({
          descripcion: raw.descripcion, total: raw.total, fecha: raw.fecha, categoriaId: raw.categoriaId, pagadoPor: raw.pagadoPor,
          participantes: raw.participantes.sel.map(function (id, i) { return { personaId: id, parte: c.partes[i] }; })
        }, { hoy: A().hoy(), estado: A().estado });
        if (c.err) { res.errores.partes = c.err; res.ok = false; res.datos = null; }
        return res;
      },
      guardar: 'Guardar',
      onGuardar: function (datos) {
        A().commit(function (est) { domain.crearCompartido(est, datos); }, { mensaje: 'Gasto compartido guardado' });
      }
    });
  }

  function liquidar(pid) {
    var est = A().estado, p = domain.porId(est.personas, pid);
    if (!p) return;
    var saldo = domain.saldoPersona(est, pid);
    if (saldo === 0) { ui.toast('No hay saldo pendiente con ' + p.nombre + '.'); return; }
    ui.abrirFormulario({
      titulo: 'Liquidar con ' + p.nombre,
      campos: [
        { n: 'monto', t: 'monto', et: saldo > 0 ? 'Cuánto te pagó' : 'Cuánto le pagaste', valor: String(Math.abs(saldo)) },
        { n: 'fecha', t: 'fecha', et: 'Fecha', valor: A().hoy(), min: '2000-01-01', max: dates.sumarMeses(A().hoy(), 12), atajos: [{ t: 'Hoy', v: function () { return A().hoy(); } }] }
      ],
      aviso: (saldo > 0 ? p.nombre + ' te debe ' : 'Le debes a ' + p.nombre + ' ') + money.format(Math.abs(saldo)) + '. Liquidar solo actualiza el saldo; no crea ingresos ni gastos nuevos.',
      validar: function (raw) { return V.validarLiquidacion(raw, { hoy: A().hoy(), estado: A().estado, saldoAbs: Math.abs(domain.saldoPersona(A().estado, pid)) }); },
      guardar: 'Liquidar',
      onGuardar: function (datos) { A().commit(function (s) { domain.liquidar(s, pid, datos); }, { mensaje: 'Saldo actualizado' }); }
    });
  }

  function detalleCompartido(id) {
    var co = domain.porId(A().estado.compartidos, id);
    if (!co) return;
    var est = A().estado, hj = ui.hoja({ titulo: co.descripcion });
    hj.el.appendChild(h('div', { class: 'detalle' },
      h('p', { class: 'detalle-monto', texto: money.format(co.total) }),
      h('p', { class: 'ayuda', texto: dates.largo(co.fecha) + ' · Pagó ' + domain.nombrePersona(est, co.pagadoPor) })));
    hj.el.appendChild(h('div', { class: 'lista tarjeta' }, co.participantes.map(function (p) {
      return ui.fila({ icono: '👤', titulo: domain.nombrePersona(est, p.personaId), derecha: h('span', { class: 'monto', texto: money.format(p.parte) }) });
    })));
    hj.el.appendChild(h('div', { class: 'acciones' }, h('button', {
      type: 'button', class: 'btn peligro-suave', texto: 'Eliminar',
      onclick: function () {
        U.confirmarEliminar('¿Eliminar gasto compartido?', 'Se quita también tu parte de tus movimientos. Las liquidaciones ya hechas se conservan.').then(function (ok) {
          if (!ok) return;
          A().commit(function (s) { domain.eliminarCompartido(s, id); }, { mensaje: 'Gasto compartido eliminado' });
          hj.cerrar();
        });
      }
    })));
  }

  function vistaCompartidos(cont) {
    var est = A().estado, saldos = domain.saldos(est);
    var meDeben = money.suma(saldos.filter(function (s) { return s.saldo > 0; }).map(function (s) { return s.saldo; }));
    var debo = money.suma(saldos.filter(function (s) { return s.saldo < 0; }).map(function (s) { return -s.saldo; }));
    cont.appendChild(ui.tarjeta('ritmo',
      h('div', null, h('span', { class: 'mini-et', texto: 'Te deben' }), h('strong', { class: 'mini-valor ingreso', texto: money.format(meDeben) })),
      h('div', null, h('span', { class: 'mini-et', texto: 'Debes' }), h('strong', { class: 'mini-valor gasto', texto: money.format(debo) }))));
    cont.appendChild(h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn secundario', texto: '＋ Persona', onclick: function () { agregarPersona(); } }),
      h('button', { type: 'button', class: 'btn primario', texto: 'Gasto compartido', onclick: nuevoCompartido })));

    cont.appendChild(ui.seccion('Personas'));
    if (!saldos.length) cont.appendChild(h('p', { class: 'ayuda', texto: 'Agrega a las personas con quienes compartes gastos para llevar las cuentas.' }));
    else {
      cont.appendChild(h('div', { class: 'lista tarjeta' }, saldos.map(function (s) {
        var texto = s.saldo > 0 ? 'Te debe ' + money.format(s.saldo) : s.saldo < 0 ? 'Le debes ' + money.format(-s.saldo) : 'Al día';
        var acciones = h('span', { class: 'fila-acciones' },
          s.saldo !== 0 ? h('button', { type: 'button', class: 'btn secundario sm', texto: 'Liquidar', onclick: function () { liquidar(s.persona.id); } }) : null,
          h('button', {
            type: 'button', class: 'btn texto peligro-txt', texto: 'Quitar', 'aria-label': 'Quitar a ' + s.persona.nombre,
            onclick: function () {
              U.confirmarEliminar('¿Quitar persona?', s.persona.nombre + ' se elimina de tu lista.').then(function (ok) {
                if (!ok) return;
                A().commit(function (e) {
                  var r = domain.eliminarPersona(e, s.persona.id);
                  if (!r.ok) throw new Error(r.error === 'saldo' ? 'Tiene un saldo pendiente: liquídalo primero.' : 'Tiene gastos compartidos en el historial, por eso no se puede quitar.');
                }, { mensaje: 'Persona eliminada' });
              });
            }
          }));
        return ui.fila({ icono: '👤', titulo: s.persona.nombre, sub: texto, derecha: acciones, clase: s.saldo > 0 ? 'positivo' : (s.saldo < 0 ? 'negativo' : '') });
      })));
    }

    cont.appendChild(ui.seccion('Historial'));
    var hist = est.compartidos.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; });
    if (!hist.length) cont.appendChild(ui.vacio('🤝', 'Sin gastos compartidos', 'Divide una cuenta entre varios y lleva quién le debe a quién.'));
    else {
      cont.appendChild(h('div', { class: 'lista tarjeta' }, hist.map(function (co) {
        var c = domain.cat(est, co.categoriaId), mia = co.participantes.filter(function (p) { return p.personaId === 'yo'; })[0];
        return ui.fila({
          icono: ui.iconoCat(c), titulo: co.descripcion,
          sub: dates.corto(co.fecha) + ' · Pagó ' + domain.nombrePersona(est, co.pagadoPor) + ' · Mi parte ' + money.format(mia ? mia.parte : 0),
          derecha: h('span', { class: 'monto', texto: money.format(co.total) }), onclick: function () { detalleCompartido(co.id); }
        });
      })));
    }
  }

  SSP.vistas.registro.deudas = function (cont) {
    var sub = estadoUI.sub.deudas;
    cont.appendChild(ui.tabs([{ v: 'deudas', t: 'Deudas y cuotas' }, { v: 'compartidos', t: 'Compartidos' }], sub, function (v) { estadoUI.sub.deudas = v; SSP.vistas.render(); }, 'Secciones de Deudas'));
    (sub === 'compartidos' ? vistaCompartidos : vistaDeudas)(cont);
  };
})(typeof window !== 'undefined' ? window : globalThis);
