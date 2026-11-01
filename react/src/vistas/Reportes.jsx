import { m } from 'motion/react';
import { money, dates, domain } from '../lib.js';
import { useApp, setRep, commit, descargar, toast } from '../estado.js';
import { store } from '../lib.js';
import { useHojas } from '../ui/Hojas.jsx';
import { Numero, Tarjeta, Seccion, Vacio, Fila, Barra } from '../ui/Basicos.jsx';
import { contenedor, elemento } from '../ui/movimiento.js';
import { Dona, Barras, Lineas } from '../graficas/Graficas.jsx';
import { abrirEdicion, cat } from './comun.jsx';
import { IconoCat, MontoEl } from '../ui/Basicos.jsx';

export function exportar(estado, tipo) {
  const h = dates.hoy();
  if (tipo === 'csv') descargar('santisinplata-' + h + '.csv', 'text/csv', store.exportarCSV(estado));
  else descargar('santisinplata-respaldo-' + h + '.json', 'application/json', store.exportarJSON(estado));
  commit((est) => { est.ajustes.ultimoExport = h; }, { mensaje: 'Archivo exportado', deshacer: false });
}

export function abrirExportar(hojas, estado) {
  hojas.abrir({
    titulo: 'Exportar datos',
    contenido: ({ cerrar }) => (
      <>
        <p className="ayuda">El CSV trae tus movimientos (para Excel o Google Sheets). El JSON es la copia completa para restaurar la app.</p>
        <div className="lista tarjeta">
          <Fila icono="📄" titulo="Movimientos (CSV)" sub="Se abre en Excel y Google Sheets" onClick={() => { exportar(estado, 'csv'); cerrar(); }} />
          <Fila icono="💾" titulo="Respaldo completo (JSON)" sub="Todo: metas, deudas, presupuestos…" onClick={() => { exportar(estado, 'json'); cerrar(); }} />
        </div>
      </>
    )
  });
}

const OPCIONES = [{ v: 'mes', t: 'Este periodo' }, { v: 'anterior', t: 'Periodo anterior' }, { v: '3m', t: 'Últimos 3 meses' }, { v: 'anio', t: 'Este año' }, { v: 'rango', t: 'Personalizado' }];

