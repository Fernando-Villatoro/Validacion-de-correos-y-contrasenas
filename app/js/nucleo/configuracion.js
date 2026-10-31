/* =============================================================================
 * configuracion.js  —  PUNTO DE PARTIDA DE TODO EL NÚCLEO
 * =============================================================================
 * ¿Qué hace este archivo?
 *   Define los "ingredientes" del sistema:
 *     1) El ALFABETO: qué caracteres existen y cómo se agrupan en "clases".
 *     2) Las EXPRESIONES REGULARES (ER) que describen un correo válido y cada
 *        regla de contraseña.
 *     3) Parámetros de las contraseñas (longitud mínima/máxima, palabras
 *        prohibidas, umbrales de seguridad).
 *
 * ¿Cómo se relaciona con el resto?
 *   Todo cuelga de un objeto global llamado `Cred` (abreviado `C` en los demás
 *   archivos). Este es el PRIMER archivo que se carga y crea ese objeto; los
 *   demás archivos le van agregando funciones.
 *
 *   configuracion.js  ->  parser-regex.js  ->  thompson.js  ->  afd.js  -> ...
 *   (ER en texto)         (ER -> árbol)        (árbol -> AFND)   (AFND -> AFD)
 *
 * Si quieres cambiar una regla (por ejemplo, la longitud mínima de la
 * contraseña), este es el único lugar que debes tocar: el resto del sistema
 * (autómatas, validador, generador, interfaz) se reconstruye solo.
 * ========================================================================== */
