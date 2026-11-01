import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { m, AnimatePresence, useDragControls } from 'motion/react';
import { useMediaQuery } from './Basicos.jsx';

const Ctx = createContext(null);
export const useHojas = () => useContext(Ctx);

function enfocables(el) {
  if (!el) return [];
  return Array.prototype.filter.call(
    el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'),
    (n) => !n.hidden && n.offsetParent !== null
  );
}

// Hoja inferior: sube con resorte, se arrastra hacia abajo para cerrarla (en pantallas grandes es un cuadro centrado)
function HojaVista({ h, esTope, cerrar }) {
  const idTitulo = useId();
  const panel = useRef(null);
  const controles = useDragControls();
  const ancha = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const previo = document.activeElement;
    const t = setTimeout(() => { const f = enfocables(panel.current)[0]; if (f) f.focus(); }, 80);
    return () => {
      clearTimeout(t);
      if (h.onCerrar) h.onCerrar();
      if (previo && previo.focus && document.body.contains(previo)) previo.focus();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!esTope) return undefined;
    const alTecla = (e) => { if (e.key === 'Escape' && !h.bloqueante) { e.preventDefault(); cerrar(); } };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [esTope, h.bloqueante, cerrar]);

  const atrapar = (e) => {
    if (e.key !== 'Tab') return;
    const f = enfocables(panel.current);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === a || !panel.current.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };

  const entrada = ancha ? { opacity: 0, y: 28, scale: 0.97 } : { y: '100%' };
  const reposo = ancha ? { opacity: 1, y: 0, scale: 1 } : { y: 0 };

  return (
    <div className="capa capa-r">
      <m.div className="fondo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }}
        onClick={() => { if (!h.bloqueante) cerrar(); }} />
      <m.section ref={panel} className={'hoja ' + (h.clase || '')} role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        initial={entrada} animate={reposo} exit={{ ...entrada, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
        drag={h.bloqueante || ancha ? false : 'y'} dragListener={false} dragControls={controles}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.55 }}
        onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 650) cerrar(); }}
        onKeyDown={atrapar}>
        {!h.bloqueante && !ancha && (
          <div className="agarre" onPointerDown={(e) => controles.start(e)} aria-hidden="true"><span /></div>
        )}
        <div className="hoja-enc">
          <h2 id={idTitulo}>{h.titulo}</h2>
          {!h.bloqueante && <button type="button" className="icono-btn" aria-label="Cerrar" onClick={cerrar}>✕</button>}
        </div>
        <div className="hoja-cuerpo">{h.contenido({ cerrar })}</div>
      </m.section>
    </div>
  );
}

function Confirmacion({ opts, api, resolver }) {
  const [texto, setTexto] = useState('');
  const habilitado = !opts.escribir || texto.trim() === opts.escribir;
  return (
    <>
      <p className="dialogo-msg">{opts.mensaje}</p>
      {opts.escribir && (
        <div className="campo">
          <p className="ayuda">Escribe {opts.escribir} para confirmar.</p>
          <input type="text" className="entrada" autoComplete="off" aria-label={'Escribe ' + opts.escribir + ' para confirmar'}
            value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      )}
      <div className="acciones">
        <button type="button" className="btn secundario" onClick={() => { resolver(false); api.cerrar(); }}>Cancelar</button>
        <button type="button" className={'btn ' + (opts.peligro ? 'peligro' : 'primario')} aria-disabled={habilitado ? 'false' : 'true'}
          onClick={() => { if (!habilitado) return; resolver(true); api.cerrar(); }}>{opts.textoOk || 'Aceptar'}</button>
      </div>
    </>
  );
}

export function HojasProvider({ children }) {
  const [pila, setPila] = useState([]);
  const sig = useRef(0);

  const quitar = useCallback((id) => setPila((p) => p.filter((h) => h.id !== id)), []);
  const abrir = useCallback((opts) => {
    const id = ++sig.current;
    setPila((p) => [...p, { id, ...opts }]);
    return { cerrar: () => quitar(id), id };
  }, [quitar]);

  // confirmar({ titulo, mensaje, textoOk, peligro, escribir }) → Promise<boolean>
  const confirmar = useCallback((opts) => new Promise((resolver) => {
    abrir({ titulo: opts.titulo, clase: 'dialogo', onCerrar: () => resolver(false), contenido: (api) => <Confirmacion opts={opts} api={api} resolver={resolver} /> });
  }), [abrir]);

  useEffect(() => { document.body.classList.toggle('sin-scroll', pila.length > 0); }, [pila.length]);

  const tope = pila.length ? pila[pila.length - 1].id : null;
  return (
    <Ctx.Provider value={{ abrir, confirmar }}>
      {children}
      <AnimatePresence>
        {pila.map((h) => <HojaVista key={h.id} h={h} esTope={h.id === tope} cerrar={() => quitar(h.id)} />)}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
