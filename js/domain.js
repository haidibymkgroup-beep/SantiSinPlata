/* SantiSinPlata · dominio: reglas de cálculo y operaciones sobre el estado.
   Sin DOM ni localStorage. Las funciones reciben `hoy` ("YYYY-MM-DD") como parámetro. */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};
  function dep(n) { return SSP[n] || require('./' + n + '.js'); }
  var money = dep('money'), dates = dep('dates');

  var VERSION = 1;

  // ---------- ids ----------
  var generador = null;
  function setGenerador(fn) { generador = fn; }
  function uid(prefijo) {
    if (generador) return prefijo + '_' + generador();
    var r = '';
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) r = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    } catch (e) { r = ''; }
    if (!r) for (var i = 0; i < 16; i++) r += Math.floor(Math.random() * 16).toString(16);
    return prefijo + '_' + r;
  }

  // ---------- estado inicial ----------
  var CATEGORIAS_BASE = [
    ['cat_mercado', 'Mercado', 'gasto', '🛒', '#9C297F', false],
    ['cat_comida', 'Comida fuera', 'gasto', '🍽️', '#E4406F', false],
    ['cat_transporte', 'Transporte', 'gasto', '🚌', '#6D3FA0', false],
    ['cat_vivienda', 'Vivienda', 'gasto', '🏠', '#4A0F7E', false],
    ['cat_servicios', 'Servicios', 'gasto', '💡', '#0E7490', false],
    ['cat_salud', 'Salud', 'gasto', '🩺', '#CA2374', false],
    ['cat_educacion', 'Educación', 'gasto', '📚', '#5B6EE1', false],
    ['cat_ocio', 'Ocio', 'gasto', '🎬', '#F08A4B', false],
    ['cat_ropa', 'Ropa', 'gasto', '👕', '#FE9191', false],
    ['cat_suscripciones', 'Suscripciones', 'gasto', '🔁', '#0F766E', false],
    ['cat_ahorro', 'Ahorro', 'gasto', '🐖', '#C8A24A', true],
    ['cat_deudas', 'Deudas', 'gasto', '💳', '#B91C1C', true],
    ['cat_otros_g', 'Otros', 'gasto', '📦', '#A89BB5', false],
    ['cat_salario', 'Salario', 'ingreso', '💼', '#0F766E', false],
    ['cat_extra', 'Extra', 'ingreso', '✨', '#15803D', false],
    ['cat_otros_i', 'Otros', 'ingreso', '📥', '#7C6A8A', false]
  ];

  function categoriasBase() {
    return CATEGORIAS_BASE.map(function (c) {
      return { id: c[0], nombre: c[1], tipo: c[2], icono: c[3], color: c[4], archivada: false, sistema: c[5] };
    });
  }

  function estadoVacio(ahora) {
    ahora = ahora || new Date().toISOString();
    return {
      version: VERSION, creadoEn: ahora, actualizadoEn: ahora,
      ajustes: { diaInicioMes: 1, tema: 'auto', nombreUsuario: '', ultimoExport: null },
      categorias: categoriasBase(), transacciones: [], presupuestos: [], metas: [], recurrentes: [],
      deudas: [], personas: [], compartidos: [], liquidaciones: []
    };
  }

  // Garantiza que existan (y estén activas) las categorías de sistema Ahorro y Deudas
  function asegurarSistema(est) {
    categoriasBase().filter(function (c) { return c.sistema; }).forEach(function (base) {
      var c = cat(est, base.id);
      if (!c) est.categorias.push(base);
      else { c.archivada = false; c.sistema = true; }
    });
    return est;
  }

  // ---------- utilidades ----------
  function cat(est, id) {
    for (var i = 0; i < est.categorias.length; i++) if (est.categorias[i].id === id) return est.categorias[i];
    return null;
  }
  function porId(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function nombrePersona(est, id) {
    if (id === 'yo') return 'Yo';
    var p = porId(est.personas, id);
    return p ? p.nombre : '(eliminada)';
  }
  function suma(txs) { return txs.reduce(function (a, t) { return a + t.monto; }, 0); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // Los aportes a metas y pagos de deuda se reportan en Ahorro y Deudas
  function categoriaEfectiva(tx) {
    if (tx.origen === 'meta') return 'cat_ahorro';
    if (tx.origen === 'cuota') return 'cat_deudas';
    return tx.categoriaId;
  }

  // ---------- transacciones ----------
  function crearTx(est, d) {
    var tx = {
      id: uid('tx'), tipo: d.tipo, monto: d.monto, fecha: d.fecha, categoriaId: d.categoriaId,
      nota: String(d.nota || '').slice(0, 120), origen: d.origen || 'manual', origenId: d.origenId || null,
      creadoEn: new Date().toISOString()
    };
    est.transacciones.push(tx);
    return tx;
  }

  function actualizarTx(est, id, d) {
    var tx = porId(est.transacciones, id);
    if (!tx) throw new Error('El movimiento ya no existe.');
    ['tipo', 'monto', 'fecha', 'categoriaId', 'nota'].forEach(function (k) { if (d[k] !== undefined) tx[k] = d[k]; });
    return tx;
  }

  function sincronizarMetas(est) {
    est.metas.forEach(function (m) { m.completada = m.aportes.reduce(function (a, p) { return a + p.monto; }, 0) >= m.objetivo; });
  }

  // Borra el movimiento y, si venía de una meta, deuda o gasto compartido, también su origen.
  function eliminarTx(est, id) {
    var i = est.transacciones.findIndex(function (t) { return t.id === id; });
    if (i < 0) return null;
    var tx = est.transacciones.splice(i, 1)[0];
    est.metas.forEach(function (m) { m.aportes = m.aportes.filter(function (a) { return a.txId !== id; }); });
    est.deudas.forEach(function (d) { d.pagos = d.pagos.filter(function (p) { return p.txId !== id; }); });
    est.compartidos = est.compartidos.filter(function (c) { return c.txId !== id; });
    sincronizarMetas(est);
    return tx;
  }

  function enRango(est, desde, hasta, tipo) {
    return est.transacciones.filter(function (t) {
      return t.fecha >= desde && t.fecha <= hasta && (!tipo || t.tipo === tipo);
    });
  }

  // Frecuencia de uso de categorías en los últimos 90 días (para ordenar chips)
  function usoCategorias(est, hoy) {
    var desde = dates.sumarDias(hoy, -90), m = {};
    est.transacciones.forEach(function (t) { if (t.fecha >= desde) m[t.categoriaId] = (m[t.categoriaId] || 0) + 1; });
    return m;
  }

  // ---------- categorías ----------
  function crearCategoria(est, d) {
    var c = { id: uid('cat'), nombre: d.nombre, tipo: d.tipo, icono: d.icono, color: d.color, archivada: false, sistema: false };
    est.categorias.push(c);
    return c;
  }
  function categoriaEnUso(est, id) {
    return est.transacciones.some(function (t) { return t.categoriaId === id; }) ||
      est.presupuestos.some(function (p) { return p.categoriaId === id; }) ||
      est.recurrentes.some(function (r) { return r.categoriaId === id; }) ||
      est.compartidos.some(function (c) { return c.categoriaId === id; });
  }
  function archivarCategoria(est, id, archivar) {
    var c = cat(est, id);
    if (!c) throw new Error('La categoría no existe.');
    if (c.sistema) throw new Error('Las categorías Ahorro y Deudas no se pueden archivar.');
    c.archivada = !!archivar;
    return c;
  }
  function eliminarCategoria(est, id) {
    var c = cat(est, id);
    if (!c || c.sistema) return { ok: false, error: 'sistema' };
    if (categoriaEnUso(est, id)) return { ok: false, error: 'uso' };
    est.categorias = est.categorias.filter(function (x) { return x.id !== id; });
    return { ok: true };
  }

  // ---------- periodo y resumen ----------
  function periodo(est, hoy) { return dates.rangoDelMes(hoy, est.ajustes.diaInicioMes); }

  function resumen(est, hoy, rango) {
    rango = rango || periodo(est, hoy);
    var txs = enRango(est, rango.desde, rango.hasta);
    var ingresos = suma(txs.filter(function (t) { return t.tipo === 'ingreso'; }));
    var gastos = suma(txs.filter(function (t) { return t.tipo === 'gasto'; }));
    var balance = ingresos - gastos;
    var transcurridos = clamp(dates.diferenciaDias(rango.desde, hoy) + 1, 1, rango.dias);
    var restantes = Math.max(1, dates.diferenciaDias(hoy, rango.hasta) + 1);
    var comprometido = comprometidoPeriodo(est, hoy, rango);
    return {
      rango: rango, ingresos: ingresos, gastos: gastos, balance: balance,
      tasaAhorro: ingresos > 0 ? balance / ingresos : null,
      diasTranscurridos: transcurridos, diasPeriodo: rango.dias, diasRestantes: restantes,
      gastoDiarioPromedio: Math.round(gastos / transcurridos),
      proyeccionFinDeMes: Math.round(gastos / transcurridos * rango.dias),
      comprometido: comprometido,
      disponibleDiario: Math.round(Math.max(0, balance - comprometido) / restantes)
    };
  }

  // Recurrentes de gasto que aún faltan en el periodo + cuotas de deuda pendientes (incluye vencidas)
  function comprometidoPeriodo(est, hoy, rango) {
    var total = 0, manana = dates.sumarDias(hoy, 1);
    est.recurrentes.forEach(function (r) {
      if (!r.activa || r.tipo !== 'gasto') return;
      total += fechasEntre(r, manana, rango.hasta, 400).length * r.monto;
    });
    est.deudas.forEach(function (d) {
      if (d.archivada || d.tipo !== 'cuotas') return;
      proyectarDeuda(d, simularDeuda(d)).forEach(function (f) { if (f.fecha <= rango.hasta) total += f.cuota; });
    });
    return total;
  }

  // ---------- presupuestos ----------
  function crearPresupuesto(est, d) {
    var p = { id: uid('pr'), categoriaId: d.categoriaId, limiteMensual: d.limiteMensual, alertaPct: d.alertaPct };
    est.presupuestos.push(p);
    return p;
  }

  function estadoPresupuestos(est, hoy) {
    var r = periodo(est, hoy), txs = enRango(est, r.desde, r.hasta, 'gasto');
    var trans = clamp(dates.diferenciaDias(r.desde, hoy) + 1, 1, r.dias);
    return est.presupuestos.map(function (p) {
      var gastado = suma(txs.filter(function (t) { return p.categoriaId === null || categoriaEfectiva(t) === p.categoriaId; }));
      var estado = gastado > p.limiteMensual ? 'excedido' : (gastado * 100 >= p.alertaPct * p.limiteMensual ? 'atencion' : 'ok');
      var ritmo = Math.round(p.limiteMensual * trans / r.dias);
      return {
        presupuesto: p, gastado: gastado, pct: gastado / p.limiteMensual, restante: p.limiteMensual - gastado,
        estado: estado, ritmoEsperado: ritmo, rapido: estado !== 'excedido' && gastado > ritmo * 1.15
      };
    });
  }

  // ---------- metas ----------
  function crearMeta(est, d) {
    var m = { id: uid('me'), nombre: d.nombre, objetivo: d.objetivo, fechaLimite: d.fechaLimite || null, aportes: [], completada: false, archivada: false };
    est.metas.push(m);
    return m;
  }

  function estadoMeta(m, hoy) {
    var ahorrado = m.aportes.reduce(function (a, p) { return a + p.monto; }, 0);
    var faltante = Math.max(0, m.objetivo - ahorrado);
    var meses = null, sugerido = null;
    if (m.fechaLimite && faltante > 0 && m.fechaLimite > hoy) {
      meses = Math.max(1, dates.mesesCompletos(hoy, m.fechaLimite));
      sugerido = Math.ceil(faltante / meses);
    }
    var estado = ahorrado >= m.objetivo ? 'completada' : (m.fechaLimite && m.fechaLimite < hoy ? 'atrasada' : 'en-curso');
    return { ahorrado: ahorrado, pct: Math.min(1, ahorrado / m.objetivo), faltante: faltante, mesesRestantes: meses, sugeridoMensual: sugerido, estado: estado };
  }

  function agregarAporte(est, metaId, d) {
    var m = porId(est.metas, metaId);
    if (!m) throw new Error('La meta ya no existe.');
    var aporte = { id: uid('ap'), monto: d.monto, fecha: d.fecha, txId: null };
    var tx = crearTx(est, { tipo: 'gasto', monto: d.monto, fecha: d.fecha, categoriaId: 'cat_ahorro', nota: 'Aporte a meta: ' + m.nombre, origen: 'meta', origenId: m.id });
    aporte.txId = tx.id;
    m.aportes.push(aporte);
    sincronizarMetas(est);
    return aporte;
  }

  function quitarAporte(est, metaId, aporteId) {
    var m = porId(est.metas, metaId);
    if (!m) return false;
    var a = porId(m.aportes, aporteId);
    if (!a) return false;
    m.aportes = m.aportes.filter(function (x) { return x.id !== aporteId; });
    if (a.txId) est.transacciones = est.transacciones.filter(function (t) { return t.id !== a.txId; });
    sincronizarMetas(est);
    return true;
  }

  // ---------- recurrentes ----------
  function crearRecurrente(est, d) {
    var r = {
      id: uid('re'), tipo: d.tipo, monto: d.monto, categoriaId: d.categoriaId, nota: d.nota, frecuencia: d.frecuencia,
      diaDelMes: d.diaDelMes, diaSemana: d.diaSemana, inicio: d.inicio, fin: d.fin || null, ultimaGeneracion: null, activa: true
    };
    est.recurrentes.push(r);
    return r;
  }

  // Fechas de la regla entre desde y hasta (inclusive), respetando inicio y fin.
  function fechasEntre(r, desde, hasta, tope) {
    tope = tope || 366;
    var out = [];
    var from = desde < r.inicio ? r.inicio : desde;
    var to = r.fin && r.fin < hasta ? r.fin : hasta;
    if (from > to) return out;
    if (r.frecuencia === 'semanal') {
      var d = dates.sumarDias(from, (r.diaSemana - dates.diaSemana(from) + 7) % 7);
      while (d <= to && out.length < tope) { out.push(d); d = dates.sumarDias(d, 7); }
      return out;
    }
    var p = dates.partes(from), y = p.y, m = p.m, pi = dates.partes(r.inicio), guard = 0;
    while (guard++ < 6000 && out.length < tope) {
      if (dates.fmt(y, m, 1) > to) break;
      var cands = [];
      if (r.frecuencia === 'mensual') cands = [dates.fechaEnMes(y, m, r.diaDelMes)];
      else if (r.frecuencia === 'quincenal') cands = [dates.fmt(y, m, 15), dates.ultimoDia(y, m)];
      else if (r.frecuencia === 'anual' && m === pi.m) cands = [dates.fechaEnMes(y, m, pi.d)];
      for (var i = 0; i < cands.length; i++) if (cands[i] >= from && cands[i] <= to && out.length < tope) out.push(cands[i]);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  function ocurrenciasPendientes(r, hoy) {
    if (!r.activa) return [];
    var desde = r.ultimaGeneracion ? dates.sumarDias(r.ultimaGeneracion, 1) : r.inicio;
    return fechasEntre(r, desde, hoy, 366);
  }

  // Idempotente: solo crea lo que falta desde ultimaGeneracion hasta hoy.
  function materializarRecurrentes(est, hoy) {
    var creados = 0;
    est.recurrentes.forEach(function (r) {
      var fechas = ocurrenciasPendientes(r, hoy);
      fechas.forEach(function (f) {
        crearTx(est, { tipo: r.tipo, monto: r.monto, fecha: f, categoriaId: r.categoriaId, nota: r.nota, origen: 'recurrente', origenId: r.id });
        creados++;
      });
      if (fechas.length) r.ultimaGeneracion = fechas[fechas.length - 1];
    });
    return creados;
  }

  function proximaOcurrencia(r, hoy) {
    var f = fechasEntre(r, dates.sumarDias(hoy, 1), dates.sumarDias(hoy, 800), 1);
    return f.length ? f[0] : null;
  }

  // Al reanudar una regla pausada no se generan retroactivamente los meses en pausa
  function alternarRecurrente(est, id, hoy) {
    var r = porId(est.recurrentes, id);
    if (!r) throw new Error('La regla ya no existe.');
    r.activa = !r.activa;
    if (r.activa) {
      var ayer = dates.sumarDias(hoy, -1);
      if (!r.ultimaGeneracion || r.ultimaGeneracion < ayer) r.ultimaGeneracion = ayer;
    }
    return r;
  }

  function textoFrecuencia(r) {
    if (r.frecuencia === 'semanal') return 'Cada semana, ' + ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][r.diaSemana];
    if (r.frecuencia === 'quincenal') return 'Cada quincena (15 y fin de mes)';
    if (r.frecuencia === 'anual') return 'Cada año, ' + dates.corto(r.inicio);
    return 'Cada mes, día ' + r.diaDelMes;
  }

  // ---------- deudas ----------
  function tasaMensual(d) { return d.tipo === 'cuotas' ? d.tasaMensualPct / 100 : 0; }
  function interesDe(saldo, i) { return Math.round(saldo * i); }

  // Sistema francés: cuota = capital·i / (1 − (1+i)^−n)
  function cuotaFrancesa(capital, tasaPct, n) {
    var i = tasaPct / 100;
    if (!i) return Math.round(capital / n);
    return Math.round(capital * i / (1 - Math.pow(1 + i, -n)));
  }
  function cuotaBase(d) { return d.valorCuota > 0 ? d.valorCuota : cuotaFrancesa(d.capitalInicial, d.tasaMensualPct, d.numCuotas); }

  function fechaCuota(d, k) {
    var p = dates.partes(d.primeraCuota);
    return dates.fechaEnMes(p.y, p.m + k - 1, d.diaPago || p.d);
  }

  // Aplica los pagos registrados, en orden de fecha, y devuelve el saldo y el historial.
  function simularDeuda(d) {
    var saldo = d.capitalInicial, pagadas = 0, i = tasaMensual(d), filas = [];
    var pagos = d.pagos.map(function (p, idx) { return { p: p, idx: idx }; })
      .sort(function (a, b) { return a.p.fecha < b.p.fecha ? -1 : a.p.fecha > b.p.fecha ? 1 : a.idx - b.idx; });
    pagos.forEach(function (o) {
      var p = o.p, interes = 0, capital;
      if (p.tipo === 'extra' || d.tipo === 'libre') capital = Math.min(saldo, p.monto);
      else { interes = interesDe(saldo, i); capital = clamp(p.monto - interes, 0, saldo); pagadas++; }
      saldo -= capital;
      filas.push({ pago: p, interes: interes, capital: capital, saldo: saldo });
    });
    return { saldo: saldo, pagadas: pagadas, filas: filas };
  }

  // Cuotas que faltan desde el estado simulado. La última ajusta para cerrar en 0 exacto.
  function proyectarDeuda(d, sim) {
    if (d.tipo !== 'cuotas') return [];
    var rows = [], saldo = sim.saldo, k = sim.pagadas, i = tasaMensual(d), cuota = cuotaBase(d), fija = d.valorCuota > 0;
    while (saldo > 0 && rows.length < 1200) {
      k++;
      var interes = interesDe(saldo, i);
      var ultima = cuota >= saldo + interes || (!fija && k >= d.numCuotas);
      var pago = ultima ? saldo + interes : cuota;
      var capital = pago - interes;
      saldo -= capital;
      rows.push({ n: k, fecha: fechaCuota(d, k), cuota: pago, interes: interes, capital: capital, saldo: saldo });
    }
    return rows;
  }

  function estadoDeuda(d, hoy) {
    var sim = simularDeuda(d), plan = proyectarDeuda(d, sim), prox = plan.length ? plan[0] : null;
    var interesPeriodo = d.tipo === 'cuotas' ? interesDe(sim.saldo, tasaMensual(d)) : 0;
    return {
      saldo: sim.saldo, pagado: d.capitalInicial - sim.saldo, pctPagado: 1 - sim.saldo / d.capitalInicial,
      cuotasPagadas: sim.pagadas, cuotasRestantes: plan.length, cuotasTotales: sim.pagadas + plan.length,
      proxima: prox, plan: plan, historial: sim.filas, saldada: sim.saldo === 0,
      vencida: !!prox && prox.fecha < hoy, interesPeriodo: interesPeriodo,
      maxPagoCuota: sim.saldo + interesPeriodo, maxPagoExtra: sim.saldo,
      cuotaSugerida: prox ? prox.cuota : null
    };
  }

  function tablaAmortizacion(capital, tasaPct, n) {
    var d = { tipo: 'cuotas', capitalInicial: capital, tasaMensualPct: tasaPct, numCuotas: n, valorCuota: 0, primeraCuota: '2000-01-01', diaPago: 1, pagos: [] };
    return proyectarDeuda(d, simularDeuda(d));
  }

  function crearDeuda(est, d) {
    var x = {
      id: uid('de'), nombre: d.nombre, acreedor: d.acreedor || '', tipo: d.tipo, capitalInicial: d.capitalInicial,
      tasaMensualPct: d.tasaMensualPct, numCuotas: d.numCuotas, valorCuota: d.valorCuota || 0,
      primeraCuota: d.primeraCuota, diaPago: d.diaPago, pagos: [], archivada: false
    };
    est.deudas.push(x);
    return x;
  }

  function registrarPago(est, deudaId, p) {
    var d = porId(est.deudas, deudaId);
    if (!d) throw new Error('La deuda ya no existe.');
    var e = estadoDeuda(d, p.fecha);
    var tipo = d.tipo === 'libre' ? 'cuota' : p.tipo;
    var tope = tipo === 'extra' || d.tipo === 'libre' ? e.maxPagoExtra : e.maxPagoCuota;
    if (!money.esMonto(p.monto) || p.monto > tope) throw new Error('El pago excede el saldo pendiente.');
    var nota = tipo === 'extra' ? 'Abono extra: ' + d.nombre : (d.tipo === 'libre' ? 'Pago: ' + d.nombre : 'Cuota ' + (e.cuotasPagadas + 1) + ': ' + d.nombre);
    var tx = crearTx(est, { tipo: 'gasto', monto: p.monto, fecha: p.fecha, categoriaId: 'cat_deudas', nota: nota, origen: 'cuota', origenId: d.id });
    var pago = { id: uid('pa'), fecha: p.fecha, monto: p.monto, tipo: tipo, txId: tx.id };
    d.pagos.push(pago);
    return pago;
  }

  function eliminarPago(est, deudaId, pagoId) {
    var d = porId(est.deudas, deudaId);
    if (!d) return false;
    var p = porId(d.pagos, pagoId);
    if (!p) return false;
    d.pagos = d.pagos.filter(function (x) { return x.id !== pagoId; });
    if (p.txId) est.transacciones = est.transacciones.filter(function (t) { return t.id !== p.txId; });
    return true;
  }

  function resumenDeudas(est, hoy) {
    var r = periodo(est, hoy), total = 0, proxima = null, pagosMes = 0;
    est.deudas.forEach(function (d) {
      if (d.archivada) return;
      var e = estadoDeuda(d, hoy);
      total += e.saldo;
      if (e.proxima && (!proxima || e.proxima.fecha < proxima.fecha)) proxima = { fecha: e.proxima.fecha, deuda: d.nombre, cuota: e.proxima.cuota };
      d.pagos.forEach(function (p) { if (p.fecha >= r.desde && p.fecha <= r.hasta) pagosMes += p.monto; });
    });
    return { deudaTotal: total, pagosDelMes: pagosMes, proxima: proxima };
  }

  // ---------- personas y gastos compartidos ----------
  function crearPersona(est, d) {
    var p = { id: uid('pe'), nombre: d.nombre };
    est.personas.push(p);
    return p;
  }

  // modo: 'igual' | 'exacto' | 'porcentaje'. valores: montos o porcentajes por participante (null en 'igual').
  function dividir(modo, total, ids, valores) {
    if (modo === 'igual') return money.repartir(total, ids.length);
    if (modo === 'porcentaje') return money.repartirPorcentajes(total, valores);
    return valores.slice();
  }

  function crearCompartido(est, d) {
    var co = {
      id: uid('co'), descripcion: d.descripcion, fecha: d.fecha, total: d.total, categoriaId: d.categoriaId,
      pagadoPor: d.pagadoPor, participantes: d.participantes.map(function (p) { return { personaId: p.personaId, parte: p.parte }; }), txId: null
    };
    var mia = co.participantes.filter(function (p) { return p.personaId === 'yo'; })[0];
    if (mia && mia.parte > 0) {
      var tx = crearTx(est, { tipo: 'gasto', monto: mia.parte, fecha: d.fecha, categoriaId: d.categoriaId, nota: d.descripcion + ' (mi parte)', origen: 'compartido', origenId: co.id });
      co.txId = tx.id;
    }
    est.compartidos.push(co);
    return co;
  }

  function eliminarCompartido(est, id) {
    var co = porId(est.compartidos, id);
    if (!co) return false;
    est.compartidos = est.compartidos.filter(function (c) { return c.id !== id; });
    if (co.txId) est.transacciones = est.transacciones.filter(function (t) { return t.id !== co.txId; });
    return true;
  }

  // > 0: la persona te debe · < 0: tú le debes
  function saldoPersona(est, pid) {
    var s = 0;
    est.compartidos.forEach(function (c) {
      if (c.pagadoPor === 'yo') {
        c.participantes.forEach(function (p) { if (p.personaId === pid) s += p.parte; });
      } else if (c.pagadoPor === pid) {
        c.participantes.forEach(function (p) { if (p.personaId === 'yo') s -= p.parte; });
      }
    });
    est.liquidaciones.forEach(function (l) { if (l.personaId === pid) s += l.sentido === 'me_pagan' ? -l.monto : l.monto; });
    return s;
  }

  function saldos(est) {
    return est.personas.map(function (p) { return { persona: p, saldo: saldoPersona(est, p.id) }; });
  }

  // No crea ingresos ni gastos: solo mueve la deuda entre personas.
  function liquidar(est, pid, d) {
    var s = saldoPersona(est, pid);
    if (s === 0) throw new Error('No hay saldo pendiente con esta persona.');
    if (d.monto > Math.abs(s)) throw new Error('El monto supera el saldo.');
    var l = { id: uid('li'), personaId: pid, monto: d.monto, fecha: d.fecha, sentido: s > 0 ? 'me_pagan' : 'le_pago' };
    est.liquidaciones.push(l);
    return l;
  }

  function eliminarPersona(est, id) {
    if (saldoPersona(est, id) !== 0) return { ok: false, error: 'saldo' };
    var usada = est.compartidos.some(function (c) { return c.pagadoPor === id || c.participantes.some(function (p) { return p.personaId === id; }); }) ||
      est.liquidaciones.some(function (l) { return l.personaId === id; });
    if (usada) return { ok: false, error: 'historial' };
    est.personas = est.personas.filter(function (p) { return p.id !== id; });
    return { ok: true };
  }

  // ---------- reportes ----------
  function gastosPorCategoria(est, desde, hasta) {
    var m = {}, total = 0;
    enRango(est, desde, hasta, 'gasto').forEach(function (t) {
      var id = categoriaEfectiva(t);
      m[id] = (m[id] || 0) + t.monto;
      total += t.monto;
    });
    return Object.keys(m).map(function (id) {
      var c = cat(est, id);
      return { categoriaId: id, nombre: c ? c.nombre : 'Sin categoría', icono: c ? c.icono : '•', color: c ? c.color : '#94A3B8', monto: m[id], pct: total ? m[id] / total : 0 };
    }).sort(function (a, b) { return b.monto - a.monto; });
  }

  function agruparTop(items, n) {
    if (items.length <= n) return items;
    var top = items.slice(0, n), resto = items.slice(n);
    var m = resto.reduce(function (a, x) { return a + x.monto; }, 0), p = resto.reduce(function (a, x) { return a + x.pct; }, 0);
    top.push({ categoriaId: null, nombre: 'Otros', icono: '', color: '#A89BB5', monto: m, pct: p });
    return top;
  }

  function serieMensual(est, hoy, meses) {
    var out = [], dia = est.ajustes.diaInicioMes;
    for (var k = -(meses - 1); k <= 0; k++) {
      var r = dates.desplazarPeriodo(hoy, dia, k), txs = enRango(est, r.desde, r.hasta);
      out.push({
        etiqueta: dates.mesCorto(r.hasta), desde: r.desde, hasta: r.hasta,
        ingresos: suma(txs.filter(function (t) { return t.tipo === 'ingreso'; })),
        gastos: suma(txs.filter(function (t) { return t.tipo === 'gasto'; }))
      });
    }
    return out;
  }

  // Gasto acumulado día a día en el rango; null para los días futuros
  function acumuladoDiario(est, rango, hoy) {
    var porDia = {};
    enRango(est, rango.desde, rango.hasta, 'gasto').forEach(function (t) { porDia[t.fecha] = (porDia[t.fecha] || 0) + t.monto; });
    var out = [], acc = 0;
    for (var i = 0; i < rango.dias; i++) {
      var f = dates.sumarDias(rango.desde, i);
      if (f > hoy) { out.push(null); continue; }
      acc += porDia[f] || 0;
      out.push(acc);
    }
    return out;
  }

  function topGastos(est, desde, hasta, n) {
    return enRango(est, desde, hasta, 'gasto').slice().sort(function (a, b) { return b.monto - a.monto || (a.fecha < b.fecha ? 1 : -1); }).slice(0, n);
  }

  function comparativo(est, actual, previo) {
    var a = {}, p = {};
    gastosPorCategoria(est, actual.desde, actual.hasta).forEach(function (x) { a[x.categoriaId] = x.monto; });
    gastosPorCategoria(est, previo.desde, previo.hasta).forEach(function (x) { p[x.categoriaId] = x.monto; });
    var ids = Object.keys(a).concat(Object.keys(p).filter(function (k) { return !(k in a); }));
    return ids.map(function (id) {
      var c = cat(est, id), act = a[id] || 0, pre = p[id] || 0;
      return {
        categoriaId: id, nombre: c ? c.nombre : 'Sin categoría', icono: c ? c.icono : '•', actual: act, previo: pre,
        variacion: pre > 0 ? (act - pre) / pre : null, nuevo: pre === 0 && act > 0
      };
    }).sort(function (x, y) { return y.actual - x.actual; });
  }

  // clave: 'mes' | 'anterior' | '3m' | 'anio' | 'rango'
  function rangoPorClave(est, clave, hoy, custom) {
    var dia = est.ajustes.diaInicioMes, r, previo, etiqueta;
    function bloqueAnterior(desde, hasta) {
      var largo = dates.diferenciaDias(desde, hasta) + 1;
      return { desde: dates.sumarDias(desde, -largo), hasta: dates.sumarDias(desde, -1) };
    }
    if (clave === 'anterior') {
      r = dates.desplazarPeriodo(hoy, dia, -1); previo = dates.desplazarPeriodo(hoy, dia, -2);
      etiqueta = dates.etiquetaPeriodo(r, dia);
    } else if (clave === '3m') {
      r = { desde: dates.desplazarPeriodo(hoy, dia, -2).desde, hasta: periodo(est, hoy).hasta };
      previo = bloqueAnterior(r.desde, r.hasta); etiqueta = 'Últimos 3 meses';
    } else if (clave === 'anio') {
      var y = dates.partes(hoy).y;
      r = { desde: dates.fmt(y, 1, 1), hasta: hoy };
      previo = { desde: dates.fmt(y - 1, 1, 1), hasta: dates.sumarMeses(hoy, -12) }; etiqueta = 'Año ' + y;
    } else if (clave === 'rango' && custom && custom.desde && custom.hasta) {
      r = { desde: custom.desde, hasta: custom.hasta }; previo = bloqueAnterior(r.desde, r.hasta);
      etiqueta = dates.corto(r.desde) + ' – ' + dates.corto(r.hasta);
    } else {
      r = periodo(est, hoy); previo = dates.desplazarPeriodo(hoy, dia, -1); etiqueta = dates.etiquetaPeriodo(r, dia);
      clave = 'mes';
    }
    r.dias = dates.diferenciaDias(r.desde, r.hasta) + 1;
    return { clave: clave, desde: r.desde, hasta: r.hasta, dias: r.dias, previo: previo, etiqueta: etiqueta };
  }

  // ---------- alertas de Inicio ----------
  function alertas(est, hoy) {
    var out = [];
    estadoPresupuestos(est, hoy).forEach(function (e) {
      var c = e.presupuesto.categoriaId ? cat(est, e.presupuesto.categoriaId) : null;
      var nombre = c ? c.nombre : 'el total del mes';
      if (e.estado === 'excedido') out.push({ tipo: 'presupuesto', nivel: 'alerta', texto: 'Te pasaste en ' + nombre + ' por ' + money.format(-e.restante) + '.' });
      else if (e.estado === 'atencion') out.push({ tipo: 'presupuesto', nivel: 'atencion', texto: nombre.charAt(0).toUpperCase() + nombre.slice(1) + ': llevas el ' + Math.round(e.pct * 100) + ' % del presupuesto.' });
      else if (e.rapido) out.push({ tipo: 'presupuesto', nivel: 'info', texto: 'Vas más rápido de lo planeado en ' + nombre + '.' });
    });
    est.deudas.forEach(function (d) {
      if (d.archivada) return;
      var e = estadoDeuda(d, hoy);
      if (!e.proxima) return;
      if (e.vencida) out.push({ tipo: 'cuota', nivel: 'alerta', texto: 'Cuota vencida de ' + d.nombre + ' (' + money.format(e.proxima.cuota) + ').' });
      else if (dates.diferenciaDias(hoy, e.proxima.fecha) <= 5) out.push({ tipo: 'cuota', nivel: 'atencion', texto: 'La cuota de ' + d.nombre + ' vence ' + dates.etiquetaDia(e.proxima.fecha, hoy).toLowerCase() + ' (' + money.format(e.proxima.cuota) + ').' });
    });
    est.metas.forEach(function (m) {
      if (!m.archivada && estadoMeta(m, hoy).estado === 'atrasada') out.push({ tipo: 'meta', nivel: 'atencion', texto: 'La meta «' + m.nombre + '» pasó su fecha límite.' });
    });
    est.transacciones.forEach(function (t) {
      if (t.fecha === hoy && t.origen === 'recurrente') out.push({ tipo: 'recurrente', nivel: 'info', texto: 'Hoy se registró «' + t.nota + '» (' + money.format(t.monto) + ').' });
    });
    var ref = est.ajustes.ultimoExport || (dates.esValida(String(est.creadoEn).slice(0, 10)) ? String(est.creadoEn).slice(0, 10) : null);
    if (est.transacciones.length > 0 && ref && dates.diferenciaDias(ref, hoy) > 30) {
      out.push({ tipo: 'respaldo', nivel: 'info', texto: 'Hace más de 30 días no exportas un respaldo. Hazlo en Ajustes.' });
    }
    return out;
  }

  // ---------- datos de ejemplo (determinista) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function datosEjemplo(hoy, ahora) {
    var est = estadoVacio(ahora), rnd = mulberry32(2026);
    est.ajustes.nombreUsuario = 'Santi';
    var inicio = dates.desplazarPeriodo(hoy, 1, -3).desde;

    // ingresos y recurrentes
    for (var k = -3; k <= 0; k++) {
      var r = dates.desplazarPeriodo(hoy, 1, k);
      if (r.desde <= hoy) crearTx(est, { tipo: 'ingreso', monto: 3800000, fecha: r.desde, categoriaId: 'cat_salario', nota: 'Salario' });
      if (k === -1 && dates.sumarDias(r.desde, 14) <= hoy) crearTx(est, { tipo: 'ingreso', monto: 350000, fecha: dates.sumarDias(r.desde, 14), categoriaId: 'cat_extra', nota: 'Trabajo freelance' });
    }
    crearRecurrente(est, { tipo: 'gasto', monto: 900000, categoriaId: 'cat_vivienda', nota: 'Arriendo', frecuencia: 'mensual', diaDelMes: 5, diaSemana: null, inicio: inicio });
    crearRecurrente(est, { tipo: 'gasto', monto: 38900, categoriaId: 'cat_suscripciones', nota: 'Netflix', frecuencia: 'mensual', diaDelMes: 12, diaSemana: null, inicio: inicio });
    crearRecurrente(est, { tipo: 'gasto', monto: 120000, categoriaId: 'cat_servicios', nota: 'Internet y celular', frecuencia: 'mensual', diaDelMes: 20, diaSemana: null, inicio: inicio });
    materializarRecurrentes(est, hoy);

    // gastos diarios
    var tipos = [
      ['cat_mercado', 18000, 100000, 'Supermercado'], ['cat_comida', 12000, 38000, 'Almuerzo'], ['cat_transporte', 4000, 26000, 'Bus y taxi'],
      ['cat_ocio', 15000, 75000, 'Cine y salidas'], ['cat_salud', 20000, 80000, 'Droguería'], ['cat_ropa', 40000, 160000, 'Ropa']
    ];
    var pesos = [0.28, 0.32, 0.22, 0.1, 0.05, 0.03];
    var dia = inicio;
    while (dia <= hoy) {
      var n = rnd() < 0.7 ? 1 : (rnd() < 0.3 ? 2 : 0);
      for (var j = 0; j < n; j++) {
        var x = rnd(), acc = 0, idx = 0;
        for (var q = 0; q < pesos.length; q++) { acc += pesos[q]; if (x <= acc) { idx = q; break; } }
        var t = tipos[idx], monto = Math.round((t[1] + rnd() * (t[2] - t[1])) / 500) * 500;
        crearTx(est, { tipo: 'gasto', monto: monto, fecha: dia, categoriaId: t[0], nota: t[3] });
      }
      dia = dates.sumarDias(dia, 1);
    }

    // presupuestos
    [[null, 3500000, 80], ['cat_mercado', 750000, 80], ['cat_comida', 400000, 80], ['cat_ocio', 250000, 80]].forEach(function (b) {
      crearPresupuesto(est, { categoriaId: b[0], limiteMensual: b[1], alertaPct: b[2] });
    });

    // meta de ahorro
    var meta = crearMeta(est, { nombre: 'Viaje a San Andrés', objetivo: 3000000, fechaLimite: dates.sumarMeses(hoy, 8) });
    for (var m = -2; m <= 0; m++) {
      var f = dates.sumarDias(dates.desplazarPeriodo(hoy, 1, m).desde, 9);
      if (f <= hoy) agregarAporte(est, meta.id, { monto: 200000, fecha: f });
    }

    // deudas
    var moto = crearDeuda(est, { nombre: 'Crédito moto', acreedor: 'Banco Andino', tipo: 'cuotas', capitalInicial: 6000000, tasaMensualPct: 1.8, numCuotas: 24, valorCuota: 0, primeraCuota: dates.fechaEnMes(dates.partes(hoy).y, dates.partes(hoy).m - 3, 10), diaPago: 10 });
    var pc = crearDeuda(est, { nombre: 'Computador (tarjeta)', acreedor: 'Tarjeta Visa', tipo: 'cuotas', capitalInicial: 1200000, tasaMensualPct: 0, numCuotas: 6, valorCuota: 0, primeraCuota: dates.fechaEnMes(dates.partes(hoy).y, dates.partes(hoy).m - 1, 25), diaPago: 25 });
    [moto, pc].forEach(function (d) {
      var guard = 0;
      while (guard++ < 50) {
        var e = estadoDeuda(d, hoy);
        if (!e.proxima || e.proxima.fecha > hoy) break;
        registrarPago(est, d.id, { monto: e.proxima.cuota, fecha: e.proxima.fecha, tipo: 'cuota' });
      }
    });

    // gastos compartidos
    var ana = crearPersona(est, { nombre: 'Ana' }), cam = crearPersona(est, { nombre: 'Camilo' });
    crearCompartido(est, {
      descripcion: 'Cena de grupo', fecha: dates.sumarDias(hoy, -6), total: 180000, categoriaId: 'cat_comida', pagadoPor: 'yo',
      participantes: money.repartir(180000, 3).map(function (p, i) { return { personaId: ['yo', ana.id, cam.id][i], parte: p }; })
    });
    crearCompartido(est, {
      descripcion: 'Taxi al aeropuerto', fecha: dates.sumarDias(hoy, -3), total: 90000, categoriaId: 'cat_transporte', pagadoPor: ana.id,
      participantes: money.repartir(90000, 2).map(function (p, i) { return { personaId: ['yo', ana.id][i], parte: p }; })
    });
    liquidar(est, ana.id, { monto: 5000, fecha: dates.sumarDias(hoy, -1) });
    return est;
  }

  var api = {
    VERSION: VERSION, setGenerador: setGenerador, uid: uid, estadoVacio: estadoVacio, categoriasBase: categoriasBase,
    asegurarSistema: asegurarSistema, cat: cat, porId: porId, nombrePersona: nombrePersona, categoriaEfectiva: categoriaEfectiva,
    crearTx: crearTx, actualizarTx: actualizarTx, eliminarTx: eliminarTx, enRango: enRango, usoCategorias: usoCategorias,
    crearCategoria: crearCategoria, archivarCategoria: archivarCategoria, eliminarCategoria: eliminarCategoria, categoriaEnUso: categoriaEnUso,
    periodo: periodo, resumen: resumen, comprometidoPeriodo: comprometidoPeriodo,
    crearPresupuesto: crearPresupuesto, estadoPresupuestos: estadoPresupuestos,
    crearMeta: crearMeta, estadoMeta: estadoMeta, agregarAporte: agregarAporte, quitarAporte: quitarAporte, sincronizarMetas: sincronizarMetas,
    crearRecurrente: crearRecurrente, fechasEntre: fechasEntre, ocurrenciasPendientes: ocurrenciasPendientes,
    materializarRecurrentes: materializarRecurrentes, proximaOcurrencia: proximaOcurrencia, alternarRecurrente: alternarRecurrente, textoFrecuencia: textoFrecuencia,
    cuotaFrancesa: cuotaFrancesa, cuotaBase: cuotaBase, fechaCuota: fechaCuota, simularDeuda: simularDeuda, proyectarDeuda: proyectarDeuda,
    estadoDeuda: estadoDeuda, tablaAmortizacion: tablaAmortizacion, crearDeuda: crearDeuda, registrarPago: registrarPago,
    eliminarPago: eliminarPago, resumenDeudas: resumenDeudas,
    crearPersona: crearPersona, dividir: dividir, crearCompartido: crearCompartido, eliminarCompartido: eliminarCompartido,
    saldoPersona: saldoPersona, saldos: saldos, liquidar: liquidar, eliminarPersona: eliminarPersona,
    gastosPorCategoria: gastosPorCategoria, agruparTop: agruparTop, serieMensual: serieMensual, acumuladoDiario: acumuladoDiario,
    topGastos: topGastos, comparativo: comparativo, rangoPorClave: rangoPorClave, alertas: alertas, datosEjemplo: datosEjemplo
  };
  SSP.domain = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
