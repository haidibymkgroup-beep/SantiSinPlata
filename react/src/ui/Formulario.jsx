import { useId, useRef, useState } from 'react';
import { m, LayoutGroup } from 'motion/react';
import { money } from '../lib.js';
import { useApp } from '../estado.js';

// Descriptor de campo: { n, t, et, ayuda, valor, opciones|fn, visible(valores), max, min, placeholder, atajos, claves,
//   onchange(v, {set, valores}), render({valor,set,valores,res,id}), texto(valores,res) }
// Tipos: texto · monto · numero · decimal · fecha · select · chips · segmentado · check · info · custom
const opcionesDe = (c, valores) => (typeof c.opciones === 'function' ? c.opciones(valores) : c.opciones) || [];

function inicial(campos) {
  const v = {};
  campos.forEach((c) => {
    if (c.t === 'info') return;
    if (c.valor !== undefined) v[c.n] = c.valor;
    else if (c.t === 'check') v[c.n] = false;
    else if (c.t === 'chips' || c.t === 'segmentado') v[c.n] = null;
    else v[c.n] = '';
  });
  return v;
}

function Control({ c, valor, valores, res, id, descr, cambiar, marcar, refs }) {
  const ref = (el) => { refs.current[c.n] = el; };
  const tocar = () => marcar(c.n);
  if (c.t === 'texto' || c.t === 'numero' || c.t === 'decimal') {
    return (
      <input ref={ref} type="text" id={id} className="entrada" maxLength={c.max} placeholder={c.placeholder} autoComplete="off" enterKeyHint="done"
        inputMode={c.t === 'texto' ? undefined : (c.t === 'decimal' ? 'decimal' : 'numeric')} aria-describedby={descr}
        value={valor ?? ''} onChange={(e) => cambiar(c.n, e.target.value)} onBlur={tocar} />
    );
  }
  if (c.t === 'monto') {
    return (
      <div className="entrada-grupo">
        <span className="prefijo" aria-hidden="true">$</span>
        <input ref={ref} type="text" id={id} className="entrada entrada-monto" placeholder={c.placeholder} autoComplete="off" enterKeyHint="done"
          inputMode="numeric" aria-describedby={descr} value={valor ?? ''}
          onChange={(e) => cambiar(c.n, money.formatoEntrada(e.target.value))} onBlur={tocar} />
      </div>
    );
  }
  if (c.t === 'fecha') {
    return (
      <div>
        <input ref={ref} type="date" id={id} className="entrada" min={c.min} max={c.max} aria-describedby={descr}
          value={valor ?? ''} onChange={(e) => cambiar(c.n, e.target.value)} onBlur={tocar} />
        {c.atajos && c.atajos.length > 0 && (
          <div className="atajos">
            {c.atajos.map((a) => (
              <m.button key={a.t} type="button" className="chip chip-sm" whileTap={{ scale: 0.92 }}
                onClick={() => { cambiar(c.n, typeof a.v === 'function' ? a.v() : a.v); marcar(c.n); }}>{a.t}</m.button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (c.t === 'select') {
    return (
      <select ref={ref} id={id} className="entrada" aria-describedby={descr} value={valor ?? ''}
        onChange={(e) => { cambiar(c.n, e.target.value); marcar(c.n); }} onBlur={tocar}>
        {opcionesDe(c, valores).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    );
  }
  if (c.t === 'chips') {
    return (
      <div ref={ref} className="chips" role="radiogroup" aria-labelledby={c.et ? id + '-et' : undefined} aria-describedby={descr}>
        {opcionesDe(c, valores).map((o) => (
          <m.button key={o.v} type="button" role="radio" aria-checked={o.v === valor} className={'chip' + (o.v === valor ? ' activo' : '')}
            whileTap={{ scale: 0.93 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => { cambiar(c.n, o.v); marcar(c.n); }}>
            {o.icono ? <span aria-hidden="true">{o.icono + ' '}</span> : null}{o.t}
          </m.button>
        ))}
      </div>
    );
  }
  if (c.t === 'segmentado') {
    return (
      <LayoutGroup id={id}>
        <div ref={ref} className="segmentado" role="radiogroup" aria-labelledby={c.et ? id + '-et' : undefined} aria-describedby={descr}>
          {opcionesDe(c, valores).map((o) => (
            <button key={o.v} type="button" role="radio" aria-checked={o.v === valor} className={'seg' + (o.v === valor ? ' activo' : '')}
              onClick={() => { cambiar(c.n, o.v); marcar(c.n); }}>
              {o.v === valor && <m.span layoutId="seg" className="pastilla" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <span className="pastilla-txt">{o.t}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
    );
  }
  if (c.t === 'custom') {
    return c.render({ valor, set: (v) => { cambiar(c.n, v); marcar(c.n); }, valores, res, id });
  }
  return null;
}

export function Formulario({ campos, validar, guardar = 'Guardar', onGuardar, secundario, eliminar, aviso, cerrar }) {
  useApp();
  const base = useId();
  const [valores, setValores] = useState(() => inicial(campos));
  const [tocado, setTocado] = useState({});
  const [intentado, setIntentado] = useState(false);
  const refs = useRef({});

  const res = validar(valores);
  const visible = (c) => (c.visible ? c.visible(valores) : true);

  const cambiar = (n, v) => {
    setValores((prev) => {
      const nuevo = { ...prev, [n]: v };
      const c = campos.find((x) => x.n === n);
      if (c && c.onchange) c.onchange(v, { set: (k, x) => { nuevo[k] = x; }, valores: nuevo });
      return nuevo;
    });
  };
  const marcar = (n) => setTocado((t) => (t[n] ? t : { ...t, [n]: true }));

  const claves = (c) => c.claves || [c.n];
  const mensaje = (c) => { for (const k of claves(c)) if (res.errores[k]) return res.errores[k]; return null; };
  const usadas = {};
  campos.forEach((c) => claves(c).forEach((k) => { usadas[k] = true; }));
  const generales = Object.keys(res.errores).filter((k) => !usadas[k]).map((k) => res.errores[k]);

  const intentar = () => {
    setIntentado(true);
    const primero = campos.find((c) => c.t !== 'info' && visible(c) && mensaje(c));
    if (primero && refs.current[primero.n] && refs.current[primero.n].focus) refs.current[primero.n].focus();
  };

  const api = {
    cerrar, valores,
    set: (n, v) => setValores((p) => ({ ...p, [n]: v })),
    reiniciar: () => { setTocado({}); setIntentado(false); },
    foco: (n) => { const el = refs.current[n]; if (el && el.focus) el.focus(); }
  };

  const enviar = (e) => {
    e.preventDefault();
    if (!res.ok) { intentar(); return; }
    if (onGuardar(res.datos, api) !== false) cerrar();
  };

  return (
    <form className="formulario" noValidate autoComplete="off" onSubmit={enviar}>
      {campos.map((c) => {
        if (!visible(c)) return <div key={c.n} data-campo={c.n} hidden />;
        const id = base + '-' + c.n;
        const msg = mensaje(c);
        const ver = !!msg && (tocado[c.n] || intentado);
        const descr = id + '-err' + (c.ayuda ? ' ' + id + '-ay' : '');
        if (c.t === 'info') {
          const txt = c.texto ? c.texto(valores, res) : '';
          return <div key={c.n} className="campo" data-campo={c.n} hidden={!txt}><p className="info" id={id} aria-live="polite">{txt}</p></div>;
        }
        const esGrupo = c.t === 'chips' || c.t === 'segmentado' || c.t === 'custom';
        return (
          <div key={c.n} className={'campo' + (c.clase ? ' ' + c.clase : '')} data-campo={c.n}>
            {c.t === 'check' ? null : (c.et ? (esGrupo ? <span className="etiqueta" id={id + '-et'}>{c.et}</span> : <label className="etiqueta" htmlFor={id}>{c.et}</label>) : null)}
            {c.t === 'check' ? (
              <label className="check" htmlFor={id}>
                <input ref={(el) => { refs.current[c.n] = el; }} type="checkbox" id={id} aria-describedby={descr} checked={!!valores[c.n]}
                  onChange={(e) => cambiar(c.n, e.target.checked)} />
                <span>{c.et}</span>
              </label>
            ) : (
              <Control c={c} valor={valores[c.n]} valores={valores} res={res} id={id} descr={descr} cambiar={cambiar} marcar={marcar} refs={refs} />
            )}
            {c.ayuda ? <p className="ayuda" id={id + '-ay'}>{c.ayuda}</p> : null}
            <p className="error" id={id + '-err'} hidden={!ver}>{ver ? msg : ''}</p>
          </div>
        );
      })}
      {generales.length > 0 && <p className="error general" role="alert">{generales.join(' ')}</p>}
      {aviso ? <p className="ayuda">{aviso}</p> : null}
      <div className="acciones">
        {eliminar && <button type="button" className="btn peligro-suave" onClick={() => eliminar.fn({ cerrar })}>{eliminar.texto || 'Eliminar'}</button>}
        {secundario && (
          <button type="button" className="btn secundario" onClick={() => { if (!res.ok) { intentar(); return; } secundario.fn(res.datos, api); }}>{secundario.texto}</button>
        )}
        <m.button type="submit" className={'btn primario' + (res.ok ? '' : ' inactivo')} aria-disabled={res.ok ? 'false' : 'true'} whileTap={{ scale: 0.97 }}>{guardar}</m.button>
      </div>
    </form>
  );
}
