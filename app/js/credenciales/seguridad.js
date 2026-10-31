/* =============================================================================
 * seguridad.js  —  NIVEL DE SEGURIDAD de una contraseña (baja | media | fuerte)
 * =============================================================================
 * Importante: el nivel NO decide si la contraseña es válida. La validez la
 * decide el validador con los autómatas y las reglas. El nivel solo es una
 * etiqueta orientativa que se calcula DESPUÉS:
 *
 *   baja   -> la contraseña no es válida (incumple alguna regla).
 *   media  -> es válida, pero corta (< 16 caracteres) o con poca variedad
 *             (< 10 caracteres distintos).
 *   fuerte -> es válida, con al menos 16 caracteres y 10 caracteres distintos.
 *
 * Los números (16 y 10) están en C.PASS.seguridad (configuracion.js). Son un
 * criterio propio del proyecto, apoyado en que las guías (NIST SP 800-63B,
 * CIS) dan prioridad a la LONGITUD de la contraseña.
 *
 * Relación con el resto: la llama validador.js (al validar una contraseña) y,
 * a través de él, el generador y la interfaz que muestran las "barritas".
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  // Parámetros:
  //   p      = la contraseña
  //   valida = ¿pasó todas las reglas? (true/false)
  //   fallos = nombres de las reglas incumplidas (para explicar el nivel "baja")
  C.nivel = function (p, valida, fallos = []) {
    const S = C.PASS.seguridad;
    const n = p.length; //          cantidad de caracteres
    const u = new Set(p).size; //   cantidad de caracteres DISTINTOS

    // Caso 1: inválida -> baja
    if (!valida) {
      return {
        nivel: 'baja',
        valida: false,
        motivo: 'No es válida' + (fallos.length ? ': incumple ' + fallos.join('; ') : '') + '.',
      };
    }

    // Caso 2: válida, larga y variada -> fuerte
    if (n >= S.fuerteLong && u >= S.fuerteDistintos) {
      return {
        nivel: 'fuerte',
        valida: true,
        motivo: `Válida, con ${n} caracteres (≥${S.fuerteLong}) y ${u} distintos (≥${S.fuerteDistintos}).`,
      };
    }

    // Caso 3: válida pero no fuerte -> media, explicando qué le falta
    const falta = [];
    if (n < S.fuerteLong) falta.push(`${S.fuerteLong} caracteres o más (tiene ${n})`);
    if (u < S.fuerteDistintos) falta.push(`${S.fuerteDistintos} distintos o más (tiene ${u})`);
    return {
      nivel: 'media',
      valida: true,
      motivo: `Válida, pero no fuerte: necesitaría ${falta.join(' y ')}.`,
    };
  };
})(globalThis);
