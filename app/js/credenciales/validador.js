/* =============================================================================
 * validador.js  —  VALIDAR correos y contraseñas usando los AFD
 * =============================================================================
 * Aquí se usan los autómatas ya construidos (C.M) para decidir si una
 * credencial es válida, y se arma un REPORTE regla por regla.
 *
 * Cada regla del reporte tiene la forma:
 *   { regla, tipo, ok, estado, detalle }
 *     regla   : nombre legible de la regla
 *     tipo    : 'autómata'  -> la decide un AFD (simulación del autómata)
 *               'adicional' -> regla que NO se puede expresar con la ER y se
 *                              comprueba con código normal (ej. "máximo 64")
 *     estado  : 'cumple' | 'incumple' | 'no_evaluable'
 *     detalle : texto que explica el fallo (vacío si cumple)
 *
 * Funciones públicas:
 *   C.validarCorreo(texto)     -> reporte del correo
 *   C.validarPassword(texto)   -> reporte de la contraseña (con nivel de seguridad)
 *   C.validarPar(correo, pass) -> ambos a la vez
 *
 * Relación con el resto:
 *   usa  simulacion.js (C.simular) + los modelos de compilador.js (C.M),
 *        diagnostico.js (explicar rechazos de correo) y seguridad.js (nivel).
 *   lo usan generador.js (para revalidar lo que genera) y la interfaz (app.js).
 * ========================================================================== */
