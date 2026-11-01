import { m, AnimatePresence } from 'motion/react';
import { useApp, quitarToast } from './estado.js';
import { resorte } from './ui/movimiento.js';

// Aviso inferior: entra con resorte y se descarta deslizándolo hacia un lado
export default function Avisos() {
  const { toast } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <m.div key={toast.id} className={'toast' + (toast.error ? ' error' : '')}
            initial={{ y: 40, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={resorte} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
            onDragEnd={(_, i) => { if (Math.abs(i.offset.x) > 80 || Math.abs(i.velocity.x) > 500) quitarToast(); }}>
            <span className="toast-msg">{toast.msg}</span>
            {toast.accion && <button type="button" className="toast-accion" onClick={() => { quitarToast(); toast.accion.fn(); }}>{toast.accion.texto}</button>}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
