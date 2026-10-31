# Sistema de Generación y Validador Léxico de Credenciales Seguras — Fase 2 (escritorio)

La aplicación web de la Fase 1 (carpeta `app/`) se ejecuta dentro de Electron sin cambios en sus algoritmos ni en su diseño.
Los autómatas (Thompson, subconjuntos), validadores, generadores y reglas viven en `app/js/` (organizados en `nucleo/`, `credenciales/` e `interfaz/`).
> ¿Estudiando el proyecto? Empieza por `docs/GUIA_DE_ESTUDIO.md`.

## Estructura
| Ruta | Contenido |
|---|---|
| `app/` | Aplicación web: `index.html`, `css/` y `js/` (ver desglose abajo) |
| `app/js/nucleo/` | **Teoría de autómatas**: `configuracion` (alfabeto y ER) → `parser-regex` (ER→árbol) → `thompson` (árbol→AFND) → `afd` (AFND→AFD, subconjuntos) → `simulacion` (recorrer cadenas) → `compilador` (une todo y crea `C.M`) |
| `app/js/credenciales/` | **Uso de los autómatas**: `validador`, `diagnostico`, `seguridad`, `generador` |
| `app/js/interfaz/` | `app.js`: conecta la pantalla con el núcleo |
| `pruebas/` | `pruebas.js`: 98 pruebas automáticas del núcleo |
| `main.js` | Proceso principal de Electron (ventana, seguridad, manejo de errores) |
| `package.json` | Scripts y configuración de electron-builder (NSIS + portable) |
| `build/` | Icono (`icon.ico`, `icon.png`, `icon.svg` de origen) |
| `scripts/verificar.js` | Comprobaciones previas al empaquetado |
| `construir-instalador.bat` | Atajo para Windows: instala, prueba y genera el instalador |
| `docs/` | `GUIA_DE_ESTUDIO.md` (explicación para la exposición), notas de la Fase 1 y resultado de pruebas |

No hay servidor local: la interfaz se carga con `file://` mediante `loadFile`, no se necesita ni se usa red.

## Requisitos
- **Windows 10/11 de 64 bits** (recomendado para compilar el instalador).
- **Node.js 20 LTS o 22 LTS** (incluye npm) e Internet **solo** durante `npm install` (descarga Electron y electron-builder).

## Uso
```bash
npm install          # una sola vez
npm start            # abre la app de escritorio
npm run dev          # igual, con menú y herramientas de desarrollo
npm test             # 98 pruebas del núcleo (node pruebas/pruebas.js)
npm run verificar    # archivos, recursos locales, CSP y configuración segura
npm run dist         # instalador NSIS  -> dist/Instalador-Credenciales-Seguras-1.0.0.exe
npm run dist:portable  # versión portable (opcional) -> dist/Credenciales-Seguras-Portable-1.0.0.exe
```
En Windows basta con hacer doble clic en `construir-instalador.bat`. Resultado en `dist/`.

## Instalar y usar
1. Ejecuta `Instalador-Credenciales-Seguras-1.0.0.exe`.
2. El asistente permite elegir la carpeta, crea accesos directos en el escritorio y en el menú Inicio, y ofrece abrir el programa al terminar.
3. Se desinstala desde *Configuración → Aplicaciones*.
Módulos: Inicio, Validador, Generador y Autómatas (AFND/AFD con simulación y tabla de transiciones). Funciona sin conexión.

## Seguridad aplicada
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, sin preload (no hace falta: la interfaz no usa APIs del sistema),
Content-Security-Policy estricta en `index.html` (solo scripts propios, `connect-src 'none'`), permisos del navegador denegados,
navegación y ventanas nuevas bloqueadas, instancia única, menú oculto y DevTools desactivadas fuera de `npm run dev`.

## Solución de problemas
- **SmartScreen: «Windows protegió su PC»**: el instalador no está firmado. Pulsa *Más información → Ejecutar de todas formas*.
- **`npm install` falla**: revisa la conexión, proxy o antivirus; borra `node_modules` y repite.
- **Error de icono o `rcedit` al compilar**: ejecuta la consola como administrador o activa el modo desarrollador de Windows.
- **El copiado no funciona**: la aplicación usa un método alternativo automáticamente; si falla, aparece «No se pudo copiar».
- **Ventana en blanco**: ejecuta `npm run dev` y revisa la consola; un cuadro de error indica el archivo que falta.

## Limitaciones conocidas
- El instalador no está firmado digitalmente (requiere un certificado de pago); SmartScreen mostrará la advertencia.
- Solo se configuró Windows x64. Compilar desde Linux/macOS requiere Wine y no se recomienda.
- No hay actualización automática.
- Los umbrales del nivel de seguridad son un criterio del proyecto (ver `app/js/credenciales/seguridad.js` y `app/js/nucleo/configuracion.js`).
