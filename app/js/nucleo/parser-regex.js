/* =============================================================================
 * parser-regex.js  —  PASO 1: de expresión regular (texto) a ÁRBOL SINTÁCTICO
 * =============================================================================
 * ¿Para qué sirve?
 *   Una expresión regular escrita como texto, por ejemplo  "(L|l)·D*",  es solo
 *   una cadena de caracteres. El programa no puede construir un autómata
 *   directamente de un texto: primero necesita ENTENDER su estructura.
 *   El parser lee el texto y lo convierte en un ÁRBOL.
 *
 * Ejemplo:  "(L|l)·D*"   se convierte en este árbol
 *
 *                 cat  (concatenación)
 *                /    \
 *             alt      star  (Kleene *)
 *            /   \       |
 *           L     l      D
 *
 * Tipos de nodo del árbol (campo `t`):
 *   { t:'sym',  v:'L' }        un símbolo básico del alfabeto (hoja del árbol)
 *   { t:'alt',  a, b }         unión:          a | b
 *   { t:'cat',  a, b }         concatenación:  a · b
 *   { t:'star', a }            cerradura de Kleene:  a*
 *
 * ¿Cómo se relaciona con el resto?
 *   Entrada: el texto `er` de configuracion.js (C.DEFS[...].er).
 *   Salida : el árbol, que recibe thompson.js para construir el AFND.
 *
 * Cómo decide el orden de las operaciones (precedencia), de MENOS a MÁS fuerte:
 *   1) unión  |      2) concatenación ·      3) estrella *      4) paréntesis
 * Por eso cada nivel es una función que llama a la del nivel siguiente
 * (técnica llamada "descenso recursivo"):
 *      alternativa()  ->  concatenacion()  ->  estrella()  ->  atomo()
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  C.parsear = function (er, atomos) {
    // --- Paso 0: dividir el texto en "tokens" (piezas) ------------------------
    // Un token es un nombre (L, l, D, S_p, V...) o uno de los signos ( ) | * ·
    //   "(L|l)·D*"  ->  ['(', 'L', '|', 'l', ')', '·', 'D', '*']
    const tokens = er.match(/[A-Za-z_]+|[()|*·]/g);
    let i = 0; // posición del token que estamos leyendo ahora

    // --- Expandir un nombre -----------------------------------------------------
    // Si el nombre es un símbolo básico del autómata  -> hoja { t:'sym' }.
    // Si es una MACRO (C, N, V)  -> se reemplaza por la unión de sus partes,
    //   por ejemplo  C = L|l  se vuelve  alt(L, l)  (expandiendo recursivamente).
    // Si no existe -> error claro.
    const expandir = (nombre) => {
      if (atomos.includes(nombre)) return { t: 'sym', v: nombre };
      if (C.MACROS[nombre]) {
        return C.MACROS[nombre]
          .map(expandir)
          .reduce((a, b) => ({ t: 'alt', a, b }));
      }
      throw new Error('Etiqueta desconocida: ' + nombre);
    };

    // --- Nivel 1: UNIÓN  (a | b | c) ------------------------------------------
    // Lee una concatenación y, mientras haya un '|', lee otra y las une.
    const alternativa = () => {
      let nodo = concatenacion();
      while (tokens[i] === '|') {
        i++; // consumimos el '|'
        nodo = { t: 'alt', a: nodo, b: concatenacion() };
      }
      return nodo;
    };

    // --- Nivel 2: CONCATENACIÓN  (a · b · c) -----------------------------------
    // Lee elementos uno tras otro hasta toparse con '|' o ')' o el final.
    // El signo '·' es opcional (se puede escribir "ab" o "a·b").
    const concatenacion = () => {
      let nodo = estrella();
      while (i < tokens.length && tokens[i] !== '|' && tokens[i] !== ')') {
        if (tokens[i] === '·') i++;
        nodo = { t: 'cat', a: nodo, b: estrella() };
      }
      return nodo;
    };

    // --- Nivel 3: ESTRELLA DE KLEENE  (a*) -------------------------------------
    // Lee un átomo y, por cada '*' que lo siga, lo envuelve en un nodo 'star'.
    const estrella = () => {
      let nodo = atomo();
      while (tokens[i] === '*') {
        i++;
        nodo = { t: 'star', a: nodo };
      }
      return nodo;
    };

    // --- Nivel 4: ÁTOMO ---------------------------------------------------------
    // Es un nombre (símbolo/macro) o una expresión entre paréntesis.
    // Si hay '(' volvemos al nivel 1 para leer lo de adentro (recursión).
    const atomo = () => {
      const token = tokens[i++];
      if (token === '(') {
        const nodo = alternativa();
        i++; // consumimos el ')'
        return nodo;
      }
      return expandir(token);
    };

    // --- Arranque ----------------------------------------------------------------
    const arbol = alternativa();
    // Si sobraron tokens sin leer, la ER estaba mal escrita (ej. paréntesis de más).
    if (i !== tokens.length) throw new Error('ER mal formada');
    return arbol;
  };
})(globalThis);
