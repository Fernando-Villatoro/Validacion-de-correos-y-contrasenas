# Sistema de Generación y Validador Léxico de Credenciales Seguras (Fase 1 – núcleo)
_Nota: los archivos se reorganizaron en `app/js/nucleo`, `app/js/credenciales` y `app/js/interfaz`; las rutas `js/…` de abajo se refieren a esas carpetas._
Ejecutar pruebas: `npm test` (`node pruebas/pruebas.js`) · Interfaz: abrir `app/index.html` (funciona sin servidor ni Internet).

## Estado de las reglas por regla (estado)
Cada regla del reporte es `cumple`, `incumple` o `no_evaluable`. El AFD sigue decidiendo la aceptación;
las reglas `[adicional]` (máx. 64, espacios, 3 iguales, secuencias, lista negra) se comprueban en el programa.

## Alfabeto de la contraseña
Solo se admiten A–Z, a–z, 0–9 y `! @ # $ % ^ & * _ - + =` (S_p, según PARTE_TAMBITO). El punto `.` **no** pertenece a S_p,
por eso `Tu9.guate2026` se rechaza con «Solo contiene caracteres permitidos». Las demás reglas se evalúan solo sobre los
caracteres permitidos (R_long queda «no evaluable»). Si el grupo decide admitir `.`, se cambia únicamente `S_p` en `js/nucleo/configuracion.js`.

## Diagnóstico de correos (`js/credenciales/diagnostico.js`)
Cuando el AFD rechaza un correo, esta capa traduce el rechazo a las reglas de `investigacion.pdf` §2 (punto inicial/final, dos puntos
seguidos, un solo @, guion al inicio/fin de una parte del dominio, TLD de al menos 2 letras, espacios). No decide la aceptación; si no
identifica la causa, el reporte muestra una explicación general. El recorrido de estados queda en «Detalle técnico».

## Reporte detallado del correo (`validarCorreo`)
Como en la contraseña, el correo se evalúa regla por regla y sin detenerse en el primer error (grupos: General, Parte local, Dominio, Extensión, Autómata completo).
Cada regla indica `cumple` (con el motivo), `incumple` (qué falla y cómo corregirlo) o `no_evaluable` (p. ej. sin `@` no se puede separar parte local y dominio; sin punto no se delimita la extensión).
Las reglas parciales usan AFD propios (`C.DEFS_CORREO` → `C.MR`, compilados con ER→AFND→AFD, fragmentos de la ER original que no cambia). Al final se pasa el correo completo por `C.M.correo` (AFD) y se comprueba con el AFND; ambos deciden la validez.
Con varios `@`, la parte local se toma antes del primer `@` y el dominio después del último, y cada regla lo indica. Espacios y caracteres ajenos se reportan y se excluyen para evaluar el resto.

## Nivel de seguridad (baja / media / fuerte) — `js/credenciales/seguridad.js`
El enunciado (7.a.iv) exige el nivel pero **no define umbrales**; los siguientes son un **criterio técnico propio del proyecto**
(orientativo, no una norma ni una auditoría), basado en que NIST SP 800-63B prioriza la longitud (≥15 sin MFA) y CIS recomienda ≥14:
| Nivel | Condición |
|---|---|
| baja | la contraseña no es válida (incumple alguna regla) |
| media | válida, pero con menos de 16 caracteres o menos de 10 distintos |
| fuerte | válida, con ≥16 caracteres y ≥10 caracteres distintos |
Los umbrales están en `C.PASS.seguridad` (`js/nucleo/configuracion.js`). Validez y nivel son independientes: una contraseña válida puede ser «media».
El nivel se muestra en el reporte y junto a cada contraseña generada, con su motivo.

## Interfaz (rediseño visual)
Panel con barra lateral (Inicio, Validador, Generador, Autómatas), fondo blanco, sin dependencias ni recursos externos. Cada carácter se muestra con su clase léxica real (`C.clase`).
El laboratorio dibuja el AFND (Thompson) y el AFD (subconjuntos) reales y resalta el recorrido de la cadena. Las pruebas se ejecutan con `npm test`.