(function (G) {
  // `G` es el objeto global (globalThis). Creamos `Cred` si todavía no existe.
  const C = (G.Cred = G.Cred || {});

  // ---------------------------------------------------------------------------
  // Utilidad: construye un texto con todas las letras/dígitos entre dos extremos.
  //   rango('A','E')  ->  "ABCDE"
  // Se usa para no escribir el abecedario completo a mano.
  // ---------------------------------------------------------------------------
  const rango = (desde, hasta) => {
    let texto = '';
    for (let i = desde.charCodeAt(0); i <= hasta.charCodeAt(0); i++) {
      texto += String.fromCharCode(i);
    }
    return texto;
  };

  // ---------------------------------------------------------------------------
  // 1) EL ALFABETO, AGRUPADO EN CLASES
  // ---------------------------------------------------------------------------
  // En lugar de que el autómata tenga una flecha por cada carácter (A, B, C...),
  // agrupamos los caracteres "equivalentes" en una CLASE y usamos una sola
  // flecha por clase. Así los autómatas quedan pequeños y fáciles de dibujar.
  //
  //   L   = letras MAYÚSCULAS                (A–Z)
  //   l   = letras minúsculas                (a–z)
  //   D   = dígitos                          (0–9)
  //   P   = el punto                         (.)
  //   A   = la arroba                        (@)
  //   G   = el guion                         (-)
  //   S_e = símbolos que se permiten en la parte local del correo  (_ % +)
  //   S_p = símbolos especiales permitidos en la contraseña  (! @ # $ % ^ & * _ - + =)
  //   C_p = TODOS los caracteres permitidos en una contraseña (L + l + D + S_p)
  C.CONJ = {
    L: rango('A', 'Z'),
    l: rango('a', 'z'),
    D: rango('0', '9'),
    P: '.',
    A: '@',
    G: '-',
    S_e: '_%+',
    S_p: '!@#$%^&*_-+=',
  };
  C.CONJ.C_p = C.CONJ.L + C.CONJ.l + C.CONJ.D + C.CONJ.S_p;

  // ---------------------------------------------------------------------------
  // 2) MACROS (abreviaturas dentro de las expresiones regulares)
  // ---------------------------------------------------------------------------
  // Para que las ER no sean larguísimas, definimos atajos:
  //   C = cualquier letra          = L | l
  //   N = letra o dígito           = C | D
  //   V = "carácter válido" en la parte local del correo = N | G | S_e
  // El parser (parser-regex.js) las "expande" automáticamente hasta llegar a
  // los símbolos básicos del alfabeto (los "átomos").
  C.MACROS = {
    C: ['L', 'l'],
    N: ['C', 'D'],
    V: ['N', 'G', 'S_e'],
    // Macros extra, solo para las reglas parciales del correo (DEFS_CORREO):
    //   X = carácter del correo que no es @  (V o punto)
    //   Y = letra, dígito o guion (carácter de una etiqueta del dominio)
    X: ['V', 'P'],
    Y: ['N', 'G'],
  };

  // ---------------------------------------------------------------------------
  // 3) LAS EXPRESIONES REGULARES
  // ---------------------------------------------------------------------------
  // Notación usada en las ER (en texto):
  //   a|b   unión      ("a" O "b")
  //   a·b   concatenación ("a" seguido de "b")
  //   a*    Kleene     ("a" repetido 0 o más veces)
  //   ( )   agrupación
  //
  // `atomos` = lista de símbolos básicos (clases) que el autómata reconocerá.
  // `er`     = la expresión regular propiamente dicha.

  // Regla de contraseña "contiene al menos un X": cualquier cosa, luego X,
  // luego cualquier cosa.   sp* · X · sp*
  const sp = '(L|l|D|S_p)'; // "cualquier carácter permitido" escrito por clases (equivale a C_p)
  const contiene = (x) => `${sp}*·${x}·${sp}*`;

  C.DEFS = {
    // --- CORREO ELECTRÓNICO ---------------------------------------------------
    // parte local @ dominio . TLD
    //   Parte local : V·V*·(P·V·V*)*      -> caracteres válidos, con puntos
    //                                        solo entre caracteres (nunca al
    //                                        inicio, al final ni dos seguidos)
    //   @           : A
    //   Dominio     : etiquetas separadas por punto; cada etiqueta empieza y
    //                 termina en letra/dígito y por dentro admite guiones
    //   TLD         : P·C·C·C*  -> un punto y al menos 2 letras (.com, .gt ...)
    correo: {
      nombre: 'Correo',
      atomos: ['L', 'l', 'D', 'G', 'S_e', 'P', 'A'],
      er: '(V·V*·(P·V·V*)*)·A·((N|N·((N|G)*·N))·(P·(N|N·((N|G)*·N)))*)·P·C·C·C*',
    },

    // --- REGLAS DE CONTRASEÑA (cada una tiene su propio autómata) -------------
    // Longitud mínima 12: se escribe C_p doce veces y luego C_p* (más, si hay).
    R_long: {
      nombre: 'Longitud mínima 12',
      atomos: ['C_p'],
      er: Array(12).fill('C_p').join('·') + '·C_p*',
    },
    R_may: { nombre: 'Al menos una mayúscula', atomos: ['L', 'l', 'D', 'S_p'], er: contiene('L') },
    R_min: { nombre: 'Al menos una minúscula', atomos: ['L', 'l', 'D', 'S_p'], er: contiene('l') },
    R_dig: { nombre: 'Al menos un dígito', atomos: ['L', 'l', 'D', 'S_p'], er: contiene('D') },
    R_sim: { nombre: 'Al menos un símbolo especial', atomos: ['L', 'l', 'D', 'S_p'], er: contiene('S_p') },
  };

  // ---------------------------------------------------------------------------
  // 3.b) REGLAS PARCIALES DEL CORREO (para el reporte detallado)
  // ---------------------------------------------------------------------------
  // La ER completa de arriba (C.DEFS.correo) NO cambia: sigue decidiendo si el
  // correo es válido. Estas ER más pequeñas son los mismos fragmentos de esa ER
  // vistos por separado (parte local, dominio, TLD), cada uno con su propio
  // AFND/AFD. Sirven para decir QUÉ regla falla sin detenerse en la primera.
  // Se compilan en compilador.js y quedan en C.MR (no aparecen en el
  // desplegable de "Autómatas" para no saturar esa pantalla).
  const LOC = ['L', 'l', 'D', 'G', 'S_e', 'P']; // alfabeto de la parte local
  const DOM = ['L', 'l', 'D', 'G', 'P']; //        alfabeto del dominio
  C.DEFS_CORREO = {
    // Exactamente un @ (cualquier cosa, @, cualquier cosa; sin @ en los lados)
    E_arroba: { nombre: 'Un solo @', atomos: [...LOC, 'A'], er: 'X*·A·X*' },
    // Parte local
    E_loc_ini: { nombre: 'Parte local: no empieza con punto', atomos: LOC, er: 'V·(V|P)*' },
    E_loc_fin: { nombre: 'Parte local: no termina con punto', atomos: LOC, er: '(V|P)*·V' },
    E_loc_dos: { nombre: 'Parte local: sin dos puntos seguidos', atomos: LOC, er: '(V|P·V)*|(V|P·V)*·P' },
    E_loc: { nombre: 'Parte local completa', atomos: LOC, er: 'V·V*·(P·V·V*)*' },
    // Dominio (todo lo que va entre el @ y el último punto)
    E_dom_alfa: { nombre: 'Dominio: solo letras, números, guiones y puntos', atomos: DOM, er: '(Y|P)*' },
    E_dom_ini: { nombre: 'Dominio: no empieza con punto', atomos: DOM, er: '(N|G)·(N|G|P)*' },
    E_dom_dos: { nombre: 'Dominio: sin dos puntos seguidos', atomos: DOM, er: '(Y|P·Y)*|(Y|P·Y)*·P' },
    E_et_ini: { nombre: 'Etiqueta del dominio: no empieza con guion', atomos: ['L', 'l', 'D', 'G'], er: 'N·(N|G)*' },
    E_et_fin: { nombre: 'Etiqueta del dominio: no termina con guion', atomos: ['L', 'l', 'D', 'G'], er: '(N|G)*·N' },
    E_dom: { nombre: 'Dominio completo', atomos: DOM, er: '(N|N·((N|G)*·N))·(P·(N|N·((N|G)*·N)))*' },
    // Extensión (TLD)
    E_tld_letras: { nombre: 'Extensión: solo letras', atomos: ['L', 'l'], er: 'C·C*' },
    E_tld: { nombre: 'Extensión: al menos 2 letras', atomos: ['L', 'l'], er: 'C·C·C*' },
  };

  // ---------------------------------------------------------------------------
  // 4) PARÁMETROS DE LA CONTRASEÑA
  // ---------------------------------------------------------------------------
  C.PASS = {
    min: 12, // longitud mínima (la comprueba el autómata R_long)
    max: 64, // longitud máxima (la comprueba el programa, no una ER)
    // Palabras que no pueden aparecer dentro de la contraseña:
    prohibidas: ['password', 'contraseña', 'contrasena', 'admin', 'qwerty', '12345', 'guatemala'],
    // Umbrales para clasificar el nivel "fuerte" (ver seguridad.js):
    seguridad: { fuerteLong: 16, fuerteDistintos: 10 },
  };
})(globalThis);
