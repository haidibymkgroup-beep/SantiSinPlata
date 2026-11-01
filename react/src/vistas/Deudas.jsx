import { useEffect, useState } from 'react';
import { m, AnimatePresence, LayoutGroup } from 'motion/react';
import { money, dates, domain, validators as V } from '../lib.js';
import { useApp, setSub, commit, toast, estadoActual, hoy as hoyFn } from '../estado.js';
import { useHojas } from '../ui/Hojas.jsx';
import { Formulario } from '../ui/Formulario.jsx';
import { Barra, Fila, Numero, Seccion, Tabs, Tarjeta, Vacio } from '../ui/Basicos.jsx';
import { contenedor, elemento } from '../ui/movimiento.js';
import { IconoCat } from '../ui/Basicos.jsx';
import { confirmarEliminar } from './comun.jsx';

// ---------- Deudas ----------
function registrarPago(hojas, id, tipoInicial) {
  const d0 = domain.porId(estadoActual().deudas, id);
  if (!d0) return;
  const conCuotas = d0.tipo === 'cuotas';
  const datosDe = (tipo) => {
    const d = domain.porId(estadoActual().deudas, id);
    return { d, e: domain.estadoDeuda(d, hoyFn()), extra: tipo === 'extra' || d.tipo === 'libre' };
  };
  const resumenTexto = (tipo) => {
    const x = datosDe(tipo), e = x.e;
    let t = 'Saldo pendiente ' + money.format(e.saldo);
    if (conCuotas && !x.extra) t += ' · Interés de este periodo ' + money.format(e.interesPeriodo) + ' · Máximo ' + money.format(e.maxPagoCuota);
    else t += ' · Máximo ' + money.format(e.maxPagoExtra);
    return t;
  };
  const sugerido = (tipo) => { const x = datosDe(tipo); return !x.extra && x.e.cuotaSugerida ? String(x.e.cuotaSugerida) : ''; };
  const ini = conCuotas ? (tipoInicial || 'cuota') : 'cuota';
  hojas.abrir({
    titulo: 'Pago · ' + d0.nombre,
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar} guardar="Registrar pago"
        campos={[
          ...(conCuotas ? [{ n: 'tipo', t: 'segmentado', et: 'Tipo de pago', opciones: [{ v: 'cuota', t: 'Cuota' }, { v: 'extra', t: 'Abono extra' }], valor: ini,
            onchange: (v, { set }) => { set('monto', sugerido(v)); } }] : []),
          { n: 'monto', t: 'monto', et: 'Monto del pago', valor: sugerido(ini) },
          { n: 'fecha', t: 'fecha', et: 'Fecha del pago', valor: hoyFn(), min: '2000-01-01', max: dates.sumarMeses(hoyFn(), 12), atajos: [{ t: 'Hoy', v: () => hoyFn() }] },
          { n: 'resumen', t: 'info', texto: (v) => resumenTexto(conCuotas ? v.tipo : 'cuota') }
        ]}
        aviso="El pago se registra como gasto en la categoría Deudas. Un abono extra baja el capital y acorta el plan."
        validar={(raw) => {
          const tipo = conCuotas ? raw.tipo : 'cuota', x = datosDe(tipo);
          return V.validarPago({ monto: raw.monto, fecha: raw.fecha, tipo }, {
            hoy: hoyFn(), estado: estadoActual(),
            maxPago: x.extra ? x.e.maxPagoExtra : x.e.maxPagoCuota,
            minPago: !x.extra && conCuotas ? x.e.interesPeriodo : 0
          });
        }}
        onGuardar={(datos) => {
          const e = datosDe(datos.tipo).e;
          const salda = datos.monto >= (datos.tipo === 'extra' || !conCuotas ? e.maxPagoExtra : e.maxPagoCuota);
          commit((est) => { domain.registrarPago(est, id, datos); }, { mensaje: salda ? '🎉 ¡Deuda saldada!' : 'Pago registrado: ' + money.format(datos.monto) });
        }} />
    )
  });
}

