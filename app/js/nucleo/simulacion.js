/* =============================================================================
 * simulacion.js  —  SIMULAR los autómatas sobre una cadena de texto
 * =============================================================================
 * "Simular" = darle una cadena al autómata y ver si la ACEPTA o la RECHAZA,
 * leyendo un carácter a la vez y siguiendo las flechas.
 *
 * Contiene tres funciones:
 *   • clase(ch, atomos)   : traduce un carácter real (ej. 'k') a su clase
 *                           del alfabeto (ej. 'l' = minúscula).
 *   • simular(m, txt)     : recorre el AFD. Devuelve si acepta, la RUTA de
 *                           estados visitados y el motivo si rechaza.
 *   • simularAFND(m, txt) : recorre el AFND (varios estados a la vez). Se usa
 *                           para comprobar que AFND y AFD aceptan lo mismo.
 *
 * ¿Cómo se relaciona con el resto?
 *   - El validador (validador.js) usa `simular` para decidir si un correo o
 *     una regla de contraseña se cumple.
 *   - La interfaz (app.js) usa ambas simulaciones en el "Laboratorio de
 *     autómatas" y `clase` para colorear cada carácter.
 *   - El generador (generador.js) recorre el AFD "a la inversa": en vez de
 *     comprobar una cadena, la construye siguiendo flechas.
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  // ---------------------------------------------------------------------------
  // clase: ¿a qué símbolo del alfabeto pertenece este carácter?
  // ---------------------------------------------------------------------------
  // Busca, entre los símbolos (`atomos`) del autómata, el primero cuyo conjunto
  // de caracteres (C.CONJ) contiene a `ch`. Si ninguno lo contiene devuelve
  // `undefined` (el carácter no pertenece al alfabeto de ese autómata).
  //   clase('k', ['L','l','D'])  ->  'l'
  C.clase = (ch, atomos) => atomos.find((a) => C.CONJ[a].includes(ch));

  // ---------------------------------------------------------------------------
  // simular: recorrido del AFD
  // ---------------------------------------------------------------------------
  // Empieza en el estado 0 y, por cada carácter:
  //   1) lo convierte a su clase,
  //   2) busca la flecha d[estado][clase] y se mueve por ella.
  // Rechaza si: el carácter no es del alfabeto, no hay flecha ("estado muerto")
  // o la cadena termina en un estado que no es de aceptación.
  //
  // Devuelve { acepta, ruta, motivo, ... }:
  //   ruta   = lista de estados visitados, p. ej. [0, 1, 2, 5]
  //   pos    = (solo si rechaza a mitad de camino) posición del carácter culpable
  //   estado = (si leyó toda la cadena) estado final alcanzado
  C.simular = function (m, txt) {
    let q = 0; // estado actual (el AFD siempre empieza en 0)
    const ruta = [0];

    for (let i = 0; i < txt.length; i++) {
      const a = C.clase(txt[i], m.atomos);
      if (!a) {
        return { acepta: false, pos: i, motivo: `el símbolo «${txt[i]}» no pertenece al alfabeto`, ruta };
      }
      const siguiente = m.d[q][a];
      if (siguiente === undefined) {
        return { acepta: false, pos: i, motivo: `sin transición desde q${q} con ${a} (estado muerto)`, ruta };
      }
      q = siguiente;
      ruta.push(q);
    }

    // Se leyó toda la cadena: acepta solo si terminó en un estado de aceptación.
    return {
      acepta: m.fin.has(q),
      estado: q,
      ruta,
      motivo: m.fin.has(q) ? '' : `la cadena termina en q${q}, que no es de aceptación (incompleta)`,
    };
  };

  // ---------------------------------------------------------------------------
  // simularAFND: recorrido del AFND (varios caminos a la vez)
  // ---------------------------------------------------------------------------
  // En un AFND no hay un único estado actual sino un CONJUNTO de estados
  // posibles. Se empieza con el cierre ε del inicial y, por cada carácter,
  // se aplica  S = cierre( mover(S, clase) ).
  // Acepta si al final el conjunto contiene el estado de aceptación.
  // (Es exactamente el mismo cálculo que hace el algoritmo de subconjuntos,
  //  pero "en vivo" con la cadena.)
  C.simularAFND = function (m, txt) {
    let S = C.cierre(m.nfa, new Set([m.nfa.inicio]));
    for (const ch of txt) {
      const a = C.clase(ch, m.atomos);
      if (!a) return false;
      S = C.cierre(m.nfa, C.mover(m.nfa, S, a));
      if (!S.size) return false; // ya no hay camino posible
    }
    return S.has(m.nfa.aceptacion);
  };
})(globalThis);
