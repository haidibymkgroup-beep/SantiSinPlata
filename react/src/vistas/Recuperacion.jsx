import { useRef } from 'react';
import { domain, store as storeMod } from '../lib.js';
import { almacen, descargar, resolverCorrupto, toast } from '../estado.js';
import { Fila } from '../ui/Basicos.jsx';

function Contenido({ errores, cerrar }) {
  const archivo = useRef(null);
  const respaldo = almacen.leerRespaldo();
  const resolver = (estado, msg) => { resolverCorrupto(estado, msg); cerrar(); };
  const alElegir = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      const r = storeMod.importarJSON(String(lector.result));
      if (r.ok) resolver(r.estado, 'Respaldo importado'); else toast('Ese archivo no es un respaldo válido.', { error: true });
    };
    lector.readAsText(f);
  };
  return (
    <>
      <p className="dialogo-msg">La información guardada en este navegador está dañada o incompleta. No la borramos: guardamos una copia aparte. Elige cómo seguir.</p>
      {errores && errores.length > 0 && <ul className="errores-lista">{errores.slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <div className="lista tarjeta">
        {respaldo && <Fila icono="⏪" titulo="Restaurar la última copia automática" sub={storeMod.resumenEstado(respaldo).movimientos + ' movimientos'} onClick={() => resolver(respaldo, 'Copia restaurada')} />}
        <Fila icono="📥" titulo="Importar un archivo de respaldo (JSON)" onClick={() => archivo.current.click()} />
        <Fila icono="💾" titulo="Descargar los datos dañados" sub="Por si quieres revisarlos o recuperarlos a mano" onClick={() => descargar('santisinplata-danado.json', 'application/json', almacen.leerCrudo() || '')} />
        <Fila icono="🆕" titulo="Empezar con datos vacíos" sub="La copia dañada se conserva en el navegador" onClick={() => resolver(domain.estadoVacio(), 'Empezamos de cero')} />
      </div>
      <input ref={archivo} type="file" accept=".json,application/json" hidden aria-label="Archivo de respaldo" onChange={alElegir} />
    </>
  );
}

export function abrirRecuperacion(hojas, errores) {
  hojas.abrir({ titulo: 'No pudimos leer tus datos', bloqueante: true, contenido: ({ cerrar }) => <Contenido errores={errores} cerrar={cerrar} /> });
}
