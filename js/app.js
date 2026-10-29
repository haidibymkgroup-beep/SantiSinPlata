/* SantiSinPlata · arranque: carga el estado, genera recurrentes y pinta la primera pantalla */
(function (root) {
  'use strict';
  var SSP = root.SSP, ui = SSP.ui, h = ui.h, domain = SSP.domain, dates = SSP.dates, storeMod = SSP.store;

  var almacenamiento = null;
  try { almacenamiento = root.localStorage; } catch (e) { almacenamiento = null; }
  var store = storeMod.crearStore(almacenamiento);

  var App = {
    estado: null, store: store, aviso: '', bloqueado: false, sinAlmacenamiento: false,
    hoy: dates.hoy,
    render: function () { SSP.vistas.render(); }
  };

  function exportarRespaldo() {
    if (!App.estado) return;
    ui.descargar('santisinplata-respaldo-' + App.hoy() + '.json', 'application/json', storeMod.exportarJSON(App.estado));
  }

  function guardar() {
    if (App.sinAlmacenamiento || App.bloqueado) return { ok: false, error: 'omitido' };
    var r = store.guardar(App.estado);
    if (!r.ok) {
      ui.toast(r.error === 'cuota' ? 'No hay espacio para guardar. Exporta un respaldo y libera datos.' : 'No se pudo guardar en este navegador.',
        { error: true, ms: 10000, accion: { texto: 'Exportar', fn: exportarRespaldo } });
    }
    return r;
  }

  // Aplica un cambio sobre el estado: valida (el mutador lanza Error si algo no cuadra), guarda, pinta y ofrece deshacer.
  App.commit = function (fn, op) {
    op = op || {};
    var antes = JSON.stringify(App.estado), r;
    try { r = fn(App.estado); }
    catch (e) {
      App.estado = JSON.parse(antes);
      ui.toast((e && e.message) || 'No se pudo completar la acción.', { error: true });
      App.render();
      return false;
    }
    var g = guardar();
    App.render();
    // si no se pudo guardar, el aviso de error ya está en pantalla: no lo tapamos con un "guardado"
    if (op.mensaje && (g.ok || g.error === 'omitido')) {
      ui.toast(op.mensaje, op.deshacer === false ? {} : {
        accion: { texto: 'Deshacer', fn: function () { App.estado = JSON.parse(antes); guardar(); App.render(); } }
      });
    }
    return r === undefined ? true : r;
  };

  function generarRecurrentes() {
    var n = domain.materializarRecurrentes(App.estado, App.hoy());
    if (n > 0) guardar();
    return n;
  }

  // Reemplaza todo el estado (importar, restaurar, ejemplo). Antes guarda una copia automática.
  App.reemplazar = function (nuevo, mensaje) {
    if (!App.sinAlmacenamiento && !App.bloqueado) store.respaldar(App.estado);
    App.estado = domain.asegurarSistema(nuevo);
    generarRecurrentes();
    guardar();
    ui.aplicarTema(App.estado.ajustes.tema);
    SSP.vistas.irA('inicio');
    if (mensaje) ui.toast(mensaje, {});
  };

  App.borrarTodo = function () {
    store.borrarTodo();
    App.estado = domain.estadoVacio();
    guardar();
    ui.aplicarTema('auto');
    SSP.vistas.irA('inicio');
    ui.toast('Se borraron todos los datos.', {});
  };

  // Datos ilegibles: no se tocan hasta que la persona decida qué hacer
  function recuperar(errores) {
    App.bloqueado = true;
    var hj = ui.hoja({ titulo: 'No pudimos leer tus datos', bloqueante: true });
    var respaldo = store.leerRespaldo();
    function resolver(estado, msg) {
      App.bloqueado = false;
      App.estado = domain.asegurarSistema(estado);
      generarRecurrentes();
      guardar();
      ui.aplicarTema(App.estado.ajustes.tema);
      hj.cerrar();
      SSP.vistas.irA('inicio');
      ui.toast(msg, {});
    }
    var archivo = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Archivo de respaldo' });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      var lector = new FileReader();
      lector.onload = function () {
        var r = storeMod.importarJSON(String(lector.result));
        if (r.ok) resolver(r.estado, 'Respaldo importado'); else ui.toast('Ese archivo no es un respaldo válido.', { error: true });
      };
      lector.readAsText(f);
      archivo.value = '';
    });
    hj.el.appendChild(h('p', { class: 'dialogo-msg', texto: 'La información guardada en este navegador está dañada o incompleta. No la borramos: guardamos una copia aparte. Elige cómo seguir.' }));
    if (errores && errores.length) hj.el.appendChild(h('ul', { class: 'errores-lista' }, errores.slice(0, 4).map(function (e) { return h('li', { texto: e }); })));
    var filas = [];
    if (respaldo) filas.push(ui.fila({ icono: '⏪', titulo: 'Restaurar la última copia automática', sub: storeMod.resumenEstado(respaldo).movimientos + ' movimientos', onclick: function () { resolver(respaldo, 'Copia restaurada'); } }));
    filas.push(ui.fila({ icono: '📥', titulo: 'Importar un archivo de respaldo (JSON)', onclick: function () { archivo.click(); } }));
    filas.push(ui.fila({ icono: '💾', titulo: 'Descargar los datos dañados', sub: 'Por si quieres revisarlos o recuperarlos a mano', onclick: function () { ui.descargar('santisinplata-danado.json', 'application/json', store.leerCrudo() || ''); } }));
    filas.push(ui.fila({ icono: '🆕', titulo: 'Empezar con datos vacíos', sub: 'La copia dañada se conserva en el navegador', onclick: function () { resolver(domain.estadoVacio(), 'Empezamos de cero'); } }));
    hj.el.appendChild(h('div', { class: 'lista tarjeta' }, filas));
    hj.el.appendChild(archivo);
  }

  function iniciar() {
    var r = store.cargar();
    if (r.status === 'corrupto') {
      App.estado = domain.estadoVacio();
      SSP.vistas.montar(App);
      SSP.vistas.render();
      recuperar(r.errores);
      return;
    }
    App.estado = domain.asegurarSistema(r.estado);
    if (r.status === 'sin-almacenamiento') {
      App.sinAlmacenamiento = true;
      App.aviso = 'Este navegador no permite guardar datos (¿modo privado?). Lo que registres se perderá al cerrar.';
    }
    ui.aplicarTema(App.estado.ajustes.tema);
    generarRecurrentes();
    if (r.status === 'nuevo') guardar();
    SSP.vistas.montar(App);
    SSP.vistas.render();
  }

  // Al volver a la app (otro día, otra pestaña) se generan los recurrentes que falten
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !App.estado || App.bloqueado) return;
    generarRecurrentes();
    App.render();
  });

  if (root.matchMedia) {
    var mq = root.matchMedia('(prefers-color-scheme: dark)');
    var cambio = function () { if (App.estado) ui.aplicarTema(App.estado.ajustes.tema); };
    if (mq.addEventListener) mq.addEventListener('change', cambio);
  }

  root.addEventListener('error', function () {
    ui.toast('Ocurrió un error inesperado. Si algo no se ve bien, recarga la página.', { error: true });
  });

  SSP.app = App;
  iniciar();
})(window);
