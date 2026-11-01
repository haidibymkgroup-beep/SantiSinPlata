import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

// El HTML final usa un <script> clásico (no módulo) para que la app también abra con doble clic (file://).
function htmlClasico() {
  return {
    name: 'html-clasico',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let h = html.replace(/<script type="module" crossorigin src=/g, '<script defer src=').replace(/ crossorigin(?==|>| )/g, '');
        if (ctx.bundle) {
          // La política de seguridad solo se aplica a la versión compilada (el servidor de desarrollo necesita más permisos)
          h = h.replace('<!--CSP-->', '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; manifest-src \'self\'; worker-src \'self\'; base-uri \'none\'; form-action \'none\'">');
        } else h = h.replace('<!--CSP-->', '');
        return h;
      }
    }
  };
}

// Genera sw.js con la lista exacta de archivos compilados y un nombre de caché que cambia en cada versión
function serviceWorker() {
  let out = '';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) { out = join(c.root, c.build.outDir); },
    closeBundle() {
      const archivos = [];
      (function recorrer(dir) {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) recorrer(p);
          else if (f !== 'sw.js' && !f.endsWith('.map')) archivos.push(relative(out, p).split(sep).join('/'));
        }
      })(out);
      archivos.sort();
      const hash = createHash('sha1');
      for (const a of archivos) hash.update(a).update(readFileSync(join(out, a)));
      const version = hash.digest('hex').slice(0, 10);
      const plantilla = readFileSync(join(out, '..', 'react', 'sw.plantilla.js'), 'utf8');
      writeFileSync(join(out, 'sw.js'), plantilla.replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify(['./', ...archivos])));
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), htmlClasico(), serviceWorker()],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    target: ['es2020', 'safari14'],
    assetsInlineLimit: 4096,
    cssCodeSplit: false,   // un solo archivo .css enlazado (la política de seguridad no admite estilos inyectados por script)
    rollupOptions: { output: { format: 'iife' } }
  }
});
