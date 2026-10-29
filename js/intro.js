/* SantiSinPlata · animación de entrada con el logo de Haidiby Marketing Group.
   El HTML y el CSS la muestran desde el primer cuadro y la ocultan solos; este script
   solo permite saltarla con un toque, apagarla en Ajustes y volver a verla. */
(function (root) {
  'use strict';
  var SSP = root.SSP = root.SSP || {};

  var KEY = 'santisinplata:intro';
  var DURACION = 2300;   // ms; coincide con la animación CSS de salida

  // La animación está activa salvo que la persona la haya apagado
  function activa(storage) {
    try { return storage.getItem(KEY) !== 'no'; } catch (e) { return true; }
  }
  function fijar(storage, valor) {
    try { if (valor) storage.removeItem(KEY); else storage.setItem(KEY, 'no'); return true; } catch (e) { return false; }
  }

  var api = { KEY: KEY, DURACION: DURACION, activa: activa, fijar: fijar };

  if (typeof document !== 'undefined') {
    var almacen = null;
    try { almacen = root.localStorage; } catch (e) { almacen = null; }
    var plantilla = null;

    var enlazar = function (el) {
      var cerrada = false;
      function cerrar() {
        if (cerrada) return;
        cerrada = true;
        el.classList.add('saliendo');
        document.removeEventListener('keydown', cerrar);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
      }
      el.addEventListener('click', cerrar);
      document.addEventListener('keydown', cerrar);
      var reducido = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(cerrar, reducido ? 1300 : DURACION);
    };

    api.preferenciaActiva = function () { return almacen ? activa(almacen) : true; };
    api.fijarPreferencia = function (valor) { return almacen ? fijar(almacen, valor) : false; };
    api.mostrar = function () {
      if (!plantilla) return;
      var el = plantilla.cloneNode(true);
      document.body.insertBefore(el, document.body.firstChild);
      enlazar(el);
    };

    var inicial = document.getElementById('intro');
    if (inicial) {
      plantilla = inicial.cloneNode(true);
      if (almacen && !activa(almacen)) inicial.parentNode.removeChild(inicial);
      else enlazar(inicial);
    }
  }

  SSP.intro = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
