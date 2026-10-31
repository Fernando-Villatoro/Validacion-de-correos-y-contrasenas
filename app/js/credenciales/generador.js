/* =============================================================================
 * generador.js  —  GENERAR credenciales recorriendo los AFD
 * =============================================================================
 * Idea clave: un autómata no solo sirve para COMPROBAR una cadena; también
 * sirve para FABRICARLA. En vez de leer caracteres, "caminamos" por el AFD:
 *
 *    1) Estamos en el estado inicial (q0).
 *    2) Elegimos al azar una flecha que salga del estado actual.
 *    3) Escribimos un carácter al azar de la clase de esa flecha.
 *    4) Pasamos al estado destino y repetimos.
 *    5) Podemos parar cuando estemos en un estado de ACEPTACIÓN.
 *
 * Como cada paso sigue una flecha real del AFD, el texto resultante respeta
 * la estructura de la expresión regular. Aun así, TODO lo generado se
 * REVALIDA con el validador antes de entregarse (si falla, se reintenta).
 *
 * Funciones:
 *   C.genCorreo(r)        -> un correo aleatorio válido
 *   C.genPassword(r)      -> una contraseña aleatoria válida
 *   C.genPasswordInfo(r)  -> contraseña + su nivel de seguridad
 *   C.genPar(r)           -> { correo, password, seguridad }
 *
 * `r` es la función que da números al azar entre 0 y 1 (por defecto
 * Math.random). Se puede pasar otra "con semilla" para que las pruebas sean
 * repetibles.
 *
 * Relación con el resto: usa los modelos C.M (compilador.js), el alfabeto
 * C.CONJ (configuracion.js) y revalida con validador.js.
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  // Elige un elemento al azar de una lista o de un texto.
  const elegir = (secuencia, r) => secuencia[Math.floor(r() * secuencia.length)];
  // Máximo de intentos antes de rendirse (evita ciclos infinitos).
  const MAX_INTENTOS = 500;

  // ---------------------------------------------------------------------------
  // genCorreo: recorrido aleatorio del AFD del correo
  // ---------------------------------------------------------------------------
  C.genCorreo = function (r = Math.random) {
    const m = C.M.correo;

    // (a) Distancia de cada estado hasta un estado de aceptación.
    //     Sirve para no meterse en caminos sin salida y para saber cuál flecha
    //     "acerca" más al final cuando el correo ya está largo.
    //     Se calcula repitiendo: dist[q] = 1 + menor dist de sus destinos.
    const dist = m.d.map(() => Infinity);
    m.fin.forEach((f) => (dist[f] = 0)); // los finales están a distancia 0
    for (let cambio = true; cambio; ) {
      cambio = false;
      m.d.forEach((tr, q) => {
        for (const a in tr) {
          if (dist[tr[a]] + 1 < dist[q]) {
            dist[q] = dist[tr[a]] + 1;
            cambio = true;
          }
        }
      });
    }

    // (b) Pesos: qué tan probable es cada clase (más minúsculas y dígitos,
    //     para que los correos se vean "naturales").
    const PESO = { l: 6, D: 2, L: 1, G: 1, S_e: 1, P: 1, A: 1 };

    // (c) Intentamos hasta lograr un correo que el validador acepte.
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      let q = 0; //   estado actual del AFD
      let s = ''; //  correo que vamos escribiendo

      for (let paso = 0; paso < 60; paso++) {
        // Si ya estamos en un estado de aceptación y el correo tiene al menos
        // 6 caracteres, con 20% de probabilidad terminamos aquí.
        if (m.fin.has(q) && s.length >= 6 && r() < 0.2) break;

        // Flechas posibles desde q que todavía permiten llegar a un final.
        const opciones = Object.keys(m.d[q]).filter((a) => isFinite(dist[m.d[q][a]]));

        // Si el correo ya es largo (≥ 24), tomamos la flecha que más acerca
        // al final; si no, elegimos al azar respetando los pesos.
        const a =
          s.length >= 24
            ? opciones.reduce((x, y) => (dist[m.d[q][x]] <= dist[m.d[q][y]] ? x : y))
            : elegir(opciones.flatMap((x) => Array(PESO[x]).fill(x)), r);

        s += elegir(C.CONJ[a], r); // un carácter cualquiera de esa clase
        q = m.d[q][a]; //             seguimos la flecha
      }

      // Revalidación: solo entregamos correos aceptados por el validador.
      if (C.validarCorreo(s).valido) return s;
    }
    throw new Error('No se pudo generar correo');
  };

  // ---------------------------------------------------------------------------
  // genPassword: recorrido aleatorio guiado por los 5 AFD de reglas
  // ---------------------------------------------------------------------------
  // Aquí caminamos por los cinco autómatas AL MISMO TIEMPO (uno por regla).
  // `st[i]` es el estado actual del autómata i. En cada paso:
  //   • miramos qué reglas aún NO están cumplidas (su estado no es final),
  //   • si alguna falta, damos prioridad a una clase que la satisfaga
  //     (mayúscula, minúscula, dígito o símbolo),
  //   • escribimos el carácter y avanzamos los 5 autómatas.
  C.genPassword = function (r = Math.random) {
    const ks = ['R_long', 'R_may', 'R_min', 'R_dig', 'R_sim']; // orden de los autómatas en `st`
    const clases = ['L', 'l', 'D', 'S_p']; //                       clases con las que se escribe

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const objetivo = 12 + Math.floor(r() * 8); // longitud deseada: entre 12 y 19
      let s = '';
      let st = [0, 0, 0, 0, 0]; // los 5 autómatas empiezan en su estado inicial

      while (s.length < objetivo) {
        // Clases que todavía se necesitan (reglas no cumplidas).
        const faltan = [['R_may', 'L'], ['R_min', 'l'], ['R_dig', 'D'], ['R_sim', 'S_p']]
          .filter(([k]) => !C.M[k].fin.has(st[ks.indexOf(k)]))
          .map((x) => x[1]);

        // Si faltan clases y ya casi no queda espacio (o con 50% de suerte),
        // escribimos una de las que faltan; si no, una clase cualquiera.
        const a =
          faltan.length && (faltan.length >= objetivo - s.length || r() < 0.5)
            ? elegir(faltan, r)
            : elegir(clases, r);

        const c = elegir(C.CONJ[a], r); // carácter concreto
        const n = s.length;

        // Evitamos 3 caracteres iguales seguidos (regla adicional).
        if (n >= 2 && s[n - 1] === c && s[n - 2] === c) continue;

        // Avanzamos cada autómata: R_long lee la clase C_p; los demás leen `a`.
        st = st.map((q, i) => C.M[ks[i]].d[q][i === 0 ? 'C_p' : a]);
        s += c;
      }

      // Revalidación final con el validador completo.
      if (C.validarPassword(s).valido) return s;
    }
    throw new Error('No se pudo generar contraseña');
  };

  // Contraseña + su nivel de seguridad.
  C.genPasswordInfo = (r) => {
    const p = C.genPassword(r);
    return { password: p, seguridad: C.validarPassword(p).seguridad };
  };

  // Un par completo: correo + contraseña (+ nivel).
  C.genPar = (r) => ({ correo: C.genCorreo(r), ...C.genPasswordInfo(r) });
})(globalThis);
