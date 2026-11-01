import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { money, domain, validators as V, store as storeMod, fondo, intro } from '../lib.js';
import { useApp, commit, toast, aplicarTema, almacen, reemplazar, borrarTodo, estadoActual, hoy as hoyFn } from '../estado.js';
import { useHojas } from '../ui/Hojas.jsx';
import { Formulario } from '../ui/Formulario.jsx';
import { Fila, IconoCat, Seccion, Tarjeta } from '../ui/Basicos.jsx';
import { contenedor, elemento } from '../ui/movimiento.js';
import { PieMarca, cargarEjemplo, confirmarEliminar } from './comun.jsx';
import { abrirExportar, exportar } from './Reportes.jsx';

const textoResumen = (r) => r.movimientos + ' movimientos, ' + r.presupuestos + ' presupuestos, ' + r.metas + ' metas, ' + r.recurrentes + ' recurrentes, ' + r.deudas + ' deudas y ' + r.compartidos + ' gastos compartidos';

function procesarImportacion(hojas, texto) {
  const r = storeMod.importarJSON(texto);
  if (!r.ok) {
    hojas.abrir({
      titulo: 'No se pudo importar',
      contenido: () => (
        <>
          <p className="ayuda">El archivo no es un respaldo válido de SantiSinPlata. Tus datos actuales no se tocaron.</p>
          <ul className="errores-lista">{r.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </>
      )
    });
    return;
  }
  hojas.confirmar({ titulo: 'Reemplazar tus datos', mensaje: 'El archivo trae ' + textoResumen(r.resumen) + '. Se reemplazarán tus datos actuales (antes se guarda una copia de seguridad automática).', textoOk: 'Importar', peligro: true })
    .then((ok) => { if (ok) reemplazar(r.estado, 'Datos importados'); });
}

// ---------- categorías ----------
function nuevaCategoria(hojas) {
  hojas.abrir({
    titulo: 'Nueva categoría',
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar}
        campos={[
          { n: 'nombre', t: 'texto', et: 'Nombre', max: 40 },
          { n: 'tipo', t: 'segmentado', et: 'Tipo', opciones: [{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }], valor: 'gasto' },
          { n: 'icono', t: 'texto', et: 'Ícono (un emoji)', max: 8, valor: '🏷️' },
          { n: 'color', t: 'custom', et: 'Color', valor: '#9C297F', render: ({ valor, set, id }) => <input type="color" id={id} className="entrada-color" value={valor} onChange={(e) => set(e.target.value)} /> }
        ]}
        validar={(raw) => V.validarCategoria(raw, { estado: estadoActual() })}
        onGuardar={(datos) => { commit((est) => { domain.crearCategoria(est, datos); }, { mensaje: 'Categoría creada', deshacer: false }); }} />
    )
  });
}