export default function Reportes() {
  const { estado: est, hoy, rep: R } = useApp();
  const hojas = useHojas();
  let { desde, hasta } = R;
  if (R.clave === 'rango' && (!desde || !hasta)) { desde = domain.periodo(est, hoy).desde; hasta = hoy; }
  const rango = domain.rangoPorClave(est, R.clave, hoy, { desde, hasta });
  const res = domain.resumen(est, hoy, { desde: rango.desde, hasta: rango.hasta, dias: rango.dias });
  const cats = domain.gastosPorCategoria(est, rango.desde, rango.hasta);
  const agr = domain.agruparTop(cats, 6);
  const top = cats.slice(0, 5);

  const cambioRango = (campo, valor) => {
    const d = campo === 'desde' ? valor : desde, h = campo === 'hasta' ? valor : hasta;
    if (!dates.esValida(d) || !dates.esValida(h)) return;
    if (d > h) { toast('La fecha inicial no puede ser posterior a la final.', { error: true }); return; }
    setRep({ desde: d, hasta: h });
  };

  let lineas = null;
  if (R.clave === 'mes' || R.clave === 'anterior') {
    const previo = { desde: rango.previo.desde, hasta: rango.previo.hasta, dias: dates.diferenciaDias(rango.previo.desde, rango.previo.hasta) + 1 };
    const a = domain.acumuladoDiario(est, { desde: rango.desde, hasta: rango.hasta, dias: rango.dias }, hoy);
    const p = domain.acumuladoDiario(est, previo, hoy);
    const n = Math.max(a.length, p.length);
    const mitad = Math.floor((n - 1) / 2);
    lineas = { a, p, et: [{ i: 0, texto: '1' }, { i: mitad, texto: String(mitad + 1) }, { i: n - 1, texto: String(n) }] };
  }
  const cmp = cats.length ? domain.comparativo(est, rango, rango.previo).slice(0, 8) : [];

  return (
    <m.div className="pantalla columnas" variants={contenedor} initial="oculto" animate="visible">
      <m.div variants={elemento} className="rep-barra">
        <select className="entrada" aria-label="Periodo del reporte" value={R.clave} onChange={(e) => setRep({ clave: e.target.value })}>
          {OPCIONES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
        <button type="button" className="btn secundario" onClick={() => abrirExportar(hojas, est)}>Exportar</button>
      </m.div>
      {R.clave === 'rango' && (
        <div className="filtros-fila">
          <input type="date" className="entrada" aria-label="Desde" value={desde} min="2000-01-01" onChange={(e) => cambioRango('desde', e.target.value)} />
          <input type="date" className="entrada" aria-label="Hasta" value={hasta} min="2000-01-01" onChange={(e) => cambioRango('hasta', e.target.value)} />
        </div>
      )}
      <m.p variants={elemento} className="rep-periodo">{rango.etiqueta}</m.p>

      <Tarjeta clase="kpis">
        <div><span className="mini-et">Ingresos</span><Numero como="strong" className="mini-valor ingreso" valor={res.ingresos} /></div>
        <div><span className="mini-et">Gastos</span><Numero como="strong" className="mini-valor gasto" valor={res.gastos} /></div>
        <div><span className="mini-et">Balance</span><Numero como="strong" className="mini-valor" valor={res.balance} /></div>
        <div><span className="mini-et">Tasa de ahorro</span><strong className="mini-valor">{res.tasaAhorro === null ? '—' : Math.round(res.tasaAhorro * 100) + ' %'}</strong></div>
      </Tarjeta>

      <Seccion titulo="¿En qué se va la plata?" />
      {!cats.length ? (
        <Tarjeta><Vacio icono="📊" titulo="Sin gastos en este periodo" texto="Cuando registres gastos verás aquí la distribución por categoría." /></Tarjeta>
      ) : (
        <Tarjeta clase="grafica">
          <Dona items={agr} etiqueta="Gastos" />
          <ul className="leyenda">
            {agr.map((c) => (
              <li key={c.categoriaId || c.nombre}>
                <span className="punto" aria-hidden="true" style={{ background: c.color }} />
                <span className="ley-nombre">{(c.icono ? c.icono + ' ' : '') + c.nombre}</span>
                <span className="ley-pct">{Math.round(c.pct * 100) + ' %'}</span>
                <span className="ley-monto">{money.format(c.monto)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Seccion titulo="Ingresos vs. gastos · 6 meses" />
      <Tarjeta clase="grafica">
        <Barras serie={domain.serieMensual(est, hoy, 6)} />
        <div className="leyenda-linea"><span className="ley-chip ingreso">Ingresos</span><span className="ley-chip gasto">Gastos</span></div>
      </Tarjeta>

      {lineas && (
        <>
          <Seccion titulo="Gasto acumulado" />
          <Tarjeta clase="grafica">
            <Lineas actual={lineas.a} previo={lineas.p} etiquetas={lineas.et} />
            <div className="leyenda-linea"><span className="ley-chip actual">Este periodo</span><span className="ley-chip previa">Periodo anterior</span></div>
          </Tarjeta>
        </>
      )}

      {cats.length > 0 && (
        <>
          <Seccion titulo="Top 5 categorías" />
          <Tarjeta clase="lista">
            {top.map((c) => (
              <m.div key={c.categoriaId} variants={elemento} className="fila fila-barra">
                <div className="fila-dos"><span className="fila-titulo">{c.icono + ' ' + c.nombre}</span><span className="monto">{money.format(c.monto)}</span></div>
                <Barra pct={top[0].monto ? c.monto / top[0].monto : 0} fina color={c.color} etiqueta={'Peso de ' + c.nombre} />
              </m.div>
            ))}
          </Tarjeta>
          <Seccion titulo="Top 5 gastos" />
          <Tarjeta clase="lista">
            {domain.topGastos(est, rango.desde, rango.hasta, 5).map((t) => {
              const c = cat(t.categoriaId);
              return <Fila key={t.id} icono={<IconoCat cat={c} />} titulo={t.nota || (c ? c.nombre : '')} sub={dates.corto(t.fecha) + ' · ' + (c ? c.nombre : '')}
                derecha={<MontoEl valor={t.monto} tipo="gasto" />} onClick={() => abrirEdicion(hojas, t)} />;
            })}
          </Tarjeta>
          <Seccion titulo="Comparativo con el periodo anterior" />
          <Tarjeta clase="lista">
            {cmp.map((c) => {
              let txt, clase = '';
              if (c.nuevo) { txt = 'nuevo'; clase = 'sube'; }
              else if (c.variacion === null) txt = '—';
              else if (c.actual === 0) { txt = '↓ 100 %'; clase = 'baja'; }
              else if (c.variacion === 0) txt = '= 0 %';
              else { txt = (c.variacion > 0 ? '↑ ' : '↓ ') + Math.round(Math.abs(c.variacion) * 100) + ' %'; clase = c.variacion > 0 ? 'sube' : 'baja'; }
              return <Fila key={c.categoriaId} icono={c.icono} titulo={c.nombre} sub={'Antes ' + money.format(c.previo)}
                derecha={<span className="var-col"><span className="monto">{money.format(c.actual)}</span><span className={'variacion ' + clase}>{txt}</span></span>} />;
            })}
          </Tarjeta>
        </>
      )}
    </m.div>
  );
}
