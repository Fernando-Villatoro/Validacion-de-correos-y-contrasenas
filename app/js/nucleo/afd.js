/* =============================================================================
 * afd.js  —  PASO 3: ALGORITMO DE SUBCONJUNTOS  (AFND con ε  ->  AFD)
 * =============================================================================
 * ¿Por qué hace falta?
 *   El AFND de Thompson es "no determinista": desde un estado puede haber
 *   varias flechas con el mismo símbolo, y flechas ε. Eso es cómodo para
 *   construirlo, pero incómodo para ejecutarlo. Un AFD (determinista) tiene
 *   EXACTAMENTE una flecha por símbolo desde cada estado, sin ε.
 *
 * La idea del algoritmo de subconjuntos:
 *   Cada estado del AFD representa un CONJUNTO de estados del AFND (en qué
 *   estados del AFND podría estar "a la vez" la máquina). Para cada conjunto y
 *   cada símbolo calculamos a qué conjunto vamos a parar.
 *
 * Dos operaciones auxiliares fundamentales:
 *   • cierre ε (cierre) : todos los estados a los que puedo llegar desde un
 *                         conjunto usando SOLO transiciones ε (gratis).
 *   • mover            : a qué estados llego desde un conjunto leyendo un
 *                         símbolo concreto.
 *   Paso completo con el símbolo a:   cierre( mover(S, a) )
 *
 * ¿Cómo se relaciona con el resto?
 *   Recibe el AFND de thompson.js. El AFD que produce es el que usan
 *   simulacion.js (para recorrer cadenas), el validador y el generador.
 *   Este archivo también incluye `minimizar`, que cuenta cuántos estados
 *   tendría el AFD mínimo (solo se usa para mostrar información y en pruebas).
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  // ---------------------------------------------------------------------------
  // cierre ε: "¿a dónde puedo llegar sin leer nada?"
  // ---------------------------------------------------------------------------
  // Parte del conjunto S y va siguiendo flechas ε hasta que no aparezcan
  // estados nuevos. Usa una "pila" de pendientes (recorrido en profundidad).
  // Devuelve un Set de estados (incluye los de S).
  C.cierre = (nfa, S) => {
    const pendientes = [...S]; // estados cuyas flechas ε aún no revisé
    const resultado = new Set(S); // estados alcanzados hasta ahora
    while (pendientes.length) {
      const q = pendientes.pop();
      for (const t of nfa.trans) {
        // ¿es una flecha ε que sale de q hacia un estado nuevo?
        if (t.from === q && t.sym === null && !resultado.has(t.to)) {
          resultado.add(t.to);
          pendientes.push(t.to);
        }
      }
    }
    return resultado;
  };

  // ---------------------------------------------------------------------------
  // mover: "¿a dónde llego desde S leyendo el símbolo a?"
  // ---------------------------------------------------------------------------
  // Mira solo las flechas etiquetadas exactamente con `a` (no las ε).
  C.mover = (nfa, S, a) => {
    const resultado = new Set();
    for (const t of nfa.trans) {
      if (S.has(t.from) && t.sym === a) resultado.add(t.to);
    }
    return resultado;
  };

  // ---------------------------------------------------------------------------
  // aAFD: el algoritmo de subconjuntos propiamente dicho
  // ---------------------------------------------------------------------------
  // Devuelve un objeto con:
  //   atomos : alfabeto del autómata (lista de clases)
  //   d      : tabla de transiciones. d[q][a] = estado destino (o no existe
  //            si no hay flecha; equivale a un "estado muerto" implícito)
  //   fin    : Set con los estados de aceptación del AFD
  //   sub    : sub[q] = lista de estados del AFND que representa el estado q
  // El estado 0 del AFD es siempre el inicial.
  C.aAFD = function (nfa, atomos) {
    const sub = []; // sub[i]  : conjunto de estados AFND que forma el estado i del AFD
    const d = []; //   d[i]    : transiciones del estado i  (símbolo -> estado destino)
    const indice = new Map(); // "1,4,7" -> número de estado AFD (para no repetir conjuntos)
    const fin = new Set(); //  estados de aceptación del AFD

    // Texto único para identificar un conjunto (números ordenados): {4,1} -> "1,4"
    const clave = (S) => [...S].sort((x, y) => x - y).join(',');

    // Registra un conjunto como estado del AFD (si ya existía, devuelve su número).
    // Un estado del AFD es de aceptación si su conjunto contiene el estado de
    // aceptación del AFND.
    const registrar = (S) => {
      const k = clave(S);
      if (!indice.has(k)) {
        indice.set(k, sub.length);
        sub.push([...S].sort((x, y) => x - y));
        d.push({});
        if (S.has(nfa.aceptacion)) fin.add(sub.length - 1);
      }
      return indice.get(k);
    };

    // Estado inicial del AFD = cierre ε del estado inicial del AFND.
    registrar(C.cierre(nfa, new Set([nfa.inicio])));

    // Cola de trabajo: recorremos los estados del AFD conforme van apareciendo
    // (por eso `sub.length` puede crecer mientras el ciclo avanza).
    for (let i = 0; i < sub.length; i++) {
      for (const a of atomos) {
        // destino = cierre ε de (mover desde el conjunto i con el símbolo a)
        const destino = C.cierre(nfa, C.mover(nfa, new Set(sub[i]), a));
        if (destino.size) d[i][a] = registrar(destino); // si queda vacío, no hay flecha
      }
    }
    return { atomos, d, fin, sub };
  };

  // ---------------------------------------------------------------------------
  // minimizar: ¿cuántos estados tendría el AFD mínimo?
  // ---------------------------------------------------------------------------
  // Método de "refinamiento de particiones": al inicio solo distinguimos
  // estados finales y no finales. Luego separamos los estados que, con algún
  // símbolo, llegan a grupos distintos. Se repite hasta que ya no cambia nada.
  // Devuelve solo la CANTIDAD de grupos (= estados del AFD mínimo).
  C.minimizar = (m) => {
    // grupo[i] = número de grupo del estado i  (1 si es final, 0 si no)
    let grupo = m.d.map((_, i) => (m.fin.has(i) ? 1 : 0));
    for (;;) {
      // "firma" de cada estado: su grupo actual + los grupos a los que va con cada símbolo
      const firma = m.d.map(
        (tr, i) => grupo[i] + '|' + m.atomos.map((a) => (tr[a] === undefined ? -1 : grupo[tr[a]])).join()
      );
      const ids = [...new Set(firma)];
      const nuevo = firma.map((x) => ids.indexOf(x)); // estados con igual firma quedan juntos
      // Si no aparecieron grupos nuevos, ya terminamos.
      if (new Set(nuevo).size === new Set(grupo).size) return new Set(nuevo).size;
      grupo = nuevo;
    }
  };
})(globalThis);
