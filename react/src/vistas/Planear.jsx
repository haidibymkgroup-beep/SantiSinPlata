import { useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { money, dates, domain, validators as V } from '../lib.js';
import { useApp, setSub, commit, estadoActual, hoy as hoyFn } from '../estado.js';
import { useHojas } from '../ui/Hojas.jsx';
import { Formulario } from '../ui/Formulario.jsx';
import { Barra, Fila, IconoCat, MontoEl, Seccion, Tabs, Tarjeta, Vacio } from '../ui/Basicos.jsx';
import { Anillo } from '../graficas/Graficas.jsx';
import { contenedor, elemento } from '../ui/movimiento.js';
import { catOpciones, confirmarEliminar } from './comun.jsx';

const ETIQUETA_ESTADO = { ok: 'En orden', atencion: 'Atención', excedido: 'Excedido' };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ---------- Presupuestos ----------
function editarPresupuesto(hojas, p) {
  const editando = !!p;
  hojas.abrir({
    titulo: editando ? 'Editar presupuesto' : 'Nuevo presupuesto',
    contenido: ({ cerrar }) => {
      const est = estadoActual();
      const ops = [{ v: 'total', t: '🧮 Total del mes' }].concat(est.categorias.filter((c) => c.tipo === 'gasto' && !c.archivada).map((c) => ({ v: c.id, t: c.icono + ' ' + c.nombre })));
      const usadas = {};
      est.presupuestos.forEach((x) => { if (!p || x.id !== p.id) usadas[x.categoriaId === null ? 'total' : x.categoriaId] = true; });
      const libre = ops.filter((o) => !usadas[o.v])[0];
      return (
        <Formulario cerrar={cerrar}
          campos={[
            { n: 'categoriaId', t: 'select', et: 'Categoría', opciones: ops, valor: editando ? (p.categoriaId === null ? 'total' : p.categoriaId) : (libre ? libre.v : 'total') },
            { n: 'limiteMensual', t: 'monto', et: 'Límite mensual', valor: editando ? String(p.limiteMensual) : '' },
            { n: 'alertaPct', t: 'numero', et: 'Avisarme al llegar a (%)', ayuda: 'Entre 50 y 100. Te avisamos en Inicio cuando llegues a ese porcentaje del límite.', valor: editando ? String(p.alertaPct) : '80' }
          ]}
          validar={(raw) => V.validarPresupuesto(raw, { estado: estadoActual(), editId: p && p.id })}
          eliminar={editando ? {
            fn: ({ cerrar: c }) => confirmarEliminar(hojas, '¿Eliminar presupuesto?', 'Tus movimientos no cambian; solo se quita el límite.').then((ok) => {
              if (!ok) return;
              commit((s) => { s.presupuestos = s.presupuestos.filter((x) => x.id !== p.id); }, { mensaje: 'Presupuesto eliminado' });
              c();
            })
          } : null}
          onGuardar={(datos) => {
            commit((s) => {
              if (editando) { const x = domain.porId(s.presupuestos, p.id); x.categoriaId = datos.categoriaId; x.limiteMensual = datos.limiteMensual; x.alertaPct = datos.alertaPct; }
              else domain.crearPresupuesto(s, datos);
            }, { mensaje: 'Presupuesto guardado' });
          }} />
      );
    }
  });
}

function Presupuestos({ hojas }) {
  const { estado: est, hoy } = useApp();
  const lista = domain.estadoPresupuestos(est, hoy);
  return (
    <m.div variants={contenedor} initial="oculto" animate="visible" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <m.button variants={elemento} type="button" className="btn primario bloque" whileTap={{ scale: 0.98 }} onClick={() => editarPresupuesto(hojas, null)}>Nuevo presupuesto</m.button>
      {!lista.length && <Vacio icono="🎯" titulo="Sin presupuestos" texto="Ponle un límite mensual a una categoría (o a todo el mes) y te avisamos antes de pasarte." />}
      {lista.map((e) => {
        const p = e.presupuesto;
        const c = p.categoriaId ? domain.cat(est, p.categoriaId) : null;
        return (
          <m.button key={p.id} variants={elemento} type="button" className="tarjeta pres-card" whileTap={{ scale: 0.985 }} onClick={() => editarPresupuesto(hojas, p)}>
            <div className="fila-dos">
              <span className="fila-titulo">{c ? c.icono + ' ' + c.nombre : '🧮 Total del mes'}</span>
              <span className={'estado-tag est-' + e.estado}>{ETIQUETA_ESTADO[e.estado]}</span>
            </div>
            <Barra pct={e.pct} estado={e.estado} etiqueta="Avance del presupuesto" />
            <div className="fila-dos sub">
              <span>{money.format(e.gastado) + ' de ' + money.format(p.limiteMensual)}</span>
              <span>{e.restante >= 0 ? 'Quedan ' + money.format(e.restante) : 'Te pasaste por ' + money.format(-e.restante)}</span>
            </div>
            {e.rapido ? <p className="aviso-mini">Vas más rápido de lo planeado para este punto del mes.</p> : null}
          </m.button>
        );
      })}
    </m.div>
  );
}

// ---------- Metas ----------
function aportar(hojas, id) {
  const meta = domain.porId(estadoActual().metas, id);
  if (!meta) return;
  const s = domain.estadoMeta(meta, hoyFn());
  hojas.abrir({
    titulo: 'Aportar a «' + meta.nombre + '»',
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar} guardar="Aportar"
        campos={[
          { n: 'monto', t: 'monto', et: 'Monto del aporte', valor: s.sugeridoMensual ? String(Math.min(s.sugeridoMensual, s.faltante)) : '', ayuda: s.faltante ? 'Faltan ' + money.format(s.faltante) + ' para la meta.' : null },
          { n: 'fecha', t: 'fecha', et: 'Fecha', valor: hoyFn(), min: '2000-01-01', max: dates.sumarMeses(hoyFn(), 12), atajos: [{ t: 'Hoy', v: () => hoyFn() }] }
        ]}
        aviso="El aporte cuenta como una salida de dinero (categoría Ahorro) en tus movimientos."
        validar={(raw) => V.validarAporte(raw, { hoy: hoyFn(), estado: estadoActual() })}
        onGuardar={(datos) => {
          const cumple = s.ahorrado + datos.monto >= meta.objetivo && s.estado !== 'completada';
          commit((est) => { domain.agregarAporte(est, id, datos); }, { mensaje: cumple ? '🎉 ¡Meta cumplida!' : 'Aporte guardado: ' + money.format(datos.monto) });
        }} />
    )
  });
}

