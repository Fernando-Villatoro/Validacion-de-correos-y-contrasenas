/* =============================================================================
 * diagnostico.js  —  EXPLICAR por qué un correo fue rechazado
 * =============================================================================
 * Problema: cuando el AFD rechaza un correo, solo sabe decir "no" (y en qué
 * estado se quedó). Eso no le sirve a un usuario. Este archivo traduce el
 * rechazo a mensajes claros: "falta el @", "dos puntos seguidos", etc.
 *
 * REGLA DE ORO: esta capa NUNCA decide si el correo es válido. Eso lo hace
 * únicamente el AFD. Aquí solo se EXPLICA un rechazo que el AFD ya decidió.
 * Si no se reconoce ninguna causa, validador.js muestra un mensaje general.
 *
 * Salida: una lista de problemas encontrados. Cada uno es
 *   { regla, mensaje, pos, fuente }
 *   (pos = posición del carácter problemático, empezando en 1; o null)
 *
 * El análisis va "de lo grueso a lo fino":
 *   vacío -> caracteres raros -> cantidad de @ -> parte local -> dominio -> TLD
 * (TLD = la extensión final, como "com" en "usuario@mail.com")
 *
 * Relación con el resto: la llama C.validarCorreo (validador.js) solo cuando
 * el AFD rechaza el correo.
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  C.diagnosticarCorreo = function (t) {
    const d = []; // lista de problemas encontrados
    // Atajo para registrar un problema.
    const add = (regla, mensaje, pos, fuente) =>
      d.push({ regla, mensaje, pos: pos || null, fuente: fuente || 'documento' });

    // 1) Correo vacío
    if (!t.length) {
      add('Entrada', 'El correo está vacío.');
      return d;
    }

    // 2) Espacios y caracteres fuera del alfabeto del correo
    const alfa = C.DEFS.correo.atomos.map((a) => C.CONJ[a]).join(''); // todos los caracteres permitidos
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (/\s/.test(c)) {
        add('Sin espacios', `Contiene un espacio en la posición ${i + 1}.`, i + 1);
      } else if (!alfa.includes(c)) {
        add('Alfabeto', `El carácter «${c}» (posición ${i + 1}) no está permitido en un correo.`, i + 1);
      }
    }

    // 3) El símbolo @: debe haber exactamente uno
    const ats = []; // posiciones (desde 0) de cada @
    for (let i = 0; i < t.length; i++) if (t[i] === '@') ats.push(i);
    if (!ats.length) {
      add('Símbolo @', 'Falta el símbolo @ que separa la parte local del dominio.');
      return d;
    }
    if (ats.length > 1) {
      add('Símbolo @', `Hay más de un @ (posiciones ${ats.map((x) => x + 1).join(', ')}); debe haber uno solo.`, ats[1] + 1);
      return d;
    }

    // Con un solo @ partimos el correo en dos:  loc @ dom
    const a = ats[0];
    const loc = t.slice(0, a); //   parte local  (antes del @)
    const dom = t.slice(a + 1); //  dominio      (después del @)
    const off = a + 1; //           cuántos caracteres hay antes del dominio (para dar posiciones reales)

    // 4) Parte local
    if (!loc) {
      add('Parte local', 'No hay parte local antes del @.', 1);
    } else {
      if (loc[0] === '.') add('Parte local', 'La parte local comienza con punto.', 1);
      if (loc.length > 1 && loc.endsWith('.')) add('Parte local', 'La parte local termina con punto.', loc.length);
      const i = loc.indexOf('..');
      if (i >= 0) add('Parte local', `Hay dos puntos seguidos en la parte local (posición ${i + 1}).`, i + 1);
    }

    // 5) Dominio
    if (!dom) {
      add('Dominio', 'Falta el dominio después del @.', a + 2);
      return d;
    }
    // Los símbolos _ % + valen en la parte local, pero NO en el dominio.
    for (let i = 0; i < dom.length; i++) {
      if (C.CONJ.S_e.includes(dom[i])) {
        add('Dominio', `El dominio contiene «${dom[i]}» (posición ${off + i + 1}); solo admite letras, números, guiones y puntos.`, off + i + 1);
      }
    }
    // Sin ningún punto no hay extensión (TLD)
    if (!dom.includes('.')) {
      add('TLD', 'Falta la extensión (TLD): después del dominio debe haber un punto y al menos dos letras, por ejemplo «.com».');
      return d;
    }

    const partes = dom.split('.'); //                 "mail.unis.edu.gt" -> ["mail","unis","edu","gt"]
    const tld = partes[partes.length - 1]; //          la última parte es el TLD
    let o = off; //                                    posición (base 0) donde empieza la parte actual
    if (dom[0] === '.') add('Dominio', 'El dominio comienza con punto.', off + 1);
    const dd = dom.indexOf('..');
    if (dd >= 0) add('Dominio', `Hay dos puntos seguidos en el dominio (posición ${off + dd + 1}).`, off + dd + 1, 'estructura de la ER');

    // Cada etiqueta del dominio (todas menos el TLD) no puede empezar ni terminar en guion.
    partes.slice(0, -1).forEach((p) => {
      if (p.startsWith('-')) add('Dominio', `La parte «${p}» del dominio comienza con guion.`, o + 1);
      if (p.length > 1 && p.endsWith('-')) add('Dominio', `La parte «${p}» del dominio termina con guion.`, o + p.length);
      o += p.length + 1; // avanzamos: longitud de la parte + 1 por el punto
    });

    // 6) TLD: solo letras y mínimo 2
    if (tld === '') {
      add('TLD', 'El dominio termina con punto: falta la extensión (TLD).');
    } else if (tld.length === 1 && /[A-Za-z]/.test(tld)) {
      add('TLD', 'El TLD tiene una sola letra (mínimo 2).', o + 1);
    } else if (!/^[A-Za-z]+$/.test(tld)) {
      add('TLD', `El TLD «${tld}» debe contener solo letras (mínimo 2).`, o + 1);
    }
    return d;
  };
})(globalThis);
