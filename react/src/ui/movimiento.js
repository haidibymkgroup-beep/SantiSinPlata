// Ajustes de movimiento compartidos: resortes, variantes y utilidades
export const resorte = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 };
export const resorteSuave = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 };
export const curva = [0.22, 0.8, 0.2, 1];

// Los elementos hijos aparecen en cascada cuando un contenedor usa initial="oculto" animate="visible"
export const contenedor = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } }
};
export const elemento = {
  oculto: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: resorte }
};
export const elementoSuave = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } }
};

export function movimientoReducido() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