function editarMeta(hojas, meta) {
  const editando = !!meta;
  hojas.abrir({
    titulo: editando ? 'Editar meta' : 'Nueva meta de ahorro',
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar}
        campos={[
          { n: 'nombre', t: 'texto', et: 'Nombre', max: 40, placeholder: 'Ej. Viaje a San Andrés', valor: editando ? meta.nombre : '' },
          { n: 'objetivo', t: 'monto', et: 'Objetivo', valor: editando ? String(meta.objetivo) : '' },
          { n: 'fechaLimite', t: 'fecha', et: 'Fecha límite (opcional)', valor: editando && meta.fechaLimite ? meta.fechaLimite : '', min: dates.sumarDias(hoyFn(), 1), max: dates.sumarMeses(hoyFn(), 12),
            atajos: [{ t: 'Sin fecha', v: '' }, { t: 'En 6 meses', v: () => dates.sumarMeses(hoyFn(), 6) }, { t: 'En 1 año', v: () => dates.sumarMeses(hoyFn(), 12) }] }
        ]}
        validar={(raw) => V.validarMeta(raw, { hoy: hoyFn(), estado: estadoActual() })}
        onGuardar={(datos) => {
          commit((est) => {
            if (editando) { const x = domain.porId(est.metas, meta.id); x.nombre = datos.nombre; x.objetivo = datos.objetivo; x.fechaLimite = datos.fechaLimite; domain.sincronizarMetas(est); }
            else domain.crearMeta(est, datos);
          }, { mensaje: 'Meta guardada' });
        }} />
    )
  });
}

function DetalleMeta({ id, cerrar, hojas }) {
  const { estado, hoy } = useApp();
  const meta = domain.porId(estado.metas, id);
  useEffect(() => { if (!meta) cerrar(); }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!meta) return null;
  const s = domain.estadoMeta(meta, hoy);
  return (
    <>
      <div className="detalle">
        <p className="detalle-titulo">{meta.nombre}</p>
        <p className="detalle-monto">{money.format(s.ahorrado)}</p>
        <p className="ayuda">{'de ' + money.format(meta.objetivo) + (meta.fechaLimite ? ' · hasta ' + dates.largo(meta.fechaLimite) : '')}</p>
      </div>
      <Seccion titulo="Aportes" />
      {!meta.aportes.length ? <p className="ayuda">Aún no hay aportes.</p> : (
        <div className="lista tarjeta">
          {meta.aportes.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).map((a) => (
            <Fila key={a.id} icono="🐖" titulo={money.format(a.monto)} sub={dates.largo(a.fecha)}
              derecha={<button type="button" className="btn texto peligro-txt" onClick={() => {
                confirmarEliminar(hojas, '¿Quitar aporte?', 'Se quitan ' + money.format(a.monto) + ' de la meta y también el gasto de Ahorro asociado.').then((ok) => {
                  if (ok) commit((est) => { domain.quitarAporte(est, id, a.id); }, { mensaje: 'Aporte eliminado' });
                });
              }}>Quitar</button>} />
          ))}
        </div>
      )}
      <div className="acciones">
        <button type="button" className="btn peligro-suave" onClick={() => {
          confirmarEliminar(hojas, '¿Eliminar meta?', 'Los aportes ya registrados se conservan como gastos de Ahorro en tus movimientos.').then((ok) => {
            if (!ok) return;
            commit((est) => { est.metas = est.metas.filter((x) => x.id !== id); }, { mensaje: 'Meta eliminada' });
            cerrar();
          });
        }}>Eliminar meta</button>
        <button type="button" className="btn secundario" onClick={() => { editarMeta(hojas, meta); cerrar(); }}>Editar</button>
      </div>
    </>
  );
}

