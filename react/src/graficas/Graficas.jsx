import { m } from 'motion/react';
import { money } from '../lib.js';
import { Numero } from '../ui/Basicos.jsx';
import { curva } from '../ui/movimiento.js';

// Las gráficas se dibujan cuando entran en pantalla. Colores dependientes del tema van en clases CSS.
const visible = { once: true, amount: 0.35 };

// Máximo "redondo" para el eje Y
function techo(max) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

function Grafica({ vb, etiqueta, clase = 'grafica-svg', children }) {
  return (
    <svg viewBox={vb} role="img" aria-label={etiqueta} className={clase} preserveAspectRatio="xMidYMid meet">
      <title>{etiqueta}</title>
      {children}
    </svg>
  );
}

// items: [{nombre, monto, color, pct}]
export function Dona({ items, etiqueta = 'Gastos' }) {
  const total = items.reduce((a, i) => a + i.monto, 0);
  const C = 2 * Math.PI * 76;
  const desc = 'Gasto por categoría: ' + items.map((i) => i.nombre + ' ' + Math.round(i.pct * 100) + ' %').join(', ') + '.';
  let acc = 0;
  return (
    <div className="dona-caja">
      <Grafica vb="0 0 200 200" etiqueta={desc} clase="grafica-svg dona">
        <circle cx="100" cy="100" r="76" fill="none" strokeWidth="26" className="dona-fondo" />
        {items.map((it, i) => {
          const len = C * it.monto / total;
          const gap = items.length > 1 ? Math.min(2, len) : 0;
          const dash = Math.max(0, len - gap);
          const desplazamiento = -acc;
          acc += len;
          return (
            <m.circle key={it.categoriaId || it.nombre} cx="100" cy="100" r="76" fill="none" stroke={it.color} strokeWidth="26"
              strokeDashoffset={desplazamiento.toFixed(2)} transform="rotate(-90 100 100)"
              initial={{ strokeDasharray: '0 ' + C.toFixed(2) }}
              whileInView={{ strokeDasharray: dash.toFixed(2) + ' ' + (C - dash).toFixed(2) }} viewport={visible}
              transition={{ duration: 0.9, ease: curva, delay: 0.1 + i * 0.09 }} />
          );
        })}
      </Grafica>
      <div className="dona-centro">
        <span className="dona-txt-et">{etiqueta}</span>
        <Numero className="dona-txt-valor" valor={total} formato={money.formatCorto} />
      </div>
    </div>
  );
}

// serie: [{etiqueta, ingresos, gastos}]
export function Barras({ serie }) {
  const W = 340, H = 190, pl = 6, pr = 6, pt = 14, pb = 26, w = W - pl - pr, h = H - pt - pb;
  const max = techo(Math.max(1, ...serie.map((x) => Math.max(x.ingresos, x.gastos))));
  const desc = 'Ingresos y gastos de los últimos ' + serie.length + ' meses: ' + serie.map((x) =>
    x.etiqueta + ' ingresos ' + money.format(x.ingresos) + ', gastos ' + money.format(x.gastos)).join('; ') + '.';
  const gw = w / serie.length, bw = Math.min(18, gw / 3), base = pt + h;
  return (
    <Grafica vb={'0 0 ' + W + ' ' + H} etiqueta={desc}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pl} x2={W - pr} y1={pt + h - h * f} y2={pt + h - h * f} className="rejilla" />
          {f > 0 && <text x={pl} y={pt + h - h * f - 3} className="eje">{money.formatCorto(max * f)}</text>}
        </g>
      ))}
      {serie.map((x, i) => {
        const cx = pl + gw * i + gw / 2;
        return (
          <g key={x.etiqueta + i}>
            {[['ingresos', 'barra-ingreso', -bw - 1], ['gastos', 'barra-gasto', 1]].map(([k, clase, dx], j) => {
              const alto = Math.max(x[k] > 0 ? 2 : 0, h * x[k] / max);
              return (
                <m.rect key={k} x={cx + dx} width={bw} rx="3" className={clase}
                  initial={{ height: 0, y: base }} whileInView={{ height: alto, y: base - alto }} viewport={visible}
                  transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.1 + i * 0.07 + j * 0.04 }} />
              );
            })}
            <text x={cx} y={H - 8} textAnchor="middle" className="eje">{x.etiqueta}</text>
          </g>
        );
      })}
    </Grafica>
  );
}