function nuevaDeuda(hojas) {
  hojas.abrir({
    titulo: 'Nueva deuda',
    contenido: ({ cerrar }) => {
      const cuotas = (v) => v.tipo === 'cuotas';
      return (
        <Formulario cerrar={cerrar} guardar="Crear deuda"
          campos={[
            { n: 'nombre', t: 'texto', et: 'Nombre', max: 40, placeholder: 'Ej. Crédito moto, Tarjeta' },
            { n: 'acreedor', t: 'texto', et: 'A quién le debes (opcional)', max: 40 },
            { n: 'tipo', t: 'segmentado', et: 'Tipo', opciones: [{ v: 'cuotas', t: 'Con cuotas' }, { v: 'libre', t: 'Sin plan fijo' }], valor: 'cuotas' },
            { n: 'capitalInicial', t: 'monto', et: 'Valor de la deuda (capital)' },
            { n: 'tasaMensualPct', t: 'decimal', et: 'Interés mensual (%)', ayuda: '0 si no cobra interés. Ej. 1,8', valor: '0', visible: cuotas },
            { n: 'numCuotas', t: 'numero', et: 'Número de cuotas', placeholder: 'Ej. 24', visible: cuotas },
            { n: 'valorCuota', t: 'monto', et: 'Valor de la cuota (opcional)', ayuda: 'Déjalo vacío y la calculamos con el sistema de cuota fija.', visible: cuotas },
            { n: 'primeraCuota', t: 'fecha', et: 'Fecha de la primera cuota', valor: dates.sumarMeses(hoyFn(), 1), min: '2000-01-01', max: dates.sumarMeses(hoyFn(), 12), ayuda: 'El día de esta fecha será tu día de pago cada mes.', visible: cuotas },
            { n: 'estimado', t: 'info', visible: cuotas, texto: (v, res) => {
              if (v.tipo !== 'cuotas' || !res.ok || !res.datos.capitalInicial) return '';
              const dd = res.datos;
              const cuota = dd.valorCuota > 0 ? dd.valorCuota : domain.cuotaFrancesa(dd.capitalInicial, dd.tasaMensualPct, dd.numCuotas);
              const tabla = domain.tablaAmortizacion(dd.capitalInicial, dd.tasaMensualPct, dd.numCuotas);
              const interesTotal = dd.valorCuota > 0 ? null : money.suma(tabla.map((f) => f.interes));
              return 'Cuota estimada: ' + money.format(cuota) + (interesTotal !== null ? ' · Intereses totales: ' + money.format(interesTotal) : '');
            } }
          ]}
          validar={(raw) => V.validarDeuda(raw, { hoy: hoyFn(), estado: estadoActual() })}
          onGuardar={(datos) => { commit((est) => { domain.crearDeuda(est, datos); }, { mensaje: 'Deuda creada' }); }} />
      );
    }
  });
}

// En la tabla se omite el "$" de cada cifra para que quepan las 6 columnas en el celular
const num = (n) => money.format(n).replace('$ ', '');