function Metas({ hojas }) {
  const { estado: est, hoy } = useApp();
  const metas = est.metas.filter((x) => !x.archivada);
  return (
    <m.div variants={contenedor} initial="oculto" animate="visible" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <m.button variants={elemento} type="button" className="btn primario bloque" whileTap={{ scale: 0.98 }} onClick={() => editarMeta(hojas, null)}>Nueva meta</m.button>
      {!metas.length && <Vacio icono="🐖" titulo="Sin metas todavía" texto="Define algo para lo que quieras ahorrar y registra tus aportes." />}
      {metas.map((meta) => {
        const s = domain.estadoMeta(meta, hoy);
        const lineas = [];
        if (s.estado === 'completada') lineas.push('¡Meta cumplida!');
        else {
          lineas.push('Faltan ' + money.format(s.faltante));
          if (s.estado === 'atrasada') lineas.push('Pasó la fecha límite (' + dates.corto(meta.fechaLimite) + ')');
          else if (meta.fechaLimite) lineas.push('Hasta ' + dates.largo(meta.fechaLimite));
          if (s.sugeridoMensual) lineas.push('Aporte sugerido: ' + money.format(s.sugeridoMensual) + ' al mes');
        }
        return (
          <Tarjeta key={meta.id} clase="meta">
            <div className="meta-top">
              <Anillo pct={s.pct} clase={s.estado === 'completada' ? 'dorado' : (s.estado === 'atrasada' ? 'alerta' : 'primario')} texto={meta.nombre} />
              <div className="meta-datos">
                <p className="fila-titulo">{meta.nombre}</p>
                <p className="sub">{money.format(s.ahorrado) + ' de ' + money.format(meta.objetivo)}</p>
                {lineas.map((l, i) => <p key={i} className={'ayuda' + (i === 0 && s.estado === 'completada' ? ' ok' : '')}>{l}</p>)}
              </div>
            </div>
            <div className="acciones">
              <button type="button" className="btn secundario" onClick={() => hojas.abrir({ titulo: 'Meta de ahorro', contenido: ({ cerrar }) => <DetalleMeta id={meta.id} cerrar={cerrar} hojas={hojas} /> })}>Detalle</button>
              {s.estado === 'completada' ? null : <button type="button" className="btn primario" onClick={() => aportar(hojas, meta.id)}>Aportar</button>}
            </div>
          </Tarjeta>
        );
      })}
    </m.div>
  );
}

