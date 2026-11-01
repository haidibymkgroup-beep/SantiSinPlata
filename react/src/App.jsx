import { useEffect } from 'react';
import { m, AnimatePresence, LayoutGroup } from 'motion/react';
import { dates, domain } from './lib.js';
import { useApp, irA } from './estado.js';
import { useHojas } from './ui/Hojas.jsx';
import { Icono } from './ui/Basicos.jsx';
import { resorte } from './ui/movimiento.js';
import Inicio from './vistas/Inicio.jsx';
import Movimientos from './vistas/Movimientos.jsx';
import Planear from './vistas/Planear.jsx';
import Deudas from './vistas/Deudas.jsx';
import Reportes from './vistas/Reportes.jsx';
import Ajustes from './vistas/Ajustes.jsx';
import { abrirRegistro } from './vistas/comun.jsx';
import { abrirRecuperacion } from './vistas/Recuperacion.jsx';

const NAV = [
  { v: 'inicio', t: 'Inicio', i: 'home' }, { v: 'movs', t: 'Movimientos', i: 'list' }, { v: 'planear', t: 'Planear', i: 'target' },
  { v: 'deudas', t: 'Deudas', i: 'card' }, { v: 'reportes', t: 'Reportes', i: 'chart' }
];
const TITULOS = { inicio: 'SantiSinPlata', movs: 'Movimientos', planear: 'Planear', deudas: 'Deudas', reportes: 'Reportes', ajustes: 'Ajustes' };
const VISTAS = { inicio: Inicio, movs: Movimientos, planear: Planear, deudas: Deudas, reportes: Reportes, ajustes: Ajustes };

// Las pantallas se deslizan en la dirección de la navegación
const pagina = {
  entra: (d) => ({ opacity: 0, x: d * 34 }),
  reposo: { opacity: 1, x: 0, transition: resorte },
  sale: (d) => ({ opacity: 0, x: d * -22, transition: { duration: 0.12 } })
};

export default function App() {
  const { estado, vista, dir, aviso, corrupto, hoy } = useApp();
  const hojas = useHojas();
  const Vista = VISTAS[vista] || Inicio;

  useEffect(() => {
    if (corrupto) abrirRecuperacion(hojas, corrupto.errores);
  }, [corrupto]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodo = dates.etiquetaPeriodo(domain.periodo(estado, hoy), estado.ajustes.diaInicioMes);

  return (
    <>
      <div id="app">
        <header id="encabezado" className="encabezado">
          <div className="enc-fila">
            <div className="enc-titulo">
              {vista === 'ajustes'
                ? <button type="button" className="icono-btn claro" aria-label="Volver" onClick={() => irA('inicio')}><Icono nombre="atras" /></button>
                : <span className="marca-h" role="img" aria-label="Haidiby Marketing Group" />}
              <div>
                <AnimatePresence mode="wait" initial={false}>
                  <m.h1 key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>{TITULOS[vista]}</m.h1>
                </AnimatePresence>
                <p className="enc-sub">{vista === 'ajustes' ? 'Preferencias y datos' : periodo}</p>
              </div>
            </div>
            {vista === 'inicio' && (
              <m.button type="button" className="icono-btn claro" aria-label="Ajustes" whileTap={{ scale: 0.88, rotate: 30 }} onClick={() => irA('ajustes')}>
                <Icono nombre="ajustes" />
              </m.button>
            )}
          </div>
          {aviso ? <p className="enc-aviso" role="status">{aviso}</p> : null}
        </header>
        <main id="vista" className="vista" tabIndex={-1}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <m.div key={vista} custom={dir} variants={pagina} initial="entra" animate="reposo" exit="sale"><Vista /></m.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {(vista === 'inicio' || vista === 'movs') && (
          <m.button key="fab" id="fab" className="fab" type="button" aria-label="Nuevo movimiento"
            initial={{ scale: 0, rotate: -90, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0, rotate: 90, opacity: 0 }}
            whileTap={{ scale: 0.88 }} transition={resorte} onClick={() => abrirRegistro(hojas)}>
            <Icono nombre="plus" />
          </m.button>
        )}
      </AnimatePresence>

      <nav id="nav" className="nav" aria-label="Navegación principal">
        <LayoutGroup id="nav">
          {NAV.map((n) => {
            const act = vista === n.v;
            return (
              <m.button key={n.v} type="button" className={'nav-btn' + (act ? ' activo' : '')} aria-current={act ? 'page' : undefined}
                whileTap={{ scale: 0.9 }} onClick={() => irA(n.v)}>
                {act && <m.span layoutId="nav-ind" className="nav-ind" transition={{ type: 'spring', stiffness: 460, damping: 34 }} />}
                <m.span className="nav-ico" animate={{ y: act ? -2 : 0, scale: act ? 1.12 : 1 }} transition={resorte}><Icono nombre={n.i} /></m.span>
                <span>{n.t}</span>
              </m.button>
            );
          })}
        </LayoutGroup>
      </nav>
    </>
  );
}
