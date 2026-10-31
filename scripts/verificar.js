/* =============================================================================
 * verificar.js  —  Comprobaciones ANTES de empaquetar el instalador
 * =============================================================================
 * Se ejecuta con:  npm run verificar   (también lo hace `npm run dist`)
 * Revisa que:
 *   1) existan los archivos esenciales,
 *   2) package.json apunte a main.js,
 *   3) todos los <script>/<link> de index.html sean archivos LOCALES que existen,
 *   4) index.html tenga Content-Security-Policy (política de seguridad),
 *   5) no haya direcciones de Internet (http/https) dentro de app/,
 *   6) main.js use las opciones de seguridad de Electron.
 * Si algo falla termina con código 1 y el empaquetado se detiene.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');

const R = (p) => path.join(__dirname, '..', p); // ruta desde la raíz del proyecto
let mal = 0; //                                       contador de fallos
const ok = (condicion, mensaje) => {
  console.log((condicion ? 'OK    ' : 'FALLA ') + mensaje);
  if (!condicion) mal++;
};

const pkg = JSON.parse(fs.readFileSync(R('package.json'), 'utf8'));

// 1) Archivos esenciales
['main.js', 'app/index.html', 'app/css/styles.css', 'build/icon.ico', 'build/icon.png'].forEach((f) =>
  ok(fs.existsSync(R(f)), 'existe ' + f)
);

// 2) package.json
ok(pkg.main === 'main.js', 'package.json: main = main.js');

// 3) Recursos que index.html carga (src="..." y href="..."): deben ser locales y existir
const html = fs.readFileSync(R('app/index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]);
refs.forEach((r) => ok(!/^[a-z]+:|^\/\//i.test(r) && fs.existsSync(R('app/' + r)), 'recurso local ' + r));

// 4) Política de seguridad de contenido
ok(/Content-Security-Policy/.test(html), 'index.html declara Content-Security-Policy');

// 5) Buscar URLs externas dentro de app/ (recorre carpetas y subcarpetas)
const externas = [];
(function recorrer(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) recorrer(p);
    else if (/\.(html|css|js)$/.test(f.name) && /(^|[^\w])https?:\/\/(?!www\.w3\.org)/.test(fs.readFileSync(p, 'utf8'))) externas.push(p);
  }
})(R('app'));
ok(!externas.length, 'sin URL externas en app/' + (externas.length ? ': ' + externas.join(', ') : ''));

// 6) Opciones de seguridad de Electron en main.js
const main = fs.readFileSync(R('main.js'), 'utf8');
ok(
  /contextIsolation:\s*true/.test(main) && /nodeIntegration:\s*false/.test(main) && /sandbox:\s*true/.test(main),
  'main.js: contextIsolation, sin nodeIntegration, sandbox'
);

process.exit(mal ? 1 : 0);
