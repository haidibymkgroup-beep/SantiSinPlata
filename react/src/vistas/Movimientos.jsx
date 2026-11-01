import { m } from 'motion/react';
import { money, dates, domain, validators as V } from '../lib.js';
import { useApp, setMov } from '../estado.js';
import { useHojas } from '../ui/Hojas.jsx';
import { Vacio } from '../ui/Basicos.jsx';
import { contenedor, elemento } from '../ui/movimiento.js';
import { FilaMov, abrirRegistro, cat, ordenarMovs } from './comun.jsx';

export default function Movimientos() {
  const { estado: est, hoy, mov: F } = useApp();
  const hojas = useHojas();

  const rango = F.rango === 'mes' ? domain.periodo(est, hoy)
    : F.rango === 'anterior' ? dates.desplazarPeriodo(hoy, est.ajustes.diaInicioMes, -1) : null;
  const nq = V.normalizar(F.q);
  const txs = ordenarMovs(est.transacciones.filter((t) => {
    if (rango && (t.fecha < rango.desde || t.fecha > rango.hasta)) return false;
    if (F.tipo !== 'todos' && t.tipo !== F.tipo) return false;
    if (F.cat !== 'todas' && t.categoriaId !== F.cat) return false;
    if (nq) { const c = cat(t.categoriaId); if (V.normalizar(t.nota + ' ' + (c ? c.nombre : '')).indexOf(nq) < 0) return false; }
    return true;
  }));
  const ing = money.suma(txs.filter((t) => t.tipo === 'ingreso').map((t) => t.monto));
  const gas = money.suma(txs.filter((t) => t.tipo === 'gasto').map((t) => t.monto));
  const visibles = txs.slice(0, F.limite);

  const catOps = [{ v: 'todas', t: 'Todas las categorías' }].concat(est.categorias.map((c) => ({ v: c.id, t: c.icono + ' ' + c.nombre + (c.tipo === 'ingreso' ? ' (ingreso)' : '') })));
  const sel = ({ etiqueta, valor, ops, campo }) => (
    <select className="entrada" aria-label={etiqueta} value={valor} onChange={(e) => setMov({ [campo]: e.target.value, limite: 80 })}>
      {ops.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );

  // Agrupa por día conservando el orden
  const grupos = [];
  visibles.forEach((t) => {
    const g = grupos[grupos.length - 1];
    if (g && g.fecha === t.fecha) g.items.push(t); else grupos.push({ fecha: t.fecha, items: [t] });
  });
  let indice = 0;

  return (
    <m.div className="pantalla" variants={contenedor} initial="oculto" animate="visible">
      <m.div variants={elemento} className="filtros">
        <input type="search" className="entrada" placeholder="Buscar por nota o categoría" aria-label="Buscar movimientos"
          value={F.q} onChange={(e) => setMov({ q: e.target.value, limite: 80 })} />
        <div className="filtros-fila">
          {sel({ etiqueta: 'Periodo', valor: F.rango, campo: 'rango', ops: [{ v: 'mes', t: 'Este periodo' }, { v: 'anterior', t: 'Periodo anterior' }, { v: 'todo', t: 'Todo' }] })}
          {sel({ etiqueta: 'Tipo', valor: F.tipo, campo: 'tipo', ops: [{ v: 'todos', t: 'Todos' }, { v: 'gasto', t: 'Gastos' }, { v: 'ingreso', t: 'Ingresos' }] })}
        </div>
        {sel({ etiqueta: 'Categoría', valor: F.cat, campo: 'cat', ops: catOps })}
      </m.div>
      <p className="resumen-lista" aria-live="polite">
        {txs.length ? txs.length + (txs.length === 1 ? ' movimiento' : ' movimientos') + ' · Ingresos ' + money.format(ing) + ' · Gastos ' + money.format(gas) : ''}
      </p>
      <div className="movs">
        {txs.length === 0 ? (
          est.transacciones.length
            ? <Vacio icono="🔍" titulo="Sin resultados" texto="No hay movimientos con esos filtros." />
            : <Vacio icono="🧾" titulo="Aún no hay movimientos" texto="Toca + para registrar el primero." accion={{ texto: 'Registrar movimiento', fn: () => abrirRegistro(hojas) }} />
        ) : grupos.map((g) => {
          const total = money.suma(g.items.filter((x) => x.tipo === 'gasto').map((x) => x.monto));
          return (
            <m.div key={g.fecha} variants={elemento} className="grupo">
              <div className="grupo-enc"><span>{dates.etiquetaDia(g.fecha, hoy)}</span>{total ? <span className="grupo-total">{'Gastos ' + money.format(total)}</span> : null}</div>
              <div className="tarjeta lista">{g.items.map((t) => <FilaMov key={t.id} t={t} hojas={hojas} i={indice++} />)}</div>
            </m.div>
          );
        })}
        {txs.length > visibles.length && (
          <p className="centro"><button type="button" className="btn secundario" onClick={() => setMov({ limite: F.limite + 80 })}>{'Ver más (' + (txs.length - visibles.length) + ')'}</button></p>
        )}
      </div>
    </m.div>
  );
}
