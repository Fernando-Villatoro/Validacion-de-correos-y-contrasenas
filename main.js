'use strict';
// =============================================================================
// main.js — PROCESO PRINCIPAL DE ELECTRON
// =============================================================================
// Electron convierte una página web en un programa de escritorio. Este archivo
// es lo primero que se ejecuta: crea la ventana y le dice que cargue
// app/index.html. NO contiene lógica de autómatas; esa vive en app/js/.
//   (Se ejecuta con `npm start`; con `npm run dev` se activan menú y DevTools.)
// =============================================================================
const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV = process.argv.includes('--dev'); // modo desarrollo: `npm run dev`
const INDEX = path.join(__dirname, 'app', 'index.html');
const ICON = path.join(__dirname, 'build', 'icon.png');
const TITULO = 'Sistema de Generación y Validador Léxico de Credenciales Seguras';
let ventana = null;

// Muestra un error en consola y en un cuadro de diálogo.
function fallo(titulo, detalle) {
  console.error(titulo + ': ' + detalle);
  dialog.showErrorBox(titulo, String(detalle)); // válido incluso antes de 'ready'
}

// Instancia única: si el programa ya está abierto, no se abre una segunda ventana.
if (!app.requestSingleInstanceLock()) {
  app.quit(); // ya hay una ventana abierta
} else {
  app.on('second-instance', () => {
    if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); }
  });

  app.whenReady().then(crearVentana).catch(e => { fallo('No se pudo iniciar la aplicación', e && e.stack || e); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) crearVentana(); });
}

// Crea la ventana principal con opciones de seguridad (sin acceso a Node desde la página).
function crearVentana() {
  if (!fs.existsSync(INDEX)) {
    fallo('Archivos incompletos', 'No se encontró la interfaz en:\n' + INDEX + '\nReinstala la aplicación.');
    return app.exit(1);
  }
  // Sin permisos especiales para la interfaz (cámara, notificaciones, etc.).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  if (!DEV) Menu.setApplicationMenu(null);

  ventana = new BrowserWindow({
    width: 1360, height: 860, minWidth: 820, minHeight: 600,
    title: TITULO, backgroundColor: '#ffffff', show: false,
    icon: fs.existsSync(ICON) ? ICON : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: DEV,
      spellcheck: false
    }
  });

  const wc = ventana.webContents;
  // La interfaz no necesita navegar ni abrir ventanas: se bloquea cualquier intento.
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', e => e.preventDefault());
  wc.on('did-fail-load', (_e, code, desc, url) => fallo('Error al cargar la interfaz', `${desc} (${code})\n${url}`));
  wc.on('render-process-gone', (_e, d) => fallo('La interfaz se cerró inesperadamente', d.reason));
  if (DEV) wc.on('console-message', (_e, lvl, msg, line, src) => { if (lvl >= 2) console.error(`[renderer] ${msg} (${src}:${line})`); });

  ventana.once('ready-to-show', () => ventana.show());
  ventana.on('page-title-updated', e => e.preventDefault()); // conserva el título del proyecto
  ventana.on('closed', () => { ventana = null; });
  ventana.loadFile(INDEX).catch(e => fallo('Error al abrir la interfaz', e && e.message || e));
}
