import { useEffect, useRef, useSyncExternalStore } from 'react';
import { m, animate, LayoutGroup } from 'motion/react';
import { money } from '../lib.js';
import { elemento, curva, movimientoReducido } from './movimiento.js';

// ---------- íconos ----------
const ICONOS = {
  home: [['path', { d: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' }]],
  list: [['path', { d: 'M4 6h16M4 12h16M4 18h10' }]],
  target: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 4.5 }]],
  card: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2.5 }], ['path', { d: 'M3 10h18M7 15h3' }]],
  chart: [['path', { d: 'M5 20V11M12 20V4M19 20v-6' }]],
  ajustes: [['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }], ['circle', { cx: 15, cy: 7, r: 2 }], ['circle', { cx: 9, cy: 17, r: 2 }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  atras: [['path', { d: 'M15 5l-7 7 7 7' }]]
};
export function Icono({ nombre }) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
      {ICONOS[nombre].map(([Tag, props], i) => <Tag key={i} {...props} />)}
    </svg>
  );
}

// ---------- media query ----------
export function useMediaQuery(consulta) {
  return useSyncExternalStore(
    (cb) => { const mq = window.matchMedia(consulta); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
    () => window.matchMedia(consulta).matches,
    () => false
  );
}

// ---------- número que cuenta ----------
// El texto animado va oculto para lectores de pantalla; ellos leen siempre el valor final.
export function Numero({ valor, formato = money.format, className, como = 'span' }) {
  const ref = useRef(null);
  const previo = useRef(movimientoReducido() ? valor : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (movimientoReducido() || previo.current === valor) { el.textContent = formato(valor); previo.current = valor; return undefined; }
    const c = animate(previo.current, valor, {
      duration: 0.85, ease: curva,
      onUpdate: (v) => { el.textContent = formato(Math.round(v)); },
      onComplete: () => { el.textContent = formato(valor); }
    });
    previo.current = valor;
    return () => c.stop();
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const Tag = como;
  return (
    <>
      <span className="solo-lectores">{formato(valor)}</span>
      <Tag ref={ref} className={className} aria-hidden="true">{formato(movimientoReducido() ? valor : 0)}</Tag>
    </>
  );
}

// ---------- piezas visuales ----------
export function Tarjeta({ clase = '', children, ...resto }) {
  return <m.section variants={elemento} className={'tarjeta ' + clase} {...resto}>{children}</m.section>;
}

export function Seccion({ titulo, accion }) {
  return (
    <m.div variants={elemento} className="seccion">
      <h2>{titulo}</h2>
      {accion && <button type="button" className="btn texto" onClick={accion.fn}>{accion.texto}</button>}
    </m.div>
  );
}

export function Barra({ pct, estado = 'ok', etiqueta = 'Progreso', fina = false, color }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className={'barra' + (fina ? ' fina' : '')} role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
      <m.div className={'barra-relleno est-' + estado} style={color ? { background: color } : undefined}
        initial={{ width: 0 }} animate={{ width: p * 100 + '%' }} transition={{ duration: 0.9, ease: curva, delay: 0.15 }} />
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }) {
  return (
    <m.div variants={elemento} className="vacio">
      <div className="vacio-icono" aria-hidden="true">{icono}</div>
      <p className="vacio-titulo">{titulo}</p>
      {texto && <p className="vacio-texto">{texto}</p>}
      {accion && <button type="button" className="btn primario" onClick={accion.fn}>{accion.texto}</button>}
    </m.div>
  );
}

export function MontoEl({ valor, tipo, clase = '' }) {
  const signo = tipo === 'ingreso' ? '+' : (tipo === 'gasto' ? '−' : '');
  return <span className={'monto ' + (tipo || '') + (clase ? ' ' + clase : '')}>{signo + money.format(Math.abs(valor)).replace('-', '')}</span>;
}

export function IconoCat({ cat }) {
  return <span className="icono-cat" aria-hidden="true">{cat ? cat.icono : '•'}</span>;
}

// Fila de lista: { icono(nodo|texto), titulo, sub, derecha, onClick, clase }
export function Fila({ icono, titulo, sub, derecha, onClick, clase = '', i }) {
  const Tag = onClick ? m.button : m.div;
  return (
    <Tag type={onClick ? 'button' : undefined} className={'fila ' + clase} onClick={onClick} variants={i !== undefined && i >= 10 ? undefined : elemento}
      whileTap={onClick ? { scale: 0.985 } : undefined}>
      {icono && (typeof icono === 'string' ? <span className="icono-cat" aria-hidden="true">{icono}</span> : icono)}
      <span className="fila-cuerpo">
        <span className="fila-titulo">{titulo}</span>
        {sub ? <span className="fila-sub">{sub}</span> : null}
      </span>
      {derecha ? <span className="fila-der">{derecha}</span> : null}
    </Tag>
  );
}

// Pestañas internas con indicador que se desliza
export function Tabs({ opciones, actual, onSel, etiqueta = 'Secciones', id }) {
  return (
    <LayoutGroup id={id}>
      <m.div variants={elemento} className="tabs" role="tablist" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button key={o.v} type="button" className={'tab' + (o.v === actual ? ' activa' : '')} role="tab" aria-selected={o.v === actual} onClick={() => onSel(o.v)}>
            {o.v === actual && <m.span layoutId="pestana" className="pastilla" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="pastilla-txt">{o.t}</span>
          </button>
        ))}
      </m.div>
    </LayoutGroup>
  );
}