// ---------- Recurrentes ----------
function editarRecurrente(hojas, r) {
  const editando = !!r;
  const tipoIni = editando ? r.tipo : 'gasto';
  const catIni = editando ? r.categoriaId : (catOpciones(tipoIni)[0] || {}).v;
  hojas.abrir({
    titulo: editando ? 'Editar recurrente' : 'Nuevo gasto o ingreso recurrente',
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar}
        campos={[
          { n: 'tipo', t: 'segmentado', opciones: [{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }], valor: tipoIni,
            onchange: (v, { set }) => { const o = catOpciones(v); set('categoriaId', o[0] && o[0].v); } },
          { n: 'nota', t: 'texto', et: 'Nombre', max: 120, placeholder: 'Ej. Arriendo, Netflix, Salario', valor: editando ? r.nota : '' },
          { n: 'monto', t: 'monto', et: 'Monto', valor: editando ? String(r.monto) : '' },
          { n: 'categoriaId', t: 'chips', et: 'Categoría', opciones: (v) => catOpciones(v.tipo, editando && r.categoriaId), valor: catIni },
          { n: 'frecuencia', t: 'select', et: 'Se repite', valor: editando ? r.frecuencia : 'mensual',
            opciones: [{ v: 'mensual', t: 'Cada mes' }, { v: 'quincenal', t: 'Cada quincena (15 y fin de mes)' }, { v: 'semanal', t: 'Cada semana' }, { v: 'anual', t: 'Cada año' }] },
          { n: 'diaDelMes', t: 'numero', et: 'Día del mes (1–31)', ayuda: 'Si el mes tiene menos días, se usa el último.', valor: String(editando && r.diaDelMes ? r.diaDelMes : dates.partes(hoyFn()).d), visible: (v) => v.frecuencia === 'mensual' },
          { n: 'diaSemana', t: 'select', et: 'Día de la semana', valor: String(editando && r.diaSemana !== null ? r.diaSemana : 1), opciones: DIAS.map((d, i) => ({ v: String(i), t: d })), visible: (v) => v.frecuencia === 'semanal' },
          { n: 'inicio', t: 'fecha', et: 'Desde', valor: editando ? r.inicio : hoyFn(), min: '2000-01-01', max: dates.sumarMeses(hoyFn(), 12), ayuda: 'Se registran los movimientos desde esta fecha; si es del pasado, se crean los atrasados.' },
          { n: 'fin', t: 'fecha', et: 'Hasta (opcional)', valor: editando && r.fin ? r.fin : '', min: '2000-01-01', atajos: [{ t: 'Sin fin', v: '' }] }
        ].concat(editando ? [{ n: 'activa', t: 'check', et: 'Regla activa (desmárcala para pausarla)', valor: r.activa }] : [])}
        validar={(raw) => V.validarRecurrente(raw, { hoy: hoyFn(), estado: estadoActual() })}
        eliminar={editando ? {
          fn: ({ cerrar: c }) => confirmarEliminar(hojas, '¿Eliminar regla?', 'Los movimientos que ya se crearon se conservan.').then((ok) => {
            if (!ok) return;
            commit((s) => { s.recurrentes = s.recurrentes.filter((x) => x.id !== r.id); }, { mensaje: 'Regla eliminada' });
            c();
          })
        } : null}
        onGuardar={(datos, api) => {
          const activa = editando ? api.valores.activa : true;
          commit((s) => {
            if (editando) {
              const x = domain.porId(s.recurrentes, r.id);
              ['tipo', 'monto', 'categoriaId', 'nota', 'frecuencia', 'diaDelMes', 'diaSemana', 'inicio', 'fin'].forEach((k) => { x[k] = datos[k]; });
              if (activa !== x.activa) domain.alternarRecurrente(s, x.id, hoyFn());
            } else domain.crearRecurrente(s, datos);
            domain.materializarRecurrentes(s, hoyFn());
          }, { mensaje: 'Recurrente guardado' });
        }} />
    )
  });
}

function Recurrentes({ hojas }) {
  const { estado: est, hoy } = useApp();
  return (
    <m.div variants={contenedor} initial="oculto" animate="visible" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <m.button variants={elemento} type="button" className="btn primario bloque" whileTap={{ scale: 0.98 }} onClick={() => editarRecurrente(hojas, null)}>Nuevo recurrente</m.button>
      {!est.recurrentes.length && <Vacio icono="🔁" titulo="Sin recurrentes" texto="Arriendo, suscripciones, salario… se registran solos en su fecha." />}
      {est.recurrentes.length > 0 && (
        <Tarjeta clase="lista">
          {est.recurrentes.map((r) => {
            const c = domain.cat(est, r.categoriaId);
            const prox = r.activa ? domain.proximaOcurrencia(r, hoy) : null;
            const estado = !r.activa ? 'Pausada' : (prox ? 'Próxima: ' + dates.etiquetaDia(prox, hoy).toLowerCase() : 'Sin próximas fechas');
            return <Fila key={r.id} icono={<IconoCat cat={c} />} titulo={r.nota} sub={domain.textoFrecuencia(r) + ' · ' + estado}
              derecha={<MontoEl valor={r.monto} tipo={r.tipo} />} onClick={() => editarRecurrente(hojas, r)} clase={r.activa ? '' : 'tenue'} />;
          })}
        </Tarjeta>
      )}
    </m.div>
  );
}

export default function Planear() {
  const { sub } = useApp();
  const hojas = useHojas();
  const actual = sub.planear;
  return (
    <m.div className="pantalla" variants={contenedor} initial="oculto" animate="visible">
      <Tabs id="planear" opciones={[{ v: 'presupuestos', t: 'Presupuestos' }, { v: 'metas', t: 'Metas' }, { v: 'recurrentes', t: 'Recurrentes' }]}
        actual={actual} onSel={(v) => setSub('planear', v)} etiqueta="Secciones de Planear" />
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={actual} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
          {actual === 'metas' ? <Metas hojas={hojas} /> : actual === 'recurrentes' ? <Recurrentes hojas={hojas} /> : <Presupuestos hojas={hojas} />}
        </m.div>
      </AnimatePresence>
    </m.div>
  );
}