// Acumulados diarios (null = futuro). etiquetas: [{i, texto}]
export function Lineas({ actual, previo, etiquetas }) {
  const W = 340, H = 170, pl = 6, pr = 10, pt = 14, pb = 24, w = W - pl - pr, h = H - pt - pb;
  const n = Math.max(actual.length, previo.length);
  const vals = actual.concat(previo).filter((v) => v !== null);
  const max = techo(Math.max(1, ...vals));
  const ultimos = actual.filter((v) => v !== null);
  const desc = 'Gasto acumulado del periodo: ' + money.format(ultimos.length ? ultimos[ultimos.length - 1] : 0) +
    (previo.length ? ' frente a ' + money.format(previo[previo.length - 1] || 0) + ' del periodo anterior.' : '.');
  const X = (i) => pl + (n <= 1 ? 0 : w * i / (n - 1));
  const Y = (v) => pt + h - h * v / max;
  const camino = (arr) => {
    let d = '', abierto = false;
    arr.forEach((v, i) => {
      if (v === null) { abierto = false; return; }
      d += (abierto ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
      abierto = true;
    });
    return d.trim();
  };
  const dA = camino(actual);
  let ult = -1;
  actual.forEach((v, i) => { if (v !== null) ult = i; });
  return (
    <Grafica vb={'0 0 ' + W + ' ' + H} etiqueta={desc}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pl} x2={W - pr} y1={pt + h - h * f} y2={pt + h - h * f} className="rejilla" />
          {f > 0 && <text x={pl} y={pt + h - h * f - 3} className="eje">{money.formatCorto(max * f)}</text>}
        </g>
      ))}
      {previo.length > 0 && (
        <m.path d={camino(previo)} fill="none" className="linea-previa" strokeWidth="2" strokeDasharray="5 4"
          initial={{ opacity: 0 }} whileInView={{ opacity: 0.7 }} viewport={visible} transition={{ duration: 0.8 }} />
      )}
      {dA && (
        <>
          <m.path d={dA + ' L' + X(ult).toFixed(1) + ' ' + (pt + h) + ' L' + X(0).toFixed(1) + ' ' + (pt + h) + ' Z'} className="area-actual"
            initial={{ opacity: 0 }} whileInView={{ opacity: 0.08 }} viewport={visible} transition={{ duration: 0.9, delay: 0.5 }} />
          <m.path d={dA} fill="none" className="linea-actual" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={visible} transition={{ duration: 1.3, ease: curva }} />
          <m.circle cx={X(ult).toFixed(1)} cy={Y(actual[ult]).toFixed(1)} r="4" className="punto-actual"
            initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={visible} transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 1.2 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        </>
      )}
      {(etiquetas || []).map((e) => (
        <text key={e.i} x={X(e.i)} y={H - 8} textAnchor={e.i === 0 ? 'start' : (e.i === n - 1 ? 'end' : 'middle')} className="eje">{e.texto}</text>
      ))}
    </Grafica>
  );
}

// Anillo de progreso (0..1)
export function Anillo({ pct, clase = '', texto = 'Progreso' }) {
  const r = 26, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <Grafica vb="0 0 64 64" etiqueta={texto + ': ' + Math.round(p * 100) + ' %'} clase="anillo">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="anillo-fondo" />
      <m.circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className={'anillo-valor ' + clase} transform="rotate(-90 32 32)"
        initial={{ strokeDasharray: '0 ' + C.toFixed(2) }} animate={{ strokeDasharray: (C * p).toFixed(2) + ' ' + C.toFixed(2) }}
        transition={{ duration: 1, ease: curva, delay: 0.2 }} />
      <text x="32" y="36" textAnchor="middle" className="anillo-txt">{Math.round(p * 100) + '%'}</text>
    </Grafica>
  );
}