function Categorias({ hojas }) {
  const { estado } = useApp();
  return (
    <>
      <button type="button" className="btn primario bloque" onClick={() => nuevaCategoria(hojas)}>Nueva categoría</button>
      {['gasto', 'ingreso'].map((tipo) => (
        <div key={tipo}>
          <Seccion titulo={tipo === 'gasto' ? 'De gasto' : 'De ingreso'} />
          <div className="lista tarjeta">
            {estado.categorias.filter((c) => c.tipo === tipo).map((c) => (
              <Fila key={c.id} icono={<IconoCat cat={c} />} titulo={c.nombre + (c.archivada ? ' (archivada)' : '')} clase={c.archivada ? 'tenue' : ''}
                derecha={(
                  <span className="fila-acciones">
                    {c.sistema ? <span className="etiqueta-mini">Sistema</span> : (
                      <>
                        <button type="button" className="btn texto" onClick={() => commit((est) => { domain.archivarCategoria(est, c.id, !c.archivada); }, { deshacer: false })}>{c.archivada ? 'Restaurar' : 'Archivar'}</button>
                        <button type="button" className="btn texto peligro-txt" onClick={() => {
                          if (domain.categoriaEnUso(estadoActual(), c.id)) { toast('Tiene movimientos o presupuestos: archívala en lugar de eliminarla.', { error: true }); return; }
                          confirmarEliminar(hojas, '¿Eliminar categoría?', '«' + c.nombre + '» se eliminará.').then((ok) => {
                            if (ok) commit((est) => { domain.eliminarCategoria(est, c.id); }, { deshacer: false });
                          });
                        }}>Eliminar</button>
                      </>
                    )}
                  </span>
                )} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- fondo ----------
function SeccionFondo() {
  const [cfg, setCfg] = useState(() => fondo.cargar());
  const [velo, setVelo] = useState(cfg ? cfg.velo : fondo.VELO_DEF);
  const archivo = useRef(null);
  const n = fondo.normalizar(cfg);
  const estiloVista = {
    backgroundImage: !n ? 'none' : (n.tipo === 'foto' ? 'url("' + n.img + '")' : fondo.DEGRADADO),
    '--velo': String(velo / 100)
  };
  const aplicarCfg = (c) => { fondo.aplicar(c); setCfg(c); };

  const alElegir = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    toast('Preparando la foto…', { ms: 2500 });
    fondo.procesarFoto(f).then((img) => {
      const nuevo = { tipo: 'foto', img, velo };
      const r = fondo.guardar(nuevo);
      if (!r.ok) { toast(r.error === 'cuota' ? 'No hay espacio para guardar esa foto. Prueba con otra más liviana.' : 'No se pudo guardar el fondo en este navegador.', { error: true }); return; }
      aplicarCfg(nuevo);
      toast('Fondo actualizado.');
    }).catch((err) => toast((err && err.message) || 'No se pudo usar esa foto.', { error: true }));
  };
  const alMover = (e) => {
    const v = Number(e.target.value);
    setVelo(v);
    if (cfg) { const c = { ...cfg, velo: v }; fondo.aplicar(c); }
  };
  const guardarVelo = () => { if (cfg && cfg.velo !== velo) { const c = { ...cfg, velo }; fondo.guardar(c); setCfg(c); } };
  // Se guarda poco después del último movimiento del control (también con teclado o lectores de pantalla)
  useEffect(() => {
    if (!cfg || cfg.velo === velo) return undefined;
    const t = setTimeout(guardarVelo, 250);
    return () => clearTimeout(t);
  }, [velo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tarjeta>
      <div className="fondo-vista" role="img" aria-label={cfg ? 'Vista previa del fondo actual' : 'Sin fondo personalizado'} style={estiloVista}>
        <div className="fondo-velo" />
        {!cfg && <span>Sin fondo personalizado</span>}
      </div>
      <div className="acciones">
        <button type="button" className="btn primario" onClick={() => archivo.current.click()}>Elegir foto</button>
        <button type="button" className="btn secundario" onClick={() => { const d = { tipo: 'degradado', velo }; fondo.guardar(d); aplicarCfg(d); }}>Degradado de la marca</button>
      </div>
      <div className="campo">
        <span className="etiqueta">Intensidad del fondo</span>
        <input type="range" className="rango" min="0" max={fondo.VELO_MAX} step="5" value={velo} disabled={!cfg} aria-label="Qué tanto se atenúa el fondo"
          onChange={alMover} onPointerUp={guardarVelo} onKeyUp={guardarVelo} onBlur={guardarVelo} />
        <div className="rango-pie"><span>Más fondo</span><span>Más legible</span></div>
      </div>
      {cfg && <button type="button" className="btn texto peligro-txt" onClick={() => { fondo.quitar(); fondo.aplicar(null); setCfg(null); toast('Fondo quitado.'); }}>Quitar fondo</button>}
      <p className="ayuda">La foto se elige de la fototeca de tu celular y se reduce para ocupar poco espacio. Se guarda solo en este dispositivo y no va en los respaldos.</p>
      <input ref={archivo} type="file" accept="image/*" hidden aria-label="Elegir una foto de fondo" onChange={alElegir} />
    </Tarjeta>
  );
}

export default function Ajustes() {
  const { estado: est, aviso } = useApp();
  const hojas = useHojas();
  const a = est.ajustes;
  const archivoJson = useRef(null);
  const [animacion, setAnimacion] = useState(() => intro.preferenciaActiva());
  const respaldo = almacen.leerRespaldo();
  const kb = Math.max(1, Math.round(almacen.bytesUsados() / 1024));

  const alElegirJson = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > storeMod.MAX_IMPORT) { toast('El archivo supera los 5 MB.', { error: true }); return; }
    const lector = new FileReader();
    lector.onload = () => procesarImportacion(hojas, String(lector.result));
    lector.onerror = () => toast('No se pudo leer el archivo.', { error: true });
    lector.readAsText(f);
  };

  return (
    <m.div className="pantalla columnas" variants={contenedor} initial="oculto" animate="visible">
      <Seccion titulo="Preferencias" />
      <Tarjeta>
        <Formulario cerrar={() => {}} guardar="Guardar preferencias"
          campos={[
            { n: 'nombreUsuario', t: 'texto', et: 'Tu nombre (opcional)', max: 40, valor: a.nombreUsuario },
            { n: 'diaInicioMes', t: 'numero', et: 'Día en que empieza tu mes', ayuda: '1 = mes calendario. Si cobras el 15, pon 15 y tus reportes irán del 15 al 14 (máx. 28).', valor: String(a.diaInicioMes) },
            { n: 'tema', t: 'segmentado', et: 'Tema', opciones: [{ v: 'auto', t: 'Auto' }, { v: 'claro', t: 'Claro' }, { v: 'oscuro', t: 'Oscuro' }], valor: a.tema }
          ]}
          validar={(raw) => V.validarAjustes(raw)}
          onGuardar={(d) => {
            commit((s) => { s.ajustes.nombreUsuario = d.nombreUsuario; s.ajustes.diaInicioMes = d.diaInicioMes; s.ajustes.tema = d.tema; }, { mensaje: 'Preferencias guardadas', deshacer: false });
            aplicarTema(d.tema);
            return false;
          }} />
      </Tarjeta>

      <Seccion titulo="Fondo de la app" />
      <SeccionFondo />

      <Seccion titulo="Inicio de la app" />
      <Tarjeta>
        <label className="check" htmlFor="chk-intro">
          <input type="checkbox" id="chk-intro" checked={animacion} onChange={(e) => { setAnimacion(e.target.checked); intro.fijarPreferencia(e.target.checked); }} />
          <span>Mostrar la animación al abrir la app</span>
        </label>
        <div className="acciones"><button type="button" className="btn secundario" onClick={() => intro.mostrar()}>Ver animación</button></div>
      </Tarjeta>

      <Seccion titulo="Categorías" />
      <Tarjeta clase="lista">
        <Fila icono="🏷️" titulo="Administrar categorías" sub="Crear, archivar o eliminar"
          onClick={() => hojas.abrir({ titulo: 'Categorías', contenido: () => <Categorias hojas={hojas} /> })} />
      </Tarjeta>

      <Seccion titulo="Tus datos" />
      <Tarjeta clase="lista">
        <Fila icono="📄" titulo="Exportar movimientos (CSV)" sub="Para Excel o Google Sheets" onClick={() => exportar(est, 'csv')} />
        <Fila icono="💾" titulo="Exportar respaldo (JSON)" sub="Copia completa de la app" onClick={() => exportar(est, 'json')} />
        <Fila icono="📥" titulo="Importar respaldo (JSON)" sub="Reemplaza los datos actuales" onClick={() => archivoJson.current.click()} />
        {respaldo && <Fila icono="⏪" titulo="Restaurar copia automática" sub={textoResumen(storeMod.resumenEstado(respaldo))}
          onClick={() => hojas.confirmar({ titulo: 'Restaurar copia', mensaje: 'Se reemplazarán tus datos actuales por la última copia automática.', textoOk: 'Restaurar', peligro: true }).then((ok) => { if (ok) reemplazar(respaldo, 'Copia restaurada'); })} />}
        <Fila icono="🧪" titulo="Cargar datos de ejemplo" sub="Para explorar la app llena" onClick={() => cargarEjemplo(hojas, reemplazar)} />
      </Tarjeta>
      <input ref={archivoJson} type="file" accept=".json,application/json" hidden aria-label="Archivo JSON para importar" onChange={alElegirJson} />

      <Seccion titulo="Almacenamiento" />
      <Tarjeta clase="nota">
        <p>{'Usando aprox. ' + kb + ' KB de ~5.000 KB disponibles en este navegador.'}</p>
        <p className="ayuda">Tus datos viven solo en este navegador de este dispositivo. Si borras los datos del sitio, usas modo privado o desinstalas el navegador, se pierden. Exportar el JSON es tu respaldo real: hazlo de vez en cuando. No hay cifrado ni clave.</p>
        {aviso ? <p className="error">{aviso}</p> : null}
      </Tarjeta>

      <Seccion titulo="Zona de peligro" />
      <m.button variants={elemento} type="button" className="btn peligro bloque" whileTap={{ scale: 0.98 }} onClick={() => {
        hojas.confirmar({ titulo: '¿Borrar todo?', mensaje: 'Se eliminarán movimientos, presupuestos, metas, deudas y todo lo demás de este dispositivo. Considera exportar un respaldo antes.', textoOk: 'Continuar', peligro: true }).then((ok) => {
          if (!ok) return;
          hojas.confirmar({ titulo: 'Confirmación final', mensaje: 'Esta acción no se puede deshacer.', textoOk: 'Borrar todo', peligro: true, escribir: 'BORRAR' }).then((ok2) => { if (ok2) borrarTodo(); });
        });
      }}>Borrar todos los datos</m.button>

      <Seccion titulo="Acerca de" />
      <Tarjeta clase="acerca">
        <span className="logo-marca" role="img" aria-label="Haidiby Marketing Group" />
        <p>SantiSinPlata es una app de Haidiby Marketing Group.</p>
      </Tarjeta>
      <p className="version">{'SantiSinPlata · versión de datos ' + domain.VERSION}</p>
    </m.div>
  );
}
