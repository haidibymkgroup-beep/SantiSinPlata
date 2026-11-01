import { money, dates, domain, validators as V } from '../lib.js';
import { commit, estadoActual, hoy, irA } from '../estado.js';
import { Formulario } from '../ui/Formulario.jsx';
import { Fila, IconoCat, MontoEl } from '../ui/Basicos.jsx';

export const ORIGEN = { manual: '', recurrente: 'Recurrente', cuota: 'Pago de deuda', meta: 'Aporte a meta', compartido: 'Compartido' };

export const cat = (id) => domain.cat(estadoActual(), id);

// Categorías ordenadas por uso reciente; las de sistema (Ahorro, Deudas) solo si se piden
export function catOpciones(tipo, actualId, incluirSistema) {
  const est = estadoActual();
  const uso = domain.usoCategorias(est, hoy());
  const lista = est.categorias.map((c, i) => ({ c, i })).filter(({ c }) =>
    c.tipo === tipo && ((!c.archivada && (incluirSistema || !c.sistema)) || c.id === actualId));
  lista.sort((a, b) => (uso[b.c.id] || 0) - (uso[a.c.id] || 0) || a.i - b.i);
  return lista.map(({ c }) => ({ v: c.id, t: c.nombre, icono: c.icono }));
}

export function ordenarMovs(txs) {
  return txs.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : 0)));
}

export const confirmarEliminar = (hojas, titulo, mensaje) => hojas.confirmar({ titulo, mensaje, textoOk: 'Eliminar', peligro: true });

export function eliminarMovimiento(hojas, tx, cerrar) {
  const extra = tx.origen === 'meta' ? ' También se quitará ese aporte de la meta.'
    : tx.origen === 'cuota' ? ' También se quitará ese pago de la deuda.'
      : tx.origen === 'compartido' ? ' También se eliminará ese gasto compartido.' : '';
  confirmarEliminar(hojas, '¿Eliminar movimiento?', money.format(tx.monto) + (tx.nota ? ' · ' + tx.nota : '') + '.' + extra).then((ok) => {
    if (!ok) return;
    commit((est) => { domain.eliminarTx(est, tx.id); }, { mensaje: 'Movimiento eliminado' });
    if (cerrar) cerrar();
  });
}

