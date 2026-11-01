import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { iniciar } from './estado.js';
import { HojasProvider } from './ui/Hojas.jsx';
import App from './App.jsx';
import Avisos from './Avisos.jsx';
import '../../css/styles.css';
import './estilos/extra.css';

document.documentElement.classList.add('rr');
iniciar();

createRoot(document.getElementById('root')).render(
  <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax}>
      <HojasProvider>
        <App />
        <Avisos />
      </HojasProvider>
    </LazyMotion>
  </MotionConfig>
);

// Modo sin conexión: solo cuando se sirve por http(s); con file:// el navegador no lo permite
if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* la app funciona igual */ }); });
}
