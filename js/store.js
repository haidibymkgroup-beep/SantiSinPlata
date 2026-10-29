/* SantiSinPlata · persistencia en localStorage, migraciones, respaldo, importar y exportar */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};
  function dep(n) { return SSP[n] || require('./' + n + '.js'); }
  var domain = dep('domain'), validators = dep('validators');

  var KEY = 'santisinplata:v1';
  var KEY_BACKUP = 'santisinplata:backup';
  var KEY_CORRUPTO = 'santisinplata:corrupto:';
  var MAX_IMPORT = 5 * 1024 * 1024;

  // MIGRACIONES[n] convierte la versión n en n+1 (no hay ninguna todavía: la versión actual es 1)
  var MIGRACIONES = {};

  function migrar(raw) {
    if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.version)) return { ok: false, error: 'Datos sin versión válida.' };
    if (raw.version > domain.VERSION) return { ok: false, error: 'Los datos son de una versión más nueva de la app (v' + raw.version + ').' };
    var est = raw;
    while (est.version < domain.VERSION) {
      var paso = MIGRACIONES[est.version];
      if (!paso) return { ok: false, error: 'No hay migración desde la versión ' + est.version + '.' };
      est = paso(est);
    }
    return { ok: true, estado: est, migrado: raw.version < domain.VERSION };
  }

  function esCuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message)));
  }

  // storage: cualquier objeto con getItem/setItem/removeItem (localStorage en el navegador)
  function crearStore(storage) {
    function leer(k) { try { return storage.getItem(k); } catch (e) { return null; } }
    function escribir(k, v) {
      try { storage.setItem(k, v); return { ok: true }; }
      catch (e) { return { ok: false, error: esCuota(e) ? 'cuota' : 'otro' }; }
    }

    // Interpreta texto JSON: migra y valida. Nunca lanza.
    function interpretar(texto) {
      var raw;
      try { raw = JSON.parse(texto); } catch (e) { return { ok: false, errores: ['JSON ilegible.'] }; }
      var mig = migrar(raw);
      if (!mig.ok) return { ok: false, errores: [mig.error] };
      var val = validators.validarEstado(mig.estado);
      if (!val.ok) return { ok: false, errores: val.errores };
      return { ok: true, estado: domain.asegurarSistema(val.estado), migrado: mig.migrado };
    }

    function disponible() {
      if (!storage) return false;
      try { storage.setItem('santisinplata:probe', '1'); storage.removeItem('santisinplata:probe'); return true; }
      catch (e) { return false; }
    }

    // → { status: 'ok'|'nuevo'|'corrupto'|'sin-almacenamiento', estado, errores? }
    function cargar() {
      if (!disponible()) return { status: 'sin-almacenamiento', estado: domain.estadoVacio() };
      var texto = leer(KEY);
      if (texto === null) return { status: 'nuevo', estado: domain.estadoVacio() };
      var r = interpretar(texto);
      if (r.ok) {
        if (r.migrado) escribir(KEY_BACKUP, texto);
        return { status: 'ok', estado: r.estado };
      }
      // No se sobrescribe: se conserva una copia del texto dañado
      escribir(KEY_CORRUPTO + Date.now(), texto);
      return { status: 'corrupto', estado: null, errores: r.errores };
    }

    function guardar(estado) {
      estado.actualizadoEn = new Date().toISOString();
      return escribir(KEY, JSON.stringify(estado));
    }

    function respaldar(estado) { return escribir(KEY_BACKUP, JSON.stringify(estado)); }

    function leerRespaldo() {
      var t = leer(KEY_BACKUP);
      if (t === null) return null;
      var r = interpretar(t);
      return r.ok ? r.estado : null;
    }

    // Borra los datos, el respaldo y las copias de datos dañados
    function borrarTodo() {
      try {
        var claves = [];
        if (typeof storage.length === 'number' && typeof storage.key === 'function') {
          for (var i = 0; i < storage.length; i++) claves.push(storage.key(i));
        }
        claves.filter(function (k) { return k && k.indexOf(KEY_CORRUPTO) === 0; }).forEach(function (k) { storage.removeItem(k); });
        storage.removeItem(KEY);
        storage.removeItem(KEY_BACKUP);
      } catch (e) { /* nada */ }
    }

    function leerCrudo() { return leer(KEY); }

    function bytesUsados() {
      var t = leer(KEY);
      return t ? t.length * 2 : 0;
    }

    return {
      cargar: cargar, leerCrudo: leerCrudo, guardar: guardar, respaldar: respaldar, leerRespaldo: leerRespaldo, borrarTodo: borrarTodo,
      bytesUsados: bytesUsados, interpretar: interpretar, disponible: disponible, KEY: KEY, KEY_BACKUP: KEY_BACKUP
    };
  }

  // ---------- importación / exportación ----------
  function resumenEstado(est) {
    return {
      movimientos: est.transacciones.length, presupuestos: est.presupuestos.length, metas: est.metas.length,
      recurrentes: est.recurrentes.length, deudas: est.deudas.length, personas: est.personas.length, compartidos: est.compartidos.length
    };
  }

  // Importa JSON no confiable → { ok, estado, resumen } | { ok:false, errores }
  function importarJSON(texto) {
    if (typeof texto !== 'string') return { ok: false, errores: ['Archivo no válido.'] };
    if (texto.length > MAX_IMPORT) return { ok: false, errores: ['El archivo supera los 5 MB.'] };
    var s = crearStore(null).interpretar(texto);
    if (!s.ok) return { ok: false, errores: s.errores };
    return { ok: true, estado: s.estado, resumen: resumenEstado(s.estado) };
  }

  function exportarJSON(est) { return JSON.stringify(est, null, 2); }

  // Neutraliza inyección de fórmulas en Excel/Sheets y escapa comillas, comas y saltos de línea
  function csvCelda(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportarCSV(est) {
    var filas = [['Fecha', 'Tipo', 'Categoría', 'Monto', 'Nota', 'Origen']];
    est.transacciones.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; }).forEach(function (t) {
      var c = domain.cat(est, t.categoriaId);
      filas.push([t.fecha, t.tipo, c ? c.nombre : '', t.monto, t.nota, t.origen]);
    });
    return '﻿' + filas.map(function (f) { return f.map(csvCelda).join(','); }).join('\r\n') + '\r\n';
  }

  var api = {
    KEY: KEY, KEY_BACKUP: KEY_BACKUP, crearStore: crearStore, migrar: migrar, importarJSON: importarJSON, exportarJSON: exportarJSON,
    exportarCSV: exportarCSV, csvCelda: csvCelda, resumenEstado: resumenEstado, esCuota: esCuota, MAX_IMPORT: MAX_IMPORT
  };
  SSP.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
