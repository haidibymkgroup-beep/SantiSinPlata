/* SantiSinPlata · fechas locales "YYYY-MM-DD" (sin hora ni zona) */
(function (root) {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = '0' + n; return n; }
  function diasDelMes(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function esValida(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    return y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(y, m);
  }

  function partes(s) { return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) }; }
  function fmt(y, m, d) { return pad(y, 4) + '-' + pad(m) + '-' + pad(d); }

  // Fecha en el mes (y, m) con m posiblemente fuera de 1..12; si el día no existe usa el último del mes.
  function fechaEnMes(y, m, d) {
    var t = (y * 12 + (m - 1));
    var yy = Math.floor(t / 12), mm = (t % 12 + 12) % 12 + 1;
    return fmt(yy, mm, Math.min(d, diasDelMes(yy, mm)));
  }

  function aDias(s) { var p = partes(s); return Date.UTC(p.y, p.m - 1, p.d) / 86400000; }
  function deDias(n) {
    var dt = new Date(n * 86400000);
    return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  function sumarDias(s, n) { return deDias(aDias(s) + n); }
  function sumarMeses(s, n) { var p = partes(s); return fechaEnMes(p.y, p.m + n, p.d); }
  function diferenciaDias(a, b) { return aDias(b) - aDias(a); }
  function diaSemana(s) { return new Date(aDias(s) * 86400000).getUTCDay(); }
  function ultimoDia(y, m) { return fmt(y, m, diasDelMes(y, m)); }

  // Meses completos transcurridos entre a y b (0 si b <= a)
  function mesesCompletos(a, b) {
    if (b <= a) return 0;
    var pa = partes(a), pb = partes(b);
    var m = (pb.y - pa.y) * 12 + (pb.m - pa.m);
    if (pb.d < pa.d) m -= 1;
    return Math.max(0, m);
  }

  function hoy() {
    var d = new Date();
    return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // Periodo ("mes") que contiene a ref y arranca el día diaInicio (1..28). Extremos inclusivos.
  function rangoDelMes(ref, diaInicio) {
    diaInicio = diaInicio || 1;
    var p = partes(ref);
    var desde = p.d >= diaInicio ? fmt(p.y, p.m, diaInicio) : fechaEnMes(p.y, p.m - 1, diaInicio);
    var pd = partes(desde);
    var hasta = sumarDias(fechaEnMes(pd.y, pd.m + 1, diaInicio), -1);
    return { desde: desde, hasta: hasta, dias: diferenciaDias(desde, hasta) + 1 };
  }

  // Periodo desplazado k meses respecto del que contiene ref
  function desplazarPeriodo(ref, diaInicio, k) {
    var r = rangoDelMes(ref, diaInicio), p = partes(r.desde);
    return rangoDelMes(fechaEnMes(p.y, p.m + k, diaInicio || 1), diaInicio);
  }

  function etiquetaPeriodo(rango, diaInicio) {
    var p = partes(rango.desde);
    if (!diaInicio || diaInicio === 1) return MESES[p.m - 1].charAt(0).toUpperCase() + MESES[p.m - 1].slice(1) + ' ' + p.y;
    return corto(rango.desde) + ' – ' + corto(rango.hasta);
  }

  function corto(s) { var p = partes(s); return p.d + ' ' + MESES_CORTO[p.m - 1]; }
  function largo(s) { var p = partes(s); return p.d + ' de ' + MESES[p.m - 1] + ' de ' + p.y; }
  function etiquetaDia(s, hoyS) {
    if (s === hoyS) return 'Hoy';
    if (s === sumarDias(hoyS, -1)) return 'Ayer';
    var p = partes(s);
    return DIAS_CORTO[diaSemana(s)] + ' ' + p.d + ' ' + MESES_CORTO[p.m - 1] + (p.y !== partes(hoyS).y ? ' ' + p.y : '');
  }
  function mesCorto(s) { return MESES_CORTO[partes(s).m - 1]; }

  var api = {
    MESES: MESES, DIAS_CORTO: DIAS_CORTO, diasDelMes: diasDelMes, esValida: esValida, partes: partes, fmt: fmt,
    fechaEnMes: fechaEnMes, sumarDias: sumarDias, sumarMeses: sumarMeses, diferenciaDias: diferenciaDias,
    diaSemana: diaSemana, ultimoDia: ultimoDia, mesesCompletos: mesesCompletos, hoy: hoy,
    rangoDelMes: rangoDelMes, desplazarPeriodo: desplazarPeriodo, etiquetaPeriodo: etiquetaPeriodo,
    corto: corto, largo: largo, etiquetaDia: etiquetaDia, mesCorto: mesCorto
  };
  root.SSP = root.SSP || {};
  root.SSP.dates = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