(function (G) {
  const C = G.Cred;

  // ---------------------------------------------------------------------------
  // Detector de SECUENCIAS OBVIAS como "abc", "cba", "123", "987".
  // Busca tres letras/dígitos seguidos cuyo código aumenta (o disminuye) de
  // uno en uno. Devuelve la posición (desde 0) donde empieza, o -1 si no hay.
  // (Es una regla "adicional": no se expresa bien con una ER.)
  // ---------------------------------------------------------------------------
  const secuencia = (t) => {
    const esAlfanum = (c) => /[a-z0-9]/i.test(c);
    for (let i = 0; i + 2 < t.length; i++) {
      // código de cada uno de los 3 caracteres consecutivos (en minúscula)
      const x = t[i].toLowerCase().charCodeAt(0);
      const y = t[i + 1].toLowerCase().charCodeAt(0);
      const z = t[i + 2].toLowerCase().charCodeAt(0);
      if (
        esAlfanum(t[i]) && esAlfanum(t[i + 1]) && esAlfanum(t[i + 2]) &&
        y - x === z - y && //            misma diferencia entre los pasos
        Math.abs(y - x) === 1 //         y esa diferencia es +1 o -1
      ) {
        return i;
      }
    }
    return -1;
  };

  // Crea una regla del reporte: si `ok` es true "cumple", si no "incumple".
  const R = (regla, tipo, ok, detalle) => ({
    regla,
    tipo,
    ok,
    estado: ok ? 'cumple' : 'incumple',
    detalle: ok ? '' : detalle,
  });

  // Nombre legible de un carácter (para no mostrar un espacio "invisible").
  const nombreCar = (c) => (/\s/.test(c) ? 'espacio' : c);

  // ---------------------------------------------------------------------------
  // validarCorreo
  // ---------------------------------------------------------------------------
  // Igual que la contraseña, el correo se evalúa REGLA POR REGLA y sin detenerse
  // en el primer error. Cada regla se decide con un AFD (los de C.MR, que salen
  // de fragmentos de la misma ER del correo) o, si no se puede expresar con la
  // ER, con una comprobación normal (tipo 'adicional'). Al final se pasa el
  // correo COMPLETO por el AFD original (C.M.correo): ese AFD (y su AFND, que se
  // simula aparte) es la decisión final; las reglas explican el porqué.
  //
  // Pasos:
  //   1) reglas generales: no vacío, sin espacios, alfabeto, un solo @.
  //   2) se parte el correo en  parte local @ dominio . extensión.
  //      Con un solo @ el corte es exacto. Con varios se toma, como referencia,
  //      lo anterior al primer @ (parte local) y lo posterior al último @
  //      (dominio) y así se avisa en cada regla. Sin @ esas reglas son
  //      'no_evaluable' (no hay dónde cortar).
  //   3) a cada trozo se le quitan los caracteres que su AFD no conoce (ya se
  //      reportan en las reglas generales) y se pasa por sus AFD.
  //   4) regla final: el AFD completo del correo.
  //
  // Cada regla: { grupo, regla, tipo, ok, estado, detalle, motivo, corregir }
  //   detalle  = qué está mal (si incumple)   motivo   = por qué cumple
  //   corregir = cómo arreglarlo (si incumple)
  C.validarCorreo = function (t) {
    const reglas = [];
    const rutas = {}; //  recorrido de estados de cada AFD usado (detalle técnico)
    const G = { g: 'General', l: 'Parte local', d: 'Dominio', e: 'Extensión (TLD)', a: 'Autómata completo' };

    // Atajos para crear reglas.
    const si = (grupo, regla, tipo, ok, motivo, detalle, corregir) =>
      reglas.push({ grupo, regla, tipo, ok, estado: ok ? 'cumple' : 'incumple', detalle: ok ? '' : detalle, motivo: ok ? motivo : '', corregir: ok ? '' : corregir });
    const no = (grupo, regla, tipo, porque) =>
      reglas.push({ grupo, regla, tipo, ok: false, estado: 'no_evaluable', detalle: 'no evaluable: ' + porque, motivo: '', corregir: '' });
    // Corre el AFD C.MR[k] sobre txt y guarda su recorrido.
    const corre = (k, txt, et) => {
      const r = C.simular(C.MR[k], txt);
      rutas[et ? `${k} «${et}»` : k] = r.ruta;
      return r;
    };
    const lista = (a) => a.join(', ');
    const letras = (n) => `${n} letra${n === 1 ? '' : 's'}`;
    // Deja solo los caracteres que pertenecen a alguno de los símbolos `atomos`.
    const filtra = (txt, atomos) => [...txt].filter((c) => C.clase(c, atomos)).join('');

    // ---- 1) Reglas generales ----------------------------------------------
    si(G.g, 'El correo no está vacío', 'adicional', t.length > 0, `tiene ${t.length} ${t.length === 1 ? 'carácter' : 'caracteres'}`,
      'El correo está vacío.', 'Escribe una dirección con la forma usuario@dominio.com.');

    const rAFD = C.simular(C.M.correo, t); //  ← recorrido del AFD completo del correo
    const rAFND = C.simularAFND(C.M.correo, t); // ← y del AFND (deben coincidir)

    if (t.length) {
      const espacios = [];
      const raros = []; //   caracteres fuera del alfabeto del correo (sin contar espacios)
      for (let i = 0; i < t.length; i++) {
        if (/\s/.test(t[i])) espacios.push(i + 1);
        else if (!C.clase(t[i], C.DEFS.correo.atomos)) raros.push({ c: t[i], pos: i + 1 });
      }
      si(G.g, 'Sin espacios', 'adicional', !espacios.length, 'no hay ningún espacio',
        `Contiene ${espacios.length === 1 ? 'un espacio en la posición' : 'espacios en las posiciones'} ${lista(espacios)} (los espacios no se recortan: se rechazan).`,
        'Borra los espacios; una dirección de correo no puede llevarlos.');
      si(G.g, 'Solo contiene caracteres permitidos', 'autómata', !raros.length,
        'todos los caracteres pertenecen al alfabeto del correo (letras, números y . - _ % + @)',
        `El carácter ${raros.map((x) => `«${x.c}» (posición ${x.pos})`).join(', ')} no está permitido en un correo.`,
        'Sustitúyelo o bórralo. Se admiten letras (sin tildes ni ñ), números y los símbolos . - _ % + @.');
    } else {
      no(G.g, 'Sin espacios', 'adicional', 'el correo está vacío');
      no(G.g, 'Solo contiene caracteres permitidos', 'autómata', 'el correo está vacío');
    }

    // Texto sin espacios ni caracteres ajenos, para que los AFD puedan leerlo.
    const permitidos = C.DEFS.correo.atomos;
    const arrobas = []; // posiciones (desde 0) de cada @
    for (let i = 0; i < t.length; i++) if (t[i] === '@') arrobas.push(i);
    const multi = arrobas.length > 1;

    if (t.length) {
      const rA = corre('E_arroba', filtra(t, permitidos)); //  AFD "un solo @"
      const medio = multi ? t.slice(arrobas[0] + 1, arrobas[arrobas.length - 1]) : '';
      si(G.g, 'Tiene exactamente un @', 'autómata', rA.acepta, `hay un solo @ (posición ${arrobas[0] + 1})`,
        arrobas.length === 0
          ? 'Falta el símbolo @ que separa la parte local del dominio.'
          : `Hay más de un @ (${arrobas.length} en total, posiciones ${lista(arrobas.map((x) => x + 1))}); debe haber uno solo.` +
            (medio ? ` El texto «${medio}» queda entre dos @ y no pertenece a la parte local ni al dominio.` : ''),
        arrobas.length === 0 ? 'Agrega un @ entre el nombre de usuario y el dominio, por ejemplo usuario@dominio.com.'
          : 'Deja un solo @: elimina los demás (el @ no puede ir dentro de la parte local ni del dominio).');
    } else {
      no(G.g, 'Tiene exactamente un @', 'autómata', 'el correo está vacío');
    }

    // ---- 2) Partir el correo ----------------------------------------------
    const hay = arrobas.length > 0;
    const loc = hay ? t.slice(0, arrobas[0]) : '';
    const host = hay ? t.slice(arrobas[arrobas.length - 1] + 1) : ''; // todo lo que sigue al (último) @
    const hOff = hay ? arrobas[arrobas.length - 1] + 1 : 0; //           posiciones antes del host
    const refL = multi ? ' (referencia: texto antes del primer @)' : '';
    const refD = multi ? ' (referencia: texto después del último @)' : '';
    const sinArroba = t.length ? 'no hay @, así que no se puede separar la parte local del dominio' : 'el correo está vacío';

    // ---- 3) Parte local ----------------------------------------------------
    const locF = filtra(loc, C.DEFS_CORREO.E_loc.atomos);
    if (!hay) {
      no(G.l, 'Parte local presente', 'adicional', sinArroba);
      ['No empieza con punto', 'No termina con punto', 'Sin dos puntos seguidos', 'Parte local bien formada (AFD)']
        .forEach((n) => no(G.l, n, 'autómata', sinArroba));
    } else {
      si(G.l, 'Parte local presente', 'adicional', loc.length > 0, `hay ${loc.length} ${loc.length === 1 ? 'carácter' : 'caracteres'} antes del @${refL}`,
        'No hay parte local antes del @.', 'Escribe un nombre de usuario antes del @, por ejemplo juan.perez@dominio.com.');
      const vacia = !loc.length ? 'no hay parte local' : !locF.length ? 'la parte local no tiene caracteres válidos que evaluar' : '';
      if (vacia) {
        ['No empieza con punto', 'No termina con punto', 'Sin dos puntos seguidos', 'Parte local bien formada (AFD)'].forEach((n) => no(G.l, n, 'autómata', vacia));
      } else {
        const filtrada = locF.length !== loc.length ? ' (se evaluaron solo los caracteres permitidos, sin espacios)' : '';
        const dos = loc.indexOf('..');
        const r1 = corre('E_loc_ini', locF);
        const r2 = corre('E_loc_fin', locF);
        const r3 = corre('E_loc_dos', locF);
        const r4 = corre('E_loc', locF);
        si(G.l, 'No empieza con punto', 'autómata', r1.acepta, `empieza con «${locF[0]}»${refL}${filtrada}`,
          'La parte local comienza con punto (posición 1).' + refL + filtrada, 'Quita el punto inicial: los puntos solo pueden ir entre caracteres.');
        si(G.l, 'No termina con punto', 'autómata', r2.acepta, `termina con «${locF[locF.length - 1]}»${refL}${filtrada}`,
          `La parte local termina con punto (posición ${loc.length}).` + refL + filtrada, 'Quita el punto final antes del @.');
        si(G.l, 'Sin dos puntos seguidos', 'autómata', r3.acepta, `cada punto va seguido de un carácter válido${refL}${filtrada}`,
          `Hay dos puntos seguidos en la parte local${dos >= 0 ? ` (posición ${dos + 1})` : ''}.` + refL + filtrada, 'Deja un solo punto o escribe un carácter entre ellos.');
        si(G.l, 'Parte local bien formada (AFD)', 'autómata', r4.acepta,
          `«${loc}» tiene caracteres válidos y los puntos solo van entre ellos${refL}${filtrada}`,
          `El AFD de la parte local rechazó «${loc}»: revisa las reglas anteriores y el detalle técnico.` + refL + filtrada,
          'Corrige las reglas de la parte local marcadas arriba.');
      }
    }

    // ---- 4) Dominio y extensión ---------------------------------------------
    // El último punto separa el dominio (antes) de la extensión (después).
    const nombres = ['Dominio presente', 'Solo letras, números, guiones y puntos', 'No empieza con punto', 'Sin dos puntos seguidos',
      'Las partes no empiezan con guion', 'Las partes no terminan con guion', 'Dominio bien formado (AFD)'];
    const nomExt = ['Punto antes de la extensión', 'Extensión presente', 'Extensión con solo letras', 'Extensión de al menos 2 letras'];
    const tipos = ['adicional', 'autómata', 'autómata', 'autómata', 'autómata', 'autómata', 'autómata'];
    if (!hay) {
      nombres.forEach((n, i) => no(G.d, n, tipos[i], sinArroba));
      nomExt.forEach((n, i) => no(G.e, n, i < 2 ? 'adicional' : 'autómata', sinArroba));
    } else {
      const punto = host.lastIndexOf('.');
      const dp = punto >= 0 ? host.slice(0, punto) : host; //  dominio (sin la extensión)
      const tld = punto >= 0 ? host.slice(punto + 1) : ''; //   extensión
      const dF = filtra(dp, C.DEFS_CORREO.E_dom.atomos); //     dominio que los AFD pueden leer
      const hF = filtra(host, C.DEFS_CORREO.E_dom.atomos);
      const dpPos = (i) => hOff + i + 1; //                     posición real (desde 1) de dp[i]

      // Dominio presente
      si(G.d, 'Dominio presente', 'adicional', dp.length > 0, `hay un dominio («${dp}»)${refD}`,
        host.length ? 'Falta el dominio entre el @ y el punto de la extensión.' : 'Falta el dominio después del @.',
        'Escribe el nombre del dominio justo después del @, por ejemplo gmail en usuario@gmail.com.');
      const sinDom = !dp.length ? 'no hay dominio' : !dF.length ? 'el dominio no tiene caracteres válidos que evaluar' : '';
      if (sinDom) {
        nombres.slice(1).forEach((n, i) => no(G.d, n, 'autómata', sinDom));
      } else {
        const filtrada = dF.length !== dp.length ? ' (se evaluaron solo los caracteres permitidos, sin espacios)' : '';
        // Símbolos _ % + : valen en la parte local pero no en el dominio.
        const ajenos = [];
        for (let i = 0; i < dp.length; i++) if (C.CONJ.S_e.includes(dp[i])) ajenos.push(`«${dp[i]}» (posición ${dpPos(i)})`);
        const rAl = corre('E_dom_alfa', filtra(dp, permitidos)); //  el AFD del dominio rechaza _ % + (no están en su alfabeto)
        si(G.d, 'Solo letras, números, guiones y puntos', 'autómata', !ajenos.length && rAl.acepta, `no hay símbolos ajenos${refD}`,
          `El dominio contiene ${lista(ajenos)}; solo admite letras, números, guiones y puntos.` + refD,
          'Quita o reemplaza esos símbolos: _ % + solo se permiten antes del @.');
        const r1 = corre('E_dom_ini', dF);
        si(G.d, 'No empieza con punto', 'autómata', r1.acepta, `empieza con «${dF[0]}»${refD}${filtrada}`,
          `El dominio comienza con punto (posición ${dpPos(0)}).` + refD + filtrada, 'Quita el punto que va justo después del @.');
        const hD = host.indexOf('..');
        const r2 = corre('E_dom_dos', hF);
        si(G.d, 'Sin dos puntos seguidos', 'autómata', r2.acepta, `los puntos están separados por letras o números${refD}${filtrada}`,
          `Hay dos puntos seguidos en el dominio${hD >= 0 ? ` (posición ${hOff + hD + 1})` : ''}.` + refD + filtrada, 'Deja un solo punto o escribe una parte del dominio entre ellos.');
        // Cada parte del dominio (separada por puntos) no puede empezar/terminar en guion.
        let o = 0;
        const malIni = [];
        const malFin = [];
        const partes = [];
        dp.split('.').forEach((p) => {
          const pf = filtra(p, C.DEFS_CORREO.E_et_ini.atomos);
          if (pf.length) {
            partes.push(pf);
            if (!corre('E_et_ini', pf, pf).acepta) malIni.push(`«${p}» (posición ${dpPos(o)})`);
            if (!corre('E_et_fin', pf, pf).acepta) malFin.push(`«${p}» (posición ${dpPos(o + p.length - 1)})`);
          }
          o += p.length + 1;
        });
        if (!partes.length) {
          no(G.d, 'Las partes no empiezan con guion', 'autómata', 'el dominio no tiene partes que evaluar');
          no(G.d, 'Las partes no terminan con guion', 'autómata', 'el dominio no tiene partes que evaluar');
        } else {
          si(G.d, 'Las partes no empiezan con guion', 'autómata', !malIni.length, `ninguna parte («${partes.join('», «')}») empieza con guion${refD}`,
            `La parte ${lista(malIni)} del dominio comienza con guion.` + refD, 'Quita el guion inicial: los guiones solo pueden ir en medio de una parte.');
          si(G.d, 'Las partes no terminan con guion', 'autómata', !malFin.length, `ninguna parte («${partes.join('», «')}») termina con guion${refD}`,
            `La parte ${lista(malFin)} del dominio termina con guion.` + refD, 'Quita el guion final: los guiones solo pueden ir en medio de una parte.');
        }
        const r3 = corre('E_dom', dF);
        si(G.d, 'Dominio bien formado (AFD)', 'autómata', r3.acepta,
          `«${dp}» está formado por partes separadas por puntos, y cada parte empieza y termina en letra o número${refD}${filtrada}`,
          `El AFD del dominio rechazó «${dp}»: revisa las reglas anteriores y el detalle técnico.` + refD + filtrada,
          'Corrige las reglas del dominio marcadas arriba.');
      }

      // Extensión (TLD)
      if (!host.length) {
        nomExt.forEach((n, i) => no(G.e, n, i < 2 ? 'adicional' : 'autómata', 'no hay dominio ni extensión'));
      } else {
        si(G.e, 'Punto antes de la extensión', 'adicional', punto >= 0, `hay un punto que separa el dominio de la extensión${refD}`,
          'Falta el punto y la extensión (TLD): después del dominio debe haber un punto y al menos dos letras, por ejemplo «.com».' + refD,
          'Agrega al final un punto y la extensión, por ejemplo usuario@gmail.com.');
        if (punto < 0) {
          nomExt.slice(1).forEach((n, i) => no(G.e, n, i < 1 ? 'adicional' : 'autómata', 'sin punto no se puede delimitar la extensión'));
        } else {
          si(G.e, 'Extensión presente', 'adicional', tld.length > 0, `la extensión es «${tld}»${refD}`,
            'El dominio termina con punto: falta la extensión (TLD).' + refD, 'Escribe la extensión después del último punto, por ejemplo «com» o «gt».');
          if (!tld.length) {
            nomExt.slice(2).forEach((n) => no(G.e, n, 'autómata', 'no hay extensión que evaluar'));
          } else {
            const tF = filtra(tld, permitidos); //  solo caracteres que el correo admite
            const soloLetras = filtra(tld, C.DEFS_CORREO.E_tld.atomos);
            const noLetras = [];
            for (let i = 0; i < tld.length; i++) if (C.clase(tld[i], permitidos) && !C.clase(tld[i], C.DEFS_CORREO.E_tld.atomos)) noLetras.push(`«${tld[i]}» (posición ${hOff + punto + 2 + i})`);
            const rl = corre('E_tld_letras', tF);
            si(G.e, 'Extensión con solo letras', 'autómata', rl.acepta, `«${tld}» solo tiene letras${refD}`,
              `La extensión «${tld}» debe contener solo letras (no admite ${lista(noLetras)}).` + refD,
              'Quita números, guiones o símbolos de la extensión; usa solo letras, por ejemplo «com» o «gt».');
            const r4 = corre('E_tld', soloLetras);
            si(G.e, 'Extensión de al menos 2 letras', 'autómata', r4.acepta, `«${tld}» tiene ${letras(soloLetras.length)} (mínimo 2)${refD}`,
              (soloLetras.length === 1 && tld.length === 1 ? 'La extensión tiene una sola letra (mínimo 2).' : soloLetras.length === 0 ? 'La extensión no tiene ninguna letra (mínimo 2).' : `La extensión tiene solo ${letras(soloLetras.length)} (mínimo 2).`) + refD,
              'Usa una extensión de dos o más letras, por ejemplo «.com», «.gt» o «.edu».');
          }
        }
      }
    }

    // ---- 5) Decisión final: el AFD completo del correo ---------------------
    const fallan = reglas.filter((x) => x.estado === 'incumple').length;
    const coincide = rAFD.acepta === rAFND;
    si(G.a, 'Estructura completa parteLocal@dominio.TLD (AFD del correo)', 'autómata', rAFD.acepta,
      `el AFD del correo leyó los ${t.length} caracteres y terminó en un estado de aceptación`,
      fallan
        ? `El AFD del correo rechazó la cadena; ${fallan === 1 ? 'la regla marcada arriba explica' : `las ${fallan} reglas marcadas arriba explican`} el rechazo.`
        : 'El correo no cumple la estructura parteLocal@dominio.TLD definida por la ER; no se pudo asociar a una regla específica (ver detalle técnico).',
      'Corrige lo indicado en las reglas anteriores y vuelve a validar.');

    // Texto "técnico": recorrido de estados del AFD completo y comprobación con el AFND.
    const tecnico =
      (rAFD.acepta ? '' : rAFD.motivo + (rAFD.pos !== undefined ? ` (posición ${rAFD.pos + 1})` : '') + '. ') +
      'Ruta del AFD: ' + rAFD.ruta.map((q) => 'q' + q).join(' → ') + (rAFD.acepta ? ' (aceptación)' : ' (rechazo)') +
      `\nAFND: ${rAFND ? 'acepta' : 'rechaza'}${coincide ? ' (coincide con el AFD)' : ' (NO coincide con el AFD)'}\n`;

    return {
      entrada: t,
      valido: rAFD.acepta && reglas.every((x) => x.estado === 'cumple'), // válido solo si el AFD acepta y TODAS cumplen
      reglas,
      diagnostico: rAFD.acepta ? [] : C.diagnosticarCorreo(t), // (se conserva el módulo de diagnóstico original)
      tecnico,
      ruta: rAFD.ruta,
      rutas,
    };
  };

  // ---------------------------------------------------------------------------
  // validarPassword
  // ---------------------------------------------------------------------------
  // Pasos:
  //   1) Regla del ALFABETO: ¿todos los caracteres están permitidos (C_p)?
  //   2) Se quitan los caracteres no permitidos (queda `filt`) y se pasa
  //      `filt` por CADA autómata: R_long, R_may, R_min, R_dig, R_sim.
  //      (Así una contraseña con un carácter raro igual recibe feedback útil
  //       en las demás reglas.)
  //   3) Reglas adicionales (máximo, espacios, 3 iguales seguidos, secuencias
  //      y palabras prohibidas), que se comprueban con código normal.
  //   4) Se calcula el nivel de seguridad.
  C.validarPassword = function (t) {
    const P = C.PASS;
    const reglas = [];
    const rutas = {}; //  recorrido de estados de cada autómata (para el "detalle técnico")
    const perm = C.CONJ.C_p; // caracteres permitidos
    const ext = []; //     caracteres NO permitidos encontrados: { c, pos }

    // 1) Buscar caracteres fuera del alfabeto permitido
    for (let i = 0; i < t.length; i++) {
      if (!perm.includes(t[i])) ext.push({ c: t[i], pos: i + 1 });
    }
    // `filt` = la contraseña sin esos caracteres (lo que sí pueden leer los AFD)
    const filt = [...t].filter((c) => perm.includes(c)).join('');

    reglas.push(
      R(
        'Solo contiene caracteres permitidos', 'autómata', !ext.length,
        `fuera del alfabeto permitido: ${ext.map((x) => `«${nombreCar(x.c)}» (posición ${x.pos})`).join(', ')}. Se admiten A–Z, a–z, 0–9 y ${C.CONJ.S_p}`
      )
    );

    // Mensajes de error de cada autómata
    const DET = {
      R_long: `longitud ${t.length}, mínimo ${P.min}`,
      R_may: 'no hay ninguna mayúscula (A–Z)',
      R_min: 'no hay ninguna minúscula (a–z)',
      R_dig: 'no hay ningún dígito (0–9)',
      R_sim: `no hay ningún símbolo especial permitido (${C.CONJ.S_p})`,
    };

    // 2) Pasar el texto por cada AFD de regla
    for (const k of ['R_long', 'R_may', 'R_min', 'R_dig', 'R_sim']) {
      const r = C.simular(C.M[k], filt); //   ← recorrido del AFD de la regla k
      rutas[k] = r.ruta;
      const nombre = `${k}: ${C.DEFS[k].nombre}`;

      if (k === 'R_long' && ext.length) {
        // Si hubo caracteres raros, la longitud "real" no se puede juzgar bien.
        reglas.push({
          regla: nombre,
          tipo: 'autómata',
          ok: false,
          estado: 'no_evaluable',
          detalle: `no evaluable: hay ${ext.length} carácter(es) fuera del alfabeto (${filt.length} permitidos de ${t.length} en total)`,
        });
      } else {
        reglas.push(R(nombre, 'autómata', r.acepta, DET[k] + (ext.length ? ' (se evaluaron solo los caracteres permitidos)' : '')));
      }
    }

    // 3) Reglas adicionales (no las decide un autómata)
    const sp = t.search(/\s/); //           primer espacio
    const rep = t.search(/(.)\1\1/); //     tres caracteres iguales seguidos (ej. "aaa")
    const sq = secuencia(t); //             secuencia obvia (abc, 123)
    const low = t.toLowerCase();
    const pro = P.prohibidas.find((w) => low.includes(w)); // palabra prohibida contenida

    reglas.push(
      R(`Máximo ${P.max} caracteres`, 'adicional', t.length <= P.max, `longitud ${t.length}`),
      R('Sin espacios', 'adicional', sp < 0, `espacio en posición ${sp + 1}`),
      R('Sin 3 caracteres iguales seguidos', 'adicional', rep < 0, `posición ${rep + 1}`),
      R('Sin secuencias obvias (abc, 123)', 'adicional', sq < 0, `posición ${sq + 1}`),
      R('Sin palabras prohibidas', 'adicional', !pro, `contiene «${pro}»`)
    );

    // 4) Resultado final: válida solo si TODAS las reglas cumplen
    const valido = reglas.every((x) => x.estado === 'cumple');
    return {
      entrada: t,
      valido,
      reglas,
      rutas,
      seguridad: C.nivel(t, valido, reglas.filter((x) => x.estado === 'incumple').map((x) => x.regla)),
    };
  };

  // Valida un correo y una contraseña a la vez.
  C.validarPar = (c, p) => {
    const a = C.validarCorreo(c);
    const b = C.validarPassword(p);
    return { correo: a, password: b, valido: a.valido && b.valido };
  };
})(globalThis);
