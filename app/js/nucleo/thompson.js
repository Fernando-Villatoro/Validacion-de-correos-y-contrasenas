/* =============================================================================
 * thompson.js  —  PASO 2: ALGORITMO DE THOMPSON  (árbol  ->  AFND con ε)
 * =============================================================================
 * ¿Qué es?
 *   El algoritmo de Thompson convierte una expresión regular (ya hecha árbol
 *   por parser-regex.js) en un AFND: Autómata Finito NO Determinista con
 *   transiciones ε (épsilon = "moverse sin leer ningún carácter").
 *
 * La idea (¡es como armar con piezas de LEGO!):
 *   Cada nodo del árbol se convierte en un mini-autómata con EXACTAMENTE
 *   un estado de inicio y un estado de aceptación. Luego se pegan las piezas:
 *
 *   • Símbolo  a        s --a--> e
 *
 *   • Concatenación  A·B      [inicio A ... fin A] --ε--> [inicio B ... fin B]
 *       (se une el final de A con el inicio de B mediante una ε)
 *
 *   • Unión  A|B         s --ε--> inicio A ... fin A --ε--> e
 *                        s --ε--> inicio B ... fin B --ε--> e
 *       (un estado nuevo "s" se bifurca hacia A y B; ambos terminan en "e")
 *
 *   • Estrella  A*       s --ε--> inicio A ... fin A --ε--> e
 *                        s --ε--> e          (permite repetir 0 veces)
 *                        fin A --ε--> inicio A   (permite repetir otra vez)
 *
 * Resultado: un objeto  { inicio, aceptacion, n, trans }
 *   inicio     número del estado inicial
 *   aceptacion número del único estado de aceptación
 *   n          cantidad total de estados (numerados 0 .. n-1)
 *   trans      lista de transiciones { from, sym, to }; `sym === null` es ε
 *
 * ¿Cómo se relaciona con el resto?
 *   Recibe el árbol de parser-regex.js y entrega el AFND a afd.js, que lo
 *   transforma en un AFD (autómata determinista) con el algoritmo de subconjuntos.
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  C.thompson = function (arbol) {
    let n = 0; // contador para numerar los estados nuevos (0, 1, 2, ...)
    const trans = []; // lista de todas las transiciones del AFND

    const nuevoEstado = () => n++; // crea un estado y devuelve su número
    const agregar = (from, sym, to) => trans.push({ from, sym, to });

    // `construir(nodo)` devuelve [estadoInicial, estadoFinal] del mini-autómata
    // que representa a `nodo`. Se llama a sí misma para los hijos (recursión).
    const construir = (nodo) => {
      // ----- Símbolo: dos estados unidos por una flecha etiquetada -----------
      if (nodo.t === 'sym') {
        const s = nuevoEstado();
        const e = nuevoEstado();
        agregar(s, nodo.v, e);
        return [s, e];
      }

      // ----- Concatenación: fin de A --ε--> inicio de B ----------------------
      if (nodo.t === 'cat') {
        const [inicioA, finA] = construir(nodo.a);
        const [inicioB, finB] = construir(nodo.b);
        agregar(finA, null, inicioB); // null = transición ε
        return [inicioA, finB];
      }

      // ----- Unión: estado nuevo que se bifurca y otro que reúne -------------
      if (nodo.t === 'alt') {
        const [inicioA, finA] = construir(nodo.a);
        const [inicioB, finB] = construir(nodo.b);
        const s = nuevoEstado();
        const e = nuevoEstado();
        agregar(s, null, inicioA);
        agregar(s, null, inicioB);
        agregar(finA, null, e);
        agregar(finB, null, e);
        return [s, e];
      }

      // ----- Estrella de Kleene (t === 'star') --------------------------------
      const [inicioA, finA] = construir(nodo.a);
      const s = nuevoEstado();
      const e = nuevoEstado();
      agregar(s, null, inicioA); // entrar a A
      agregar(s, null, e); //       saltarse A (cero repeticiones)
      agregar(finA, null, inicioA); // volver a empezar A (repetir)
      agregar(finA, null, e); //    salir
      return [s, e];
    };

    const [inicio, aceptacion] = construir(arbol);
    return { inicio, aceptacion, n, trans };
  };
})(globalThis);
