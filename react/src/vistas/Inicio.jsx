import { m } from 'motion/react';
import { money, domain } from '../lib.js';
import { useApp, irA, reemplazar } from '../estado.js';
import { useHojas } from '../ui/Hojas.jsx';
import { Numero, Barra, Tarjeta, Seccion, Vacio } from '../ui/Basicos.jsx';
import { contenedor, elemento } from '../ui/movimiento.js';
import { FilaMov, PieMarca, abrirRegistro, cargarEjemplo, ordenarMovs } from './comun.jsx';

export default function Inicio() {
  const { estado: est, hoy } = useApp();
  const hojas = useHojas();
  const r = domain.resumen(est, hoy);
  const nombre = est.ajustes.nombreUsuario;
  const pres = domain.estadoPresupuestos(est, hoy).filter((p) => p.presupuesto.categoriaId === null)[0];
  const alertas = domain.alertas(est, hoy);
  const ult = ordenarMovs(est.transacciones).slice(0, 3);

  return (
    <m.div className="pantalla columnas" variants={contenedor} initial="oculto" animate="visible">
      <m.p variants={elemento} className="saludo">{'Hola' + (nombre ? ', ' + nombre : '')}</m.p>

      <Tarjeta clase="principal">
        <p className="principal-et">{r.balance >= 0 ? 'Te queda este mes' : 'Vas en rojo este mes'}</p>
        <Numero como="p" className="monto-grande" valor={r.balance} />
        <div className="dos-col">
          <div><span className="mini-et">Ingresos</span><Numero como="strong" className="mini-valor" valor={r.ingresos} /></div>
          <div><span className="mini-et">Gastos</span><Numero como="strong" className="mini-valor" valor={r.gastos} /></div>
        </div>
        {pres && (
          <div className="principal-pres">
            <div className="fila-dos"><span>Presupuesto del mes</span><strong>{Math.round(pres.pct * 100) + ' %'}</strong></div>
            <Barra pct={pres.pct} estado={pres.estado} etiqueta="Presupuesto total del mes" />
            <p className="detalle-pres">{money.format(pres.gastado) + ' de ' + money.format(pres.presupuesto.limiteMensual)}</p>
          </div>
        )}
      </Tarjeta>

      {r.ingresos > 0 ? (
        <m.p variants={elemento} className="chip-info">
          Puedes gastar <strong>{'~' + money.format(r.disponibleDiario)}</strong> por día
          <span className="chip-sub">{' · quedan ' + r.diasRestantes + (r.diasRestantes === 1 ? ' día' : ' días') + (r.comprometido ? ' · ya comprometido ' + money.format(r.comprometido) : '')}</span>
        </m.p>
      ) : est.transacciones.length ? (
        <m.p variants={elemento} className="chip-info suave">Registra un ingreso de este periodo para saber cuánto puedes gastar al día.</m.p>
      ) : null}

      {alertas.length > 0 && (
        <div className="alertas" role="region" aria-label="Avisos">
          {alertas.slice(0, 5).map((a, i) => (
            <m.p key={i} variants={elemento} className={'alerta nivel-' + a.nivel}>
              <span className="alerta-punto" aria-hidden="true" /><span>{a.texto}</span>
            </m.p>
          ))}
        </div>
      )}

      {r.gastos > 0 && (
        <Tarjeta clase="ritmo">
          <div><span className="mini-et">Gasto diario promedio</span><Numero como="strong" className="mini-valor" valor={r.gastoDiarioPromedio} /></div>
          <div><span className="mini-et">Proyección a fin de mes (estimado)</span><Numero como="strong" className="mini-valor" valor={r.proyeccionFinDeMes} /></div>
        </Tarjeta>
      )}

      <Seccion titulo="Últimos movimientos" accion={est.transacciones.length ? { texto: 'Ver todos', fn: () => irA('movs') } : null} />
      {ult.length === 0 ? (
        <>
          <Vacio icono="🧾" titulo="Aún no hay movimientos" texto="Registra tu primer gasto o ingreso para empezar a ver en qué se te va la plata."
            accion={{ texto: 'Registrar movimiento', fn: () => abrirRegistro(hojas) }} />
          <m.p variants={elemento} className="centro">
            <button type="button" className="btn texto" onClick={() => cargarEjemplo(hojas, reemplazar)}>Explorar con datos de ejemplo</button>
          </m.p>
        </>
      ) : (
        <Tarjeta clase="lista">{ult.map((t, i) => <FilaMov key={t.id} t={t} hojas={hojas} i={i} />)}</Tarjeta>
      )}
      <m.div variants={elemento}><PieMarca /></m.div>
    </m.div>
  );
}
