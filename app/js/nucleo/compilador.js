/* =============================================================================
 * compilador.js  —  UNE TODOS LOS PASOS:  ER -> árbol -> AFND -> AFD
 * =============================================================================
 * `compilar(definicion)` ejecuta la "cadena de montaje" completa para UNA
 * expresión regular de configuracion.js:
 *
 *   texto de la ER  --parsear-->  árbol  --thompson-->  AFND  --aAFD-->  AFD
 *
 * Devuelve un objeto "modelo" `m` con todo lo necesario:
 *   m.nombre, m.atomos      nombre y alfabeto
 *   m.ast                   árbol sintáctico (paso 1)
 *   m.nfa                   AFND de Thompson  { inicio, aceptacion, n, trans }
 *   m.d, m.fin, m.sub       AFD (tabla de transiciones, finales, subconjuntos)
 *
 * Al final del archivo se compilan TODAS las definiciones (correo y las 5
 * reglas de contraseña) y se guardan en `C.M`:
 *     C.M.correo, C.M.R_long, C.M.R_may, C.M.R_min, C.M.R_dig, C.M.R_sim
 * También se compilan las reglas parciales del correo en `C.MR` (ver
 * `DEFS_CORREO` en configuracion.js).
 * Esto ocurre una sola vez, al abrir la aplicación ("autómatas construidos en
 * vivo"). El validador, el generador y la interfaz usan estos modelos.
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  C.compilar = (def) => {
    const ast = C.parsear(def.er, def.atomos); //  1) texto -> árbol
    const nfa = C.thompson(ast); //                 2) árbol -> AFND (Thompson)
    return { ...C.aAFD(nfa, def.atomos), nfa, ast, nombre: def.nombre }; // 3) AFND -> AFD
  };

  // Compilamos cada definición una vez y guardamos el resultado en C.M
  C.M = {};
  for (const k in C.DEFS) C.M[k] = C.compilar(C.DEFS[k]);

  // Autómatas de las reglas parciales del correo (mismo proceso ER -> AFND -> AFD).
  // Los usa validador.js para el reporte detallado del correo.
  C.MR = {};
  for (const k in C.DEFS_CORREO) C.MR[k] = C.compilar(C.DEFS_CORREO[k]);
})(globalThis);
