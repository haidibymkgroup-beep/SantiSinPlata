/* SantiSinPlata · validaciones. Cada validarX devuelve { ok, errores:{campo:msg}, datos } */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};
  function dep(n) { return SSP[n] || require('./' + n + '.js'); }
  var money = dep('money'), dates = dep('dates');

  var FECHA_MIN = '2000-01-01';
  var FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'anual'];
  var ORIGENES = ['manual', 'recurrente', 'cuota', 'meta', 'compartido'];

  function normalizar(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function resultado(errores, datos) {
    var ok = Object.keys(errores).length === 0;
    return { ok: ok, errores: errores, datos: ok ? datos : null };
  }

  function texto(raw, errores, campo, max, req, etiqueta) {
    var s = raw == null ? '' : String(raw).trim();
    if (req && s === '') errores[campo] = 'Escribe ' + etiqueta + '.';
    else if (s.length > max) errores[campo] = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' admite máximo ' + max + ' caracteres.';
    return s;
  }

  function monto(raw, errores, campo, opts) {
    opts = opts || {};
    var vacio = raw == null || (typeof raw === 'string' && raw.trim() === '');
    if (vacio) { if (!opts.opcional) errores[campo] = 'Ingresa un monto.'; return opts.opcional ? 0 : null; }
    var n = money.parse(raw);
    if (n === null) { errores[campo] = 'Monto no válido: usa solo números enteros, sin decimales (máx. ' + money.format(money.MAX) + ').'; return null; }
    if (n < 1 && !(opts.opcional && n === 0)) { errores[campo] = 'El monto debe ser mayor que cero.'; return null; }
    if (opts.max != null && n > opts.max) { errores[campo] = opts.msgMax || ('El monto no puede superar ' + money.format(opts.max) + '.'); return null; }
    if (opts.min != null && n < opts.min) { errores[campo] = opts.msgMin || ('El monto debe ser al menos ' + money.format(opts.min) + '.'); return null; }
    return n;
  }

  function fecha(raw, errores, campo, ctx, opts) {
    opts = opts || {};
    if (raw == null || raw === '') { if (!opts.opcional) errores[campo] = 'Elige una fecha.'; return null; }
    if (!dates.esValida(raw)) { errores[campo] = 'Fecha no válida.'; return null; }
    if (raw < FECHA_MIN) { errores[campo] = 'La fecha no puede ser anterior al año 2000.'; return null; }
    if (!opts.sinLimiteFuturo && ctx.hoy && raw > dates.sumarMeses(ctx.hoy, 12)) {
      errores[campo] = 'La fecha no puede superar 1 año en el futuro.'; return null;
    }
    return raw;
  }

  function entero(raw, errores, campo, min, max, etiqueta) {
    var n = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN);
    if (!Number.isInteger(n) || n < min || n > max) { errores[campo] = etiqueta + ' debe ser un número entero entre ' + min + ' y ' + max + '.'; return null; }
    return n;
  }

  function categoriaDe(est, id) {
    for (var i = 0; est && i < est.categorias.length; i++) if (est.categorias[i].id === id) return est.categorias[i];
    return null;
  }

  // ---------- entidades ----------
  function validarMonto(raw) {
    var e = {}, v = monto(raw, e, 'monto');
    return resultado(e, { monto: v });
  }

  function validarTransaccion(raw, ctx) {
    var e = {}, d = {};
    d.tipo = raw.tipo;
    if (d.tipo !== 'gasto' && d.tipo !== 'ingreso') e.tipo = 'Elige gasto o ingreso.';
    d.monto = monto(raw.monto, e, 'monto');
    d.fecha = fecha(raw.fecha, e, 'fecha', ctx);
    d.nota = texto(raw.nota, e, 'nota', 120, false, 'la nota');
    d.categoriaId = raw.categoriaId;
    var c = categoriaDe(ctx.estado, d.categoriaId);
    if (!c) e.categoriaId = 'Elige una categoría.';
    else if (c.tipo !== d.tipo) e.categoriaId = 'La categoría no corresponde a un ' + d.tipo + '.';
    else if (c.archivada && d.categoriaId !== ctx.categoriaActual) e.categoriaId = 'Esa categoría está archivada.';
    return resultado(e, d);
  }

  function validarCategoria(raw, ctx) {
    var e = {}, d = {};
    d.nombre = texto(raw.nombre, e, 'nombre', 40, true, 'un nombre');
    d.tipo = raw.tipo;
    if (d.tipo !== 'gasto' && d.tipo !== 'ingreso') e.tipo = 'Elige el tipo.';
    d.icono = texto(raw.icono, e, 'icono', 8, false, 'el ícono') || '🏷️';
    d.color = /^#[0-9a-fA-F]{6}$/.test(raw.color || '') ? raw.color : '#64748B';
    if (!e.nombre) {
      var n = normalizar(d.nombre);
      var dup = ctx.estado.categorias.some(function (c) { return c.tipo === d.tipo && c.id !== ctx.editId && normalizar(c.nombre) === n; });
      if (dup) e.nombre = 'Ya existe una categoría con ese nombre.';
    }
    return resultado(e, d);
  }

  function validarPresupuesto(raw, ctx) {
    var e = {}, d = {};
    d.categoriaId = raw.categoriaId === '' || raw.categoriaId === 'total' || raw.categoriaId == null ? null : raw.categoriaId;
    if (d.categoriaId !== null) {
      var c = categoriaDe(ctx.estado, d.categoriaId);
      if (!c || c.tipo !== 'gasto') e.categoriaId = 'Elige una categoría de gasto.';
    }
    d.limiteMensual = monto(raw.limiteMensual, e, 'limiteMensual');
    d.alertaPct = entero(raw.alertaPct, e, 'alertaPct', 50, 100, 'La alerta');
    if (!e.categoriaId) {
      var dup = ctx.estado.presupuestos.some(function (p) { return p.id !== ctx.editId && p.categoriaId === d.categoriaId; });
      if (dup) e.categoriaId = d.categoriaId === null ? 'Ya tienes un presupuesto total.' : 'Esa categoría ya tiene presupuesto.';
    }
    return resultado(e, d);
  }

  function validarMeta(raw, ctx) {
    var e = {}, d = {};
    d.nombre = texto(raw.nombre, e, 'nombre', 40, true, 'un nombre');
    d.objetivo = monto(raw.objetivo, e, 'objetivo');
    d.fechaLimite = fecha(raw.fechaLimite, e, 'fechaLimite', ctx, { opcional: true });
    if (d.fechaLimite && d.fechaLimite <= ctx.hoy) { e.fechaLimite = 'La fecha límite debe ser posterior a hoy.'; }
    return resultado(e, d);
  }

  function validarAporte(raw, ctx) {
    var e = {}, d = {};
    d.monto = monto(raw.monto, e, 'monto');
    d.fecha = fecha(raw.fecha, e, 'fecha', ctx);
    return resultado(e, d);
  }

  function validarRecurrente(raw, ctx) {
    var e = {}, d = {};
    d.tipo = raw.tipo;
    if (d.tipo !== 'gasto' && d.tipo !== 'ingreso') e.tipo = 'Elige gasto o ingreso.';
    d.monto = monto(raw.monto, e, 'monto');
    d.nota = texto(raw.nota, e, 'nota', 120, true, 'un nombre');
    d.categoriaId = raw.categoriaId;
    var c = categoriaDe(ctx.estado, d.categoriaId);
    if (!c) e.categoriaId = 'Elige una categoría.';
    else if (c.tipo !== d.tipo) e.categoriaId = 'La categoría no corresponde a un ' + d.tipo + '.';
    d.frecuencia = raw.frecuencia;
    if (FRECUENCIAS.indexOf(d.frecuencia) < 0) e.frecuencia = 'Elige la frecuencia.';
    d.inicio = fecha(raw.inicio, e, 'inicio', ctx);
    d.fin = fecha(raw.fin, e, 'fin', ctx, { opcional: true, sinLimiteFuturo: true });
    if (d.inicio && d.fin && d.fin < d.inicio) e.fin = 'La fecha final no puede ser anterior al inicio.';
    d.diaDelMes = null; d.diaSemana = null;
    if (d.frecuencia === 'mensual') d.diaDelMes = entero(raw.diaDelMes, e, 'diaDelMes', 1, 31, 'El día del mes');
    if (d.frecuencia === 'semanal') d.diaSemana = entero(raw.diaSemana, e, 'diaSemana', 0, 6, 'El día de la semana');
    return resultado(e, d);
  }

  function validarDeuda(raw, ctx) {
    var e = {}, d = {};
    d.nombre = texto(raw.nombre, e, 'nombre', 40, true, 'un nombre');
    d.acreedor = texto(raw.acreedor, e, 'acreedor', 40, false, 'el acreedor');
    d.tipo = raw.tipo;
    if (d.tipo !== 'cuotas' && d.tipo !== 'libre') e.tipo = 'Elige el tipo de deuda.';
    d.capitalInicial = monto(raw.capitalInicial, e, 'capitalInicial');
    d.tasaMensualPct = 0; d.numCuotas = 0; d.valorCuota = 0; d.primeraCuota = null; d.diaPago = null;
    if (d.tipo === 'cuotas') {
      var t = raw.tasaMensualPct === '' || raw.tasaMensualPct == null ? 0 : Number(String(raw.tasaMensualPct).replace(',', '.'));
      if (!isFinite(t) || t < 0 || t > 100 || Math.round(t * 100) / 100 !== t) e.tasaMensualPct = 'La tasa mensual debe estar entre 0 y 100 %, con máximo 2 decimales.';
      else d.tasaMensualPct = t;
      d.numCuotas = entero(raw.numCuotas, e, 'numCuotas', 1, 600, 'El número de cuotas');
      d.valorCuota = monto(raw.valorCuota, e, 'valorCuota', { opcional: true });
      d.primeraCuota = fecha(raw.primeraCuota, e, 'primeraCuota', ctx);
      if (d.primeraCuota) d.diaPago = dates.partes(d.primeraCuota).d;
      if (!e.valorCuota && d.valorCuota > 0 && d.capitalInicial && !e.tasaMensualPct && d.valorCuota <= Math.round(d.capitalInicial * d.tasaMensualPct / 100)) {
        e.valorCuota = 'La cuota no alcanza ni a cubrir los intereses del primer mes.';
      }
    }
    return resultado(e, d);
  }

  // ctx: { maxPago, minPago, hoy }
  function validarPago(raw, ctx) {
    var e = {}, d = {};
    d.tipo = raw.tipo === 'extra' ? 'extra' : 'cuota';
    d.monto = monto(raw.monto, e, 'monto', {
      max: ctx.maxPago, msgMax: 'El pago no puede superar el saldo pendiente más el interés del periodo (' + money.format(ctx.maxPago || 0) + ').'
    });
    if (!e.monto && d.tipo === 'cuota' && ctx.minPago && d.monto < ctx.minPago) {
      e.monto = 'El pago no cubre los intereses del periodo (' + money.format(ctx.minPago) + ').';
    }
    d.fecha = fecha(raw.fecha, e, 'fecha', ctx);
    return resultado(e, d);
  }

  function validarPersona(raw, ctx) {
    var e = {}, d = {};
    d.nombre = texto(raw.nombre, e, 'nombre', 40, true, 'un nombre');
    if (!e.nombre) {
      var n = normalizar(d.nombre);
      if (n === 'yo') e.nombre = 'Ese nombre está reservado.';
      else if (ctx.estado.personas.some(function (p) { return p.id !== ctx.editId && normalizar(p.nombre) === n; })) e.nombre = 'Ya existe una persona con ese nombre.';
    }
    return resultado(e, d);
  }

  // raw.participantes: [{personaId, parte:number|null}]
  function validarCompartido(raw, ctx) {
    var e = {}, d = {};
    d.descripcion = texto(raw.descripcion, e, 'descripcion', 120, true, 'una descripción');
    d.total = monto(raw.total, e, 'total');
    d.fecha = fecha(raw.fecha, e, 'fecha', ctx);
    d.categoriaId = raw.categoriaId;
    var c = categoriaDe(ctx.estado, d.categoriaId);
    if (!c || c.tipo !== 'gasto') e.categoriaId = 'Elige una categoría de gasto.';
    var ps = Array.isArray(raw.participantes) ? raw.participantes : [];
    d.participantes = [];
    var vistos = {};
    var ids = ctx.estado.personas.map(function (p) { return p.id; });
    ps.forEach(function (p) {
      if (vistos[p.personaId]) e.participantes = 'Hay participantes repetidos.';
      vistos[p.personaId] = true;
      if (p.personaId !== 'yo' && ids.indexOf(p.personaId) < 0) e.participantes = 'Una persona no existe.';
      if (!Number.isInteger(p.parte) || p.parte < 0 || p.parte > money.MAX) e.partes = 'Revisa los valores de cada parte.';
      d.participantes.push({ personaId: p.personaId, parte: p.parte });
    });
    if (ps.length < 2) e.participantes = 'Elige al menos 2 participantes (tú y otra persona).';
    else if (!vistos.yo) e.participantes = 'Debes incluirte como participante.';
    if (!e.partes && !e.participantes && !e.total && money.suma(d.participantes.map(function (p) { return p.parte; })) !== d.total) {
      e.partes = 'Las partes deben sumar exactamente ' + money.format(d.total) + '.';
    }
    d.pagadoPor = raw.pagadoPor;
    if (!vistos[d.pagadoPor]) e.pagadoPor = 'Quien pagó debe ser uno de los participantes.';
    return resultado(e, d);
  }

  // ctx: { saldoAbs }
  function validarLiquidacion(raw, ctx) {
    var e = {}, d = {};
    d.monto = monto(raw.monto, e, 'monto', { max: ctx.saldoAbs, msgMax: 'No puedes liquidar más que el saldo (' + money.format(ctx.saldoAbs || 0) + ').' });
    d.fecha = fecha(raw.fecha, e, 'fecha', ctx);
    return resultado(e, d);
  }

  function validarAjustes(raw) {
    var e = {}, d = {};
    d.diaInicioMes = entero(raw.diaInicioMes, e, 'diaInicioMes', 1, 28, 'El día de inicio');
    d.tema = ['auto', 'claro', 'oscuro'].indexOf(raw.tema) >= 0 ? raw.tema : 'auto';
    d.nombreUsuario = texto(raw.nombreUsuario, e, 'nombreUsuario', 40, false, 'el nombre');
    return resultado(e, d);
  }

  // ---------- validación de un estado completo (importación / lectura) ----------
  var S = {
    id: function () { return { t: 'id' }; },
    idN: function () { return { t: 'id', nullable: true }; },
    str: function (max, req, def) { return { t: 'str', max: max, req: !!req, def: def === undefined ? '' : def }; },
    strN: function (max) { return { t: 'str', max: max, nullable: true }; },
    monto: function () { return { t: 'monto' }; },
    monto0: function (def) { return { t: 'monto0', def: def === undefined ? 0 : def }; },
    int: function (min, max, def) { var o = { t: 'int', min: min, max: max }; if (def !== undefined) o.def = def; return o; },
    num: function (min, max, def) { var o = { t: 'num', min: min, max: max }; if (def !== undefined) o.def = def; return o; },
    bool: function (def) { return { t: 'bool', def: !!def }; },
    en: function (vals, def) { var o = { t: 'enum', vals: vals }; if (def !== undefined) o.def = def; return o; },
    fecha: function () { return { t: 'fecha' }; },
    fechaN: function () { return { t: 'fecha', nullable: true }; },
    color: function () { return { t: 'color', def: '#64748B' }; },
    arr: function (of, max) { return { t: 'arr', of: of, max: max, def: [] }; },
    obj: function (campos, def) { var o = { t: 'obj', campos: campos }; if (def !== undefined) o.def = def; return o; }
  };

  var ESQ = S.obj({
    ajustes: S.obj({
      diaInicioMes: S.int(1, 28, 1), tema: S.en(['auto', 'claro', 'oscuro'], 'auto'),
      nombreUsuario: S.str(40, false, ''), ultimoExport: S.fechaN()
    }, {}),
    categorias: S.arr(S.obj({
      id: S.id(), nombre: S.str(40, true), tipo: S.en(['gasto', 'ingreso']), icono: S.str(8, false, '🏷️'),
      color: S.color(), archivada: S.bool(false), sistema: S.bool(false)
    }), 500),
    transacciones: S.arr(S.obj({
      id: S.id(), tipo: S.en(['gasto', 'ingreso']), monto: S.monto(), fecha: S.fecha(), categoriaId: S.id(),
      nota: S.str(120, false, ''), origen: S.en(ORIGENES, 'manual'), origenId: S.idN(), creadoEn: S.str(40, false, '')
    }), 200000),
    presupuestos: S.arr(S.obj({
      id: S.id(), categoriaId: S.idN(), limiteMensual: S.monto(), alertaPct: S.int(50, 100, 80)
    }), 1000),
    metas: S.arr(S.obj({
      id: S.id(), nombre: S.str(40, true), objetivo: S.monto(), fechaLimite: S.fechaN(),
      aportes: S.arr(S.obj({ id: S.id(), monto: S.monto(), fecha: S.fecha(), txId: S.idN() }), 5000),
      completada: S.bool(false), archivada: S.bool(false)
    }), 500),
    recurrentes: S.arr(S.obj({
      id: S.id(), tipo: S.en(['gasto', 'ingreso']), monto: S.monto(), categoriaId: S.id(), nota: S.str(120, true),
      frecuencia: S.en(FRECUENCIAS), diaDelMes: { t: 'int', min: 1, max: 31, nullable: true },
      diaSemana: { t: 'int', min: 0, max: 6, nullable: true }, inicio: S.fecha(), fin: S.fechaN(),
      ultimaGeneracion: S.fechaN(), activa: S.bool(true)
    }), 1000),
    deudas: S.arr(S.obj({
      id: S.id(), nombre: S.str(40, true), acreedor: S.str(40, false, ''), tipo: S.en(['cuotas', 'libre']),
      capitalInicial: S.monto(), tasaMensualPct: S.num(0, 100, 0), numCuotas: S.int(0, 600, 0), valorCuota: S.monto0(0),
      primeraCuota: S.fechaN(), diaPago: { t: 'int', min: 1, max: 31, nullable: true },
      pagos: S.arr(S.obj({ id: S.id(), fecha: S.fecha(), monto: S.monto(), tipo: S.en(['cuota', 'extra'], 'cuota'), txId: S.idN() }), 5000),
      archivada: S.bool(false)
    }), 500),
    personas: S.arr(S.obj({ id: S.id(), nombre: S.str(40, true) }), 500),
    compartidos: S.arr(S.obj({
      id: S.id(), descripcion: S.str(120, true), fecha: S.fecha(), total: S.monto(), categoriaId: S.id(),
      pagadoPor: S.id(), participantes: S.arr(S.obj({ personaId: S.id(), parte: S.monto0(0) }), 100), txId: S.idN()
    }), 20000),
    liquidaciones: S.arr(S.obj({
      id: S.id(), personaId: S.id(), monto: S.monto(), fecha: S.fecha(), sentido: S.en(['me_pagan', 'le_pago'])
    }), 20000)
  });

  function clonar(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  function lim(v, sp, path, errs) {
    if (v === undefined || v === null) {
      if (sp.nullable) return null;
      if (sp.t === 'obj' && 'def' in sp) v = {};
      else if ('def' in sp) return clonar(sp.def);
      else { errs.push(path + ': falta el dato'); return undefined; }
    }
    var n;
    switch (sp.t) {
      case 'id':
        if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) { errs.push(path + ': id no válido'); return undefined; }
        return v;
      case 'str':
        if (typeof v !== 'string') { errs.push(path + ': debe ser texto'); return undefined; }
        v = v.trim();
        if (v.length > sp.max) { errs.push(path + ': demasiado largo'); return undefined; }
        if (sp.req && v === '') { errs.push(path + ': vacío'); return undefined; }
        return v;
      case 'monto':
        if (!money.esMonto(v)) { errs.push(path + ': monto no válido'); return undefined; }
        return v;
      case 'monto0':
        if (!Number.isSafeInteger(v) || v < 0 || v > money.MAX) { errs.push(path + ': monto no válido'); return undefined; }
        return v;
      case 'int':
        if (!Number.isInteger(v) || v < sp.min || v > sp.max) { errs.push(path + ': entero fuera de rango'); return undefined; }
        return v;
      case 'num':
        if (typeof v !== 'number' || !isFinite(v) || v < sp.min || v > sp.max) { errs.push(path + ': número fuera de rango'); return undefined; }
        return v;
      case 'bool':
        if (typeof v !== 'boolean') { errs.push(path + ': debe ser verdadero/falso'); return undefined; }
        return v;
      case 'enum':
        if (sp.vals.indexOf(v) < 0) { errs.push(path + ': valor no permitido'); return undefined; }
        return v;
      case 'fecha':
        if (!dates.esValida(v)) { errs.push(path + ': fecha no válida'); return undefined; }
        return v;
      case 'color':
        return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : sp.def;
      case 'arr':
        if (!Array.isArray(v) || v.length > sp.max) { errs.push(path + ': lista no válida'); return undefined; }
        var out = [], ids = {};
        for (var i = 0; i < v.length; i++) {
          var it = lim(v[i], sp.of, path + '[' + i + ']', errs);
          if (it === undefined) continue;
          if (it && typeof it === 'object' && it.id !== undefined) {
            if (ids[it.id]) { errs.push(path + '[' + i + ']: id repetido'); continue; }
            ids[it.id] = true;
          }
          out.push(it);
        }
        return out;
      case 'obj':
        if (typeof v !== 'object' || Array.isArray(v)) { errs.push(path + ': debe ser un objeto'); return undefined; }
        var res = {};
        Object.keys(sp.campos).forEach(function (k) {
          var x = Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined;
          var r = lim(x, sp.campos[k], path ? path + '.' + k : k, errs);
          if (r !== undefined) res[k] = r;
        });
        return res;
    }
    return undefined;
  }

  function tieneClavesPeligrosas(v, prof) {
    if (prof > 12 || v === null || typeof v !== 'object') return prof > 12;
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length; i++) {
      if (ks[i] === '__proto__' || ks[i] === 'constructor' || ks[i] === 'prototype') return true;
      if (tieneClavesPeligrosas(v[ks[i]], prof + 1)) return true;
    }
    return false;
  }

  function validarEstado(raw) {
    var errs = [];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errores: ['El archivo no contiene un estado válido.'], estado: null };
    if (tieneClavesPeligrosas(raw, 0)) return { ok: false, errores: ['El archivo contiene claves no permitidas o es demasiado profundo.'], estado: null };
    if (!Number.isInteger(raw.version) || raw.version < 1) return { ok: false, errores: ['Falta la versión de los datos.'], estado: null };
    var est = lim(raw, ESQ, '', errs);
    if (est === undefined) return { ok: false, errores: errs.slice(0, 12), estado: null };
    est.version = raw.version;
    est.creadoEn = typeof raw.creadoEn === 'string' ? raw.creadoEn.slice(0, 40) : '';
    est.actualizadoEn = typeof raw.actualizadoEn === 'string' ? raw.actualizadoEn.slice(0, 40) : '';

    // referencias e integridad
    function ids(col) { var m = {}; est[col].forEach(function (x) { m[x.id] = true; }); return m; }
    var cats = ids('categorias'), pers = ids('personas'), txs = ids('transacciones');
    est.transacciones.forEach(function (t, i) { if (!cats[t.categoriaId]) errs.push('transacciones[' + i + ']: categoría inexistente'); });
    est.presupuestos.forEach(function (p, i) { if (p.categoriaId !== null && !cats[p.categoriaId]) errs.push('presupuestos[' + i + ']: categoría inexistente'); });
    est.recurrentes.forEach(function (r, i) { if (!cats[r.categoriaId]) errs.push('recurrentes[' + i + ']: categoría inexistente'); });
    est.metas.forEach(function (m, i) { m.aportes.forEach(function (a, j) { if (a.txId !== null && !txs[a.txId]) errs.push('metas[' + i + '].aportes[' + j + ']: movimiento inexistente'); }); });
    est.deudas.forEach(function (d, i) { d.pagos.forEach(function (a, j) { if (a.txId !== null && !txs[a.txId]) errs.push('deudas[' + i + '].pagos[' + j + ']: movimiento inexistente'); }); });
    est.compartidos.forEach(function (c, i) {
      var ok = {};
      if (!cats[c.categoriaId]) errs.push('compartidos[' + i + ']: categoría inexistente');
      if (c.txId !== null && !txs[c.txId]) errs.push('compartidos[' + i + ']: movimiento inexistente');
      c.participantes.forEach(function (p) {
        ok[p.personaId] = true;
        if (p.personaId !== 'yo' && !pers[p.personaId]) errs.push('compartidos[' + i + ']: persona inexistente');
      });
      if (!ok[c.pagadoPor]) errs.push('compartidos[' + i + ']: quien pagó no participa');
      if (money.suma(c.participantes.map(function (p) { return p.parte; })) !== c.total) errs.push('compartidos[' + i + ']: las partes no suman el total');
    });
    est.liquidaciones.forEach(function (l, i) { if (!pers[l.personaId]) errs.push('liquidaciones[' + i + ']: persona inexistente'); });
    return errs.length ? { ok: false, errores: errs.slice(0, 12), estado: null } : { ok: true, errores: [], estado: est };
  }

  var api = {
    normalizar: normalizar, validarMonto: validarMonto, validarTransaccion: validarTransaccion,
    validarCategoria: validarCategoria, validarPresupuesto: validarPresupuesto, validarMeta: validarMeta,
    validarAporte: validarAporte, validarRecurrente: validarRecurrente, validarDeuda: validarDeuda,
    validarPago: validarPago, validarPersona: validarPersona, validarCompartido: validarCompartido,
    validarLiquidacion: validarLiquidacion, validarAjustes: validarAjustes, validarEstado: validarEstado,
    FRECUENCIAS: FRECUENCIAS
  };
  SSP.validators = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