// ---------- registro rápido ----------
export function abrirRegistro(hojas, tx) {
  const editando = !!tx;
  const tipoIni = tx ? tx.tipo : 'gasto';
  const catIni = tx ? tx.categoriaId : (catOpciones(tipoIni)[0] || {}).v;
  const msgGuardado = (d) => (d.tipo === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado') + ': ' + money.format(d.monto);
  hojas.abrir({
    titulo: editando ? 'Editar movimiento' : 'Nuevo movimiento',
    clase: 'registro',
    contenido: ({ cerrar }) => (
      <Formulario
        cerrar={cerrar}
        campos={[
          { n: 'tipo', t: 'segmentado', opciones: [{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }], valor: tipoIni,
            onchange: (v, { set }) => { const o = catOpciones(v); set('categoriaId', o[0] && o[0].v); } },
          { n: 'monto', t: 'monto', et: 'Monto', placeholder: '0', valor: tx ? String(tx.monto) : '' },
          { n: 'categoriaId', t: 'chips', et: 'Categoría', opciones: (v) => catOpciones(v.tipo, tx && tx.categoriaId), valor: catIni },
          { n: 'fecha', t: 'fecha', et: 'Fecha', valor: tx ? tx.fecha : hoy(), min: '2000-01-01', max: dates.sumarMeses(hoy(), 12),
            atajos: [{ t: 'Hoy', v: () => hoy() }, { t: 'Ayer', v: () => dates.sumarDias(hoy(), -1) }] },
          { n: 'nota', t: 'texto', et: 'Nota (opcional)', max: 120, placeholder: 'Ej. Almuerzo con Ana', valor: tx ? tx.nota : '' }
        ]}
        validar={(raw) => V.validarTransaccion(raw, { hoy: hoy(), estado: estadoActual(), categoriaActual: tx && tx.categoriaId })}
        guardar="Guardar"
        secundario={editando ? null : {
          texto: 'Guardar y agregar otro',
          fn: (datos, api) => {
            commit((est) => { domain.crearTx(est, datos); }, { mensaje: msgGuardado(datos) });
            api.set('monto', ''); api.set('nota', ''); api.reiniciar(); api.foco('monto');
          }
        }}
        eliminar={editando ? { texto: 'Eliminar', fn: ({ cerrar: c }) => eliminarMovimiento(hojas, tx, c) } : null}
        onGuardar={(datos) => {
          commit((est) => { if (editando) domain.actualizarTx(est, tx.id, datos); else domain.crearTx(est, datos); },
            { mensaje: editando ? 'Cambios guardados' : msgGuardado(datos) });
        }}
      />
    )
  });
}

export function abrirEdicion(hojas, tx) {
  if (tx.origen === 'manual' || tx.origen === 'recurrente') { abrirRegistro(hojas, tx); return; }
  const c = cat(tx.categoriaId);
  const destino = tx.origen === 'meta' ? ['planear', 'metas', 'Ir a Metas'] : tx.origen === 'cuota' ? ['deudas', 'deudas', 'Ir a Deudas'] : ['deudas', 'compartidos', 'Ir a Compartidos'];
  hojas.abrir({
    titulo: ORIGEN[tx.origen],
    contenido: ({ cerrar }) => (
      <>
        <div className="detalle">
          <p className="detalle-monto">{money.format(tx.monto)}</p>
          <p>{(c ? c.icono + ' ' + c.nombre : '') + ' · ' + dates.largo(tx.fecha)}</p>
          {tx.nota ? <p className="ayuda">{tx.nota}</p> : null}
          <p className="ayuda">Este movimiento se creó automáticamente, por eso no se edita aquí. Para cambiarlo, hazlo desde su sección o elimínalo.</p>
        </div>
        <div className="acciones">
          <button type="button" className="btn peligro-suave" onClick={() => eliminarMovimiento(hojas, tx, cerrar)}>Eliminar</button>
          <button type="button" className="btn secundario" onClick={() => { cerrar(); irA(destino[0], destino[1]); }}>{destino[2]}</button>
        </div>
      </>
    )
  });
}

export function FilaMov({ t, hojas, i }) {
  const c = cat(t.categoriaId);
  const origen = ORIGEN[t.origen];
  const nombre = c ? c.nombre : '';
  return (
    <Fila i={i} icono={<IconoCat cat={c} />} titulo={t.nota || nombre || 'Movimiento'}
      sub={[t.nota ? nombre : '', origen].filter(Boolean).join(' · ')} derecha={<MontoEl valor={t.monto} tipo={t.tipo} />}
      onClick={() => abrirEdicion(hojas, t)} />
  );
}

export function PieMarca() {
  return (
    <div className="pie-marca">
      <span className="logo-marca" role="img" aria-label="Haidiby Marketing Group" />
      <p>SantiSinPlata · una app de Haidiby Marketing Group</p>
    </div>
  );
}

export function cargarEjemplo(hojas, reemplazar) {
  const seguir = () => reemplazar(domain.datosEjemplo(hoy()), 'Datos de ejemplo cargados. Tus datos anteriores quedaron en el respaldo.');
  if (!estadoActual().transacciones.length) { seguir(); return; }
  hojas.confirmar({ titulo: 'Cargar datos de ejemplo', mensaje: 'Esto reemplaza tus datos actuales por datos ficticios. Se guarda una copia de seguridad que puedes restaurar en Ajustes.', textoOk: 'Reemplazar', peligro: true })
    .then((ok) => { if (ok) seguir(); });
}