function TablaPlan({ filas }) {
  return (
    <div className="tabla-caja" tabIndex={0} role="region" aria-label="Plan de pagos">
      <table className="tabla">
        <thead><tr>{['Nº', 'Fecha', 'Cuota', 'Interés', 'Capital', 'Saldo'].map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.n}>
              <td>{f.n}</td><td>{dates.corto(f.fecha) + ' ' + String(dates.partes(f.fecha).y).slice(2)}</td>
              <td>{num(f.cuota)}</td><td>{num(f.interes)}</td><td>{num(f.capital)}</td><td>{num(f.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetalleDeuda({ id, cerrar, hojas }) {
  const { estado, hoy } = useApp();
  const [verTodo, setVerTodo] = useState(false);
  const d = domain.porId(estado.deudas, id);
  useEffect(() => { if (!d) cerrar(); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const e = domain.estadoDeuda(d, hoy);
  const cuotas = d.tipo === 'cuotas';
  return (
    <>
      <div className="detalle">
        <p className="detalle-titulo">{d.nombre + (d.acreedor ? ' · ' + d.acreedor : '')}</p>
        <Numero como="p" className="detalle-monto" valor={e.saldo} />
        <p className="ayuda">{'saldo pendiente de ' + money.format(d.capitalInicial) + (cuotas && d.tasaMensualPct ? ' · ' + String(d.tasaMensualPct).replace('.', ',') + ' % mensual' : '')}</p>
        <Barra pct={e.pctPagado} estado={e.vencida ? 'excedido' : 'ok'} etiqueta="Avance de pago" />
        {e.saldada ? <p className="ayuda ok">¡Deuda saldada!</p>
          : (cuotas && e.proxima ? <p className={'ayuda' + (e.vencida ? ' vencida' : '')}>{'Cuota ' + e.proxima.n + ' de ' + e.cuotasTotales + ' · ' + (e.vencida ? 'venció el ' : 'vence el ') + dates.largo(e.proxima.fecha) + ' · ' + money.format(e.proxima.cuota)}</p> : null)}
      </div>
      {!e.saldada && (
        <div className="acciones">
          {cuotas && <button type="button" className="btn secundario" onClick={() => registrarPago(hojas, id, 'extra')}>Abono extra</button>}
          <button type="button" className="btn primario" onClick={() => registrarPago(hojas, id, 'cuota')}>{cuotas ? 'Registrar cuota' : 'Registrar pago'}</button>
        </div>
      )}
      {cuotas && e.plan.length > 0 && (
        <>
          <Seccion titulo="Plan de pagos (en pesos)" accion={e.plan.length > 12 ? { texto: verTodo ? 'Ver menos' : 'Ver todo (' + e.plan.length + ')', fn: () => setVerTodo(!verTodo) } : null} />
          <TablaPlan filas={verTodo ? e.plan : e.plan.slice(0, 12)} />
          <p className="ayuda">La última cuota se ajusta unos pesos para cerrar el saldo exactamente en cero.</p>
        </>
      )}
      <Seccion titulo="Pagos registrados" />
      {!e.historial.length ? <p className="ayuda">Aún no hay pagos.</p> : (
        <div className="lista tarjeta">
          {e.historial.slice().reverse().map((f) => {
            const p = f.pago;
            return (
              <Fila key={p.id} icono={p.tipo === 'extra' ? '⚡' : '✅'} titulo={money.format(p.monto) + (p.tipo === 'extra' ? ' · abono extra' : '')}
                sub={dates.largo(p.fecha) + (f.interes ? ' · interés ' + money.format(f.interes) : '') + ' · saldo ' + money.format(f.saldo)}
                derecha={<button type="button" className="btn texto peligro-txt" onClick={() => {
                  confirmarEliminar(hojas, '¿Quitar pago?', 'Se quita este pago de ' + money.format(p.monto) + ' y también el gasto asociado.').then((ok) => {
                    if (ok) commit((est) => { domain.eliminarPago(est, id, p.id); }, { mensaje: 'Pago eliminado' });
                  });
                }}>Quitar</button>} />
            );
          })}
        </div>
      )}
      <div className="acciones">
        <button type="button" className="btn peligro-suave" onClick={() => {
          confirmarEliminar(hojas, '¿Eliminar deuda?', 'Se borra la deuda. Los pagos ya registrados se conservan como gastos en tus movimientos.').then((ok) => {
            if (!ok) return;
            commit((est) => { est.deudas = est.deudas.filter((x) => x.id !== id); }, { mensaje: 'Deuda eliminada' });
            cerrar();
          });
        }}>Eliminar deuda</button>
      </div>
    </>
  );
}

const abrirDetalle = (hojas, id) => hojas.abrir({ titulo: 'Detalle de la deuda', contenido: ({ cerrar }) => <DetalleDeuda id={id} cerrar={cerrar} hojas={hojas} /> });

function VistaDeudas({ hojas }) {
  const { estado: est, hoy } = useApp();
  const rs = domain.resumenDeudas(est, hoy);
  const deudas = est.deudas.filter((d) => !d.archivada);
  return (
    <m.div variants={contenedor} initial="oculto" animate="visible" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <Tarjeta clase="principal">
        <p className="principal-et">Deuda total</p>
        <Numero como="p" className="monto-grande" valor={rs.deudaTotal} />
        <div className="dos-col">
          <div><span className="mini-et">Pagado este periodo</span><Numero como="strong" className="mini-valor" valor={rs.pagosDelMes} /></div>
          <div><span className="mini-et">Próximo pago</span><strong className="mini-valor">{rs.proxima ? dates.corto(rs.proxima.fecha) + ' · ' + money.format(rs.proxima.cuota) : '—'}</strong></div>
        </div>
      </Tarjeta>
      <m.button variants={elemento} type="button" className="btn primario bloque" whileTap={{ scale: 0.98 }} onClick={() => nuevaDeuda(hojas)}>Nueva deuda</m.button>
      {!deudas.length && <Vacio icono="💳" titulo="Sin deudas registradas" texto="Registra créditos, tarjetas o compras a cuotas para saber cuánto debes y cuándo pagar." />}
      {deudas.map((d) => {
        const e = domain.estadoDeuda(d, hoy);
        const cuotas = d.tipo === 'cuotas';
        const linea = e.saldada ? 'Saldada' : cuotas
          ? 'Cuota ' + e.proxima.n + ' de ' + e.cuotasTotales + ' · ' + (e.vencida ? 'venció ' : 'próxima ') + dates.corto(e.proxima.fecha) + ' · ' + money.format(e.proxima.cuota)
          : 'Pagado ' + money.format(e.pagado) + ' de ' + money.format(d.capitalInicial);
        return (
          <Tarjeta key={d.id} clase="deuda-card">
            <button type="button" className="tarjeta-click" aria-label={'Ver detalle de ' + d.nombre} onClick={() => abrirDetalle(hojas, d.id)}>
              <div className="fila-dos">
                <span className="fila-titulo">{d.nombre}</span>
                {e.saldada ? <span className="estado-tag est-ok">Saldada</span> : (e.vencida ? <span className="estado-tag est-excedido">Vencida</span> : null)}
              </div>
              {d.acreedor ? <p className="sub">{d.acreedor}</p> : null}
              <Numero como="p" className="monto-medio" valor={e.saldo} />
              <Barra pct={e.pctPagado} estado={e.vencida ? 'excedido' : 'ok'} etiqueta={'Avance de pago de ' + d.nombre} />
              <p className={'sub' + (e.vencida ? ' vencida' : '')}>{linea}</p>
            </button>
            {!e.saldada && (
              <div className="acciones">
                <button type="button" className="btn primario" onClick={() => registrarPago(hojas, d.id, 'cuota')}>{cuotas ? 'Registrar cuota' : 'Registrar pago'}</button>
              </div>
            )}
          </Tarjeta>
        );
      })}
    </m.div>
  );
}

// ---------- Compartidos ----------
const opsPersonas = () => [{ v: 'yo', t: 'Yo' }].concat(estadoActual().personas.map((p) => ({ v: p.id, t: p.nombre })));

function agregarPersona(hojas, alCrear) {
  hojas.abrir({
    titulo: 'Agregar persona',
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar}
        campos={[{ n: 'nombre', t: 'texto', et: 'Nombre', max: 40, placeholder: 'Ej. Ana' }]}
        validar={(raw) => V.validarPersona(raw, { estado: estadoActual() })}
        onGuardar={(datos) => {
          let id = null;
          commit((est) => { id = domain.crearPersona(est, datos).id; }, { mensaje: datos.nombre + ' agregado/a', deshacer: false });
          if (alCrear && id) alCrear(id);
        }} />
    )
  });
}

// Calcula la parte de cada participante según el modo; devuelve { partes, err }
function calcularPartes(raw) {
  const p = raw.participantes, total = money.parse(raw.total), ids = p.sel;
  let partes = ids.map(() => null), err = null;
  if (total && ids.length) {
    if (p.modo === 'igual') partes = money.repartir(total, ids.length);
    else if (p.modo === 'exacto') {
      partes = ids.map((id) => { const v = p.valores[id]; return v === undefined || String(v).trim() === '' ? 0 : money.parse(v); });
    } else {
      const pc = ids.map((id) => {
        const s = String(p.valores[id] === undefined ? '' : p.valores[id]).replace(',', '.').trim();
        const n = s === '' ? 0 : Number(s);
        return isFinite(n) && n >= 0 && n <= 100 ? n : NaN;
      });
      const suma = pc.reduce((a, b) => a + b, 0);
      if (pc.some(isNaN)) err = 'Revisa los porcentajes (números entre 0 y 100).';
      else if (Math.abs(suma - 100) > 1e-9) err = 'Los porcentajes deben sumar 100 % (ahora suman ' + String(Math.round(suma * 100) / 100).replace('.', ',') + ' %).';
      else partes = money.repartirPorcentajes(total, pc);
    }
  }
  return { partes, err };
}

function Participantes({ valor, set, valores, id, hojas }) {
  const { estado } = useApp();
  const personas = [{ id: 'yo', nombre: 'Yo' }].concat(estado.personas);
  const c = calcularPartes(valores);
  const total = money.parse(valores.total);
  const enOrden = (sel) => personas.map((p) => p.id).filter((x) => sel.indexOf(x) >= 0);
  const alternar = (pid, on) => set({ ...valor, sel: enOrden(on ? valor.sel.concat(pid) : valor.sel.filter((x) => x !== pid)) });
  const escribir = (pid, v) => set({ ...valor, valores: { ...valor.valores, [pid]: v } });

  let ayuda;
  if (valor.modo === 'exacto' && total) {
    const s = money.suma(c.partes.map((x) => x || 0));
    ayuda = 'Suman ' + money.format(s) + ' de ' + money.format(total) + (s === total ? ' ✓' : '');
  } else if (valor.modo === 'porcentaje') {
    const sp = valor.sel.reduce((a, pid) => { const n = Number(String(valor.valores[pid] || '0').replace(',', '.')); return a + (isFinite(n) ? n : 0); }, 0);
    ayuda = 'Suman ' + String(Math.round(sp * 100) / 100).replace('.', ',') + ' % de 100 %';
  } else ayuda = valor.sel.length < 2 ? 'Elige al menos a otra persona o agrégala.' : 'Se divide en partes iguales.';

  return (
    <div className="participantes">
      <LayoutGroup id={id + '-modo'}>
        <div className="segmentado" role="radiogroup" aria-label="Cómo dividir">
          {[['igual', 'Igual'], ['exacto', 'Montos'], ['porcentaje', 'Porcentajes']].map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={valor.modo === v} className={'seg' + (valor.modo === v ? ' activo' : '')} onClick={() => set({ ...valor, modo: v })}>
              {valor.modo === v && <m.span layoutId="modo" className="pastilla" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <span className="pastilla-txt">{t}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <div className="part-lista">
        {personas.map((p) => {
          const on = valor.sel.indexOf(p.id) >= 0;
          const idx = valor.sel.indexOf(p.id);
          const cid = id + '-p-' + p.id;
          return (
            <div className="part-fila" key={p.id}>
              <label className="check" htmlFor={cid}>
                <input type="checkbox" id={cid} checked={on} onChange={(e) => alternar(p.id, e.target.checked)} />
                <span>{p.nombre}</span>
              </label>
              {on && valor.modo !== 'igual' && (
                <input type="text" className="entrada mini" autoComplete="off" inputMode={valor.modo === 'porcentaje' ? 'decimal' : 'numeric'}
                  placeholder={valor.modo === 'porcentaje' ? '%' : '$'} aria-label={'Parte de ' + p.nombre + (valor.modo === 'porcentaje' ? ' en %' : ' en pesos')}
                  value={valor.valores[p.id] || ''} onChange={(e) => escribir(p.id, e.target.value)} />
              )}
              {on && <span className="part-monto">{c.partes[idx] === null || c.partes[idx] === undefined ? '—' : money.format(c.partes[idx])}</span>}
            </div>
          );
        })}
      </div>
      <p className="ayuda" aria-live="polite">{ayuda}</p>
      <button type="button" className="btn texto" onClick={() => agregarPersona(hojas, (nuevo) => set({ ...valor, sel: enOrden(valor.sel.concat(nuevo)) }))}>＋ Agregar persona</button>
    </div>
  );
}

function nuevoCompartido(hojas) {
  const catsGasto = () => estadoActual().categorias.filter((c) => c.tipo === 'gasto' && !c.archivada && !c.sistema).map((c) => ({ v: c.id, t: c.icono + ' ' + c.nombre }));
  hojas.abrir({
    titulo: 'Gasto compartido', clase: 'registro',
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar} guardar="Guardar"
        campos={[
          { n: 'descripcion', t: 'texto', et: 'Descripción', max: 120, placeholder: 'Ej. Cena de cumpleaños' },
          { n: 'total', t: 'monto', et: 'Total de la cuenta' },
          { n: 'fecha', t: 'fecha', et: 'Fecha', valor: hoyFn(), min: '2000-01-01', max: dates.sumarMeses(hoyFn(), 12), atajos: [{ t: 'Hoy', v: () => hoyFn() }, { t: 'Ayer', v: () => dates.sumarDias(hoyFn(), -1) }] },
          { n: 'categoriaId', t: 'select', et: 'Categoría', opciones: catsGasto, valor: (catsGasto()[0] || {}).v },
          { n: 'pagadoPor', t: 'select', et: '¿Quién pagó?', opciones: opsPersonas, valor: 'yo' },
          { n: 'participantes', t: 'custom', et: 'Entre quiénes se divide', claves: ['participantes', 'partes'], valor: { sel: ['yo'], modo: 'igual', valores: {} },
            render: (p) => <Participantes {...p} hojas={hojas} /> }
        ]}
        aviso="Solo tu parte cuenta como gasto tuyo. Lo demás queda como saldo con cada persona."
        validar={(raw) => {
          const c = calcularPartes(raw);
          const res = V.validarCompartido({
            descripcion: raw.descripcion, total: raw.total, fecha: raw.fecha, categoriaId: raw.categoriaId, pagadoPor: raw.pagadoPor,
            participantes: raw.participantes.sel.map((pid, i) => ({ personaId: pid, parte: c.partes[i] }))
          }, { hoy: hoyFn(), estado: estadoActual() });
          if (c.err) { res.errores.partes = c.err; res.ok = false; res.datos = null; }
          return res;
        }}
        onGuardar={(datos) => { commit((est) => { domain.crearCompartido(est, datos); }, { mensaje: 'Gasto compartido guardado' }); }} />
    )
  });
}

function liquidar(hojas, pid) {
  const est = estadoActual(), p = domain.porId(est.personas, pid);
  if (!p) return;
  const saldo = domain.saldoPersona(est, pid);
  if (saldo === 0) { toast('No hay saldo pendiente con ' + p.nombre + '.'); return; }
  hojas.abrir({
    titulo: 'Liquidar con ' + p.nombre,
    contenido: ({ cerrar }) => (
      <Formulario cerrar={cerrar} guardar="Liquidar"
        campos={[
          { n: 'monto', t: 'monto', et: saldo > 0 ? 'Cuánto te pagó' : 'Cuánto le pagaste', valor: String(Math.abs(saldo)) },
          { n: 'fecha', t: 'fecha', et: 'Fecha', valor: hoyFn(), min: '2000-01-01', max: dates.sumarMeses(hoyFn(), 12), atajos: [{ t: 'Hoy', v: () => hoyFn() }] }
        ]}
        aviso={(saldo > 0 ? p.nombre + ' te debe ' : 'Le debes a ' + p.nombre + ' ') + money.format(Math.abs(saldo)) + '. Liquidar solo actualiza el saldo; no crea ingresos ni gastos nuevos.'}
        validar={(raw) => V.validarLiquidacion(raw, { hoy: hoyFn(), estado: estadoActual(), saldoAbs: Math.abs(domain.saldoPersona(estadoActual(), pid)) })}
        onGuardar={(datos) => { commit((s) => { domain.liquidar(s, pid, datos); }, { mensaje: 'Saldo actualizado' }); }} />
    )
  });
}

function DetalleCompartido({ id, cerrar, hojas }) {
  const { estado } = useApp();
  const co = domain.porId(estado.compartidos, id);
  useEffect(() => { if (!co) cerrar(); }, [co]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!co) return null;
  return (
    <>
      <div className="detalle">
        <p className="detalle-monto">{money.format(co.total)}</p>
        <p className="ayuda">{dates.largo(co.fecha) + ' · Pagó ' + domain.nombrePersona(estado, co.pagadoPor)}</p>
      </div>
      <div className="lista tarjeta">
        {co.participantes.map((p) => <Fila key={p.personaId} icono="👤" titulo={domain.nombrePersona(estado, p.personaId)} derecha={<span className="monto">{money.format(p.parte)}</span>} />)}
      </div>
      <div className="acciones">
        <button type="button" className="btn peligro-suave" onClick={() => {
          confirmarEliminar(hojas, '¿Eliminar gasto compartido?', 'Se quita también tu parte de tus movimientos. Las liquidaciones ya hechas se conservan.').then((ok) => {
            if (!ok) return;
            commit((s) => { domain.eliminarCompartido(s, id); }, { mensaje: 'Gasto compartido eliminado' });
            cerrar();
          });
        }}>Eliminar</button>
      </div>
    </>
  );
}

function VistaCompartidos({ hojas }) {
  const { estado: est } = useApp();
  const saldos = domain.saldos(est);
  const meDeben = money.suma(saldos.filter((s) => s.saldo > 0).map((s) => s.saldo));
  const debo = money.suma(saldos.filter((s) => s.saldo < 0).map((s) => -s.saldo));
  const hist = est.compartidos.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  return (
    <m.div variants={contenedor} initial="oculto" animate="visible" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <Tarjeta clase="ritmo">
        <div><span className="mini-et">Te deben</span><Numero como="strong" className="mini-valor ingreso" valor={meDeben} /></div>
        <div><span className="mini-et">Debes</span><Numero como="strong" className="mini-valor gasto" valor={debo} /></div>
      </Tarjeta>
      <m.div variants={elemento} className="acciones">
        <button type="button" className="btn secundario" onClick={() => agregarPersona(hojas)}>＋ Persona</button>
        <button type="button" className="btn primario" onClick={() => nuevoCompartido(hojas)}>Gasto compartido</button>
      </m.div>

      <Seccion titulo="Personas" />
      {!saldos.length ? <p className="ayuda">Agrega a las personas con quienes compartes gastos para llevar las cuentas.</p> : (
        <Tarjeta clase="lista">
          {saldos.map((s) => {
            const texto = s.saldo > 0 ? 'Te debe ' + money.format(s.saldo) : s.saldo < 0 ? 'Le debes ' + money.format(-s.saldo) : 'Al día';
            return (
              <Fila key={s.persona.id} icono="👤" titulo={s.persona.nombre} sub={texto} clase={s.saldo > 0 ? 'positivo' : (s.saldo < 0 ? 'negativo' : '')}
                derecha={(
                  <span className="fila-acciones">
                    {s.saldo !== 0 && <button type="button" className="btn secundario sm" onClick={() => liquidar(hojas, s.persona.id)}>Liquidar</button>}
                    <button type="button" className="btn texto peligro-txt" aria-label={'Quitar a ' + s.persona.nombre} onClick={() => {
                      confirmarEliminar(hojas, '¿Quitar persona?', s.persona.nombre + ' se elimina de tu lista.').then((ok) => {
                        if (!ok) return;
                        commit((e) => {
                          const r = domain.eliminarPersona(e, s.persona.id);
                          if (!r.ok) throw new Error(r.error === 'saldo' ? 'Tiene un saldo pendiente: liquídalo primero.' : 'Tiene gastos compartidos en el historial, por eso no se puede quitar.');
                        }, { mensaje: 'Persona eliminada' });
                      });
                    }}>Quitar</button>
                  </span>
                )} />
            );
          })}
        </Tarjeta>
      )}

      <Seccion titulo="Historial" />
      {!hist.length ? <Vacio icono="🤝" titulo="Sin gastos compartidos" texto="Divide una cuenta entre varios y lleva quién le debe a quién." /> : (
        <Tarjeta clase="lista">
          {hist.map((co) => {
            const c = domain.cat(est, co.categoriaId);
            const mia = co.participantes.filter((p) => p.personaId === 'yo')[0];
            return <Fila key={co.id} icono={<IconoCat cat={c} />} titulo={co.descripcion}
              sub={dates.corto(co.fecha) + ' · Pagó ' + domain.nombrePersona(est, co.pagadoPor) + ' · Mi parte ' + money.format(mia ? mia.parte : 0)}
              derecha={<span className="monto">{money.format(co.total)}</span>}
              onClick={() => hojas.abrir({ titulo: co.descripcion, contenido: ({ cerrar }) => <DetalleCompartido id={co.id} cerrar={cerrar} hojas={hojas} /> })} />;
          })}
        </Tarjeta>
      )}
    </m.div>
  );
}

export default function Deudas() {
  const { sub } = useApp();
  const hojas = useHojas();
  const actual = sub.deudas;
  return (
    <m.div className="pantalla" variants={contenedor} initial="oculto" animate="visible">
      <Tabs id="deudas" opciones={[{ v: 'deudas', t: 'Deudas y cuotas' }, { v: 'compartidos', t: 'Compartidos' }]} actual={actual} onSel={(v) => setSub('deudas', v)} etiqueta="Secciones de Deudas" />
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={actual} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
          {actual === 'compartidos' ? <VistaCompartidos hojas={hojas} /> : <VistaDeudas hojas={hojas} />}
        </m.div>
      </AnimatePresence>
    </m.div>
  );
}
