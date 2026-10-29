/* SantiSinPlata · fondo personalizable (foto de la fototeca o degradado de la marca).
   Se guarda aparte de los datos (clave propia) para no inflar los respaldos. */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};

  var KEY = 'santisinplata:fondo';
  var DEGRADADO = 'linear-gradient(160deg, #9C297F 0%, #CA2374 40%, #E4406F 72%, #FE9191 100%)';
  var VELO_DEF = 60, VELO_MAX = 85, LADO_MAX = 1400, BYTES_MAX = 900 * 1024;

  // Tamaño final conservando la proporción; no agranda
  function escala(w, h, max) {
    var m = Math.max(w, h);
    if (m <= max) return { w: w, h: h };
    var f = max / m;
    return { w: Math.max(1, Math.round(w * f)), h: Math.max(1, Math.round(h * f)) };
  }

  // Devuelve una configuración válida o null (nunca confía en lo que lee del almacenamiento)
  function normalizar(c) {
    if (!c || typeof c !== 'object') return null;
    var velo = Number.isInteger(c.velo) && c.velo >= 0 && c.velo <= VELO_MAX ? c.velo : VELO_DEF;
    if (c.tipo === 'degradado') return { v: 1, tipo: 'degradado', velo: velo };
    if (c.tipo === 'foto' && typeof c.img === 'string' && c.img.length <= 2000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(c.img)) {
      return { v: 1, tipo: 'foto', img: c.img, velo: velo };
    }
    return null;
  }

  // storage: cualquier objeto con getItem/setItem/removeItem
  function crear(storage) {
    return {
      cargar: function () {
        try { var t = storage.getItem(KEY); return t ? normalizar(JSON.parse(t)) : null; } catch (e) { return null; }
      },
      guardar: function (cfg) {
        var n = normalizar(cfg);
        if (!n) return { ok: false, error: 'invalido' };
        try { storage.setItem(KEY, JSON.stringify(n)); return { ok: true }; }
        catch (e) { return { ok: false, error: 'cuota' }; }
      },
      quitar: function () { try { storage.removeItem(KEY); } catch (e) { /* nada */ } }
    };
  }

  var almacenamiento = null;
  try { almacenamiento = root.localStorage; } catch (e) { almacenamiento = null; }
  var local = almacenamiento ? crear(almacenamiento) : { cargar: function () { return null; }, guardar: function () { return { ok: false, error: 'sin-almacenamiento' }; }, quitar: function () {} };

  // ---------- navegador ----------
  function aplicar(cfg) {
    if (typeof document === 'undefined') return;
    var capa = document.getElementById('fondo-app');
    if (!capa) return;
    var n = normalizar(cfg);
    document.documentElement.classList.toggle('con-fondo', !!n);
    capa.style.backgroundImage = !n ? 'none' : (n.tipo === 'foto' ? 'url("' + n.img + '")' : DEGRADADO);
    capa.style.setProperty('--velo', String((n ? n.velo : VELO_DEF) / 100));
  }

  function leerArchivo(archivo) {
    return new Promise(function (ok, mal) {
      var lector = new FileReader();
      lector.onload = function () { ok(String(lector.result)); };
      lector.onerror = function () { mal(new Error('No se pudo leer la foto.')); };
      lector.readAsDataURL(archivo);
    });
  }

  function cargarImagen(url) {
    return new Promise(function (ok, mal) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { mal(new Error('Ese archivo no es una imagen compatible.')); };
      img.src = url;
    });
  }

  // Foto del celular → JPEG reducido (cabe en localStorage y carga rápido). Devuelve el data URL.
  function procesarFoto(archivo) {
    if (!archivo || !/^image\//.test(archivo.type || '')) return Promise.reject(new Error('Elige una imagen.'));
    if (archivo.size > 25 * 1024 * 1024) return Promise.reject(new Error('La foto pesa demasiado (máx. 25 MB).'));
    return leerArchivo(archivo).then(cargarImagen).then(function (img) {
      var t = escala(img.naturalWidth || img.width, img.naturalHeight || img.height, LADO_MAX);
      var lienzo = document.createElement('canvas');
      lienzo.width = t.w; lienzo.height = t.h;
      var ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, t.w, t.h);
      ctx.drawImage(img, 0, 0, t.w, t.h);
      var calidad = 0.78, out = lienzo.toDataURL('image/jpeg', calidad);
      while (out.length > BYTES_MAX * 1.37 && calidad > 0.4) { calidad -= 0.1; out = lienzo.toDataURL('image/jpeg', calidad); }
      return out;
    });
  }

  var api = {
    KEY: KEY, DEGRADADO: DEGRADADO, VELO_DEF: VELO_DEF, VELO_MAX: VELO_MAX, escala: escala, normalizar: normalizar, crear: crear,
    cargar: local.cargar, guardar: local.guardar, quitar: local.quitar, aplicar: aplicar, procesarFoto: procesarFoto
  };
  SSP.fondo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
