/* =============================================================================
 * pruebas.js  —  PRUEBAS AUTOMÁTICAS del núcleo
 * =============================================================================
 * Cómo ejecutarlas:   npm test        (o:  node pruebas/pruebas.js)
 *
 * Qué comprueban (cada prueba imprime OK o FALLA):
 *   AFD-*  tamaño de los autómatas construidos y comparación con el AFD del
 *          documento del proyecto (AVANCE_1)
 *   ε-01   que el cierre ε funciona
 *   COR-*  correos válidos e inválidos conocidos
 *   PAS-*  contraseñas válidas e inválidas conocidas
 *   EQV-*  EQUIVALENCIA: el AFND y el AFD aceptan exactamente lo mismo
 *          (así se comprueba que Thompson + subconjuntos están bien hechos)
 *   DOC-01 el AFD generado acepta lo mismo que el AFD hecho "a mano" del documento
 *   GEN-*  lo que genera el generador siempre es aceptado por los validadores
 *   DIAG-* los mensajes de diagnóstico de correos
 *   ALF-*  caracteres fuera del alfabeto en contraseñas
 *   SEG-*  nivel de seguridad (baja / media / fuerte)
 *
 * Una prueba se registra con  T(id, descripcion, esperado, obtenido, nota)
 * y pasa cuando `esperado === obtenido`.
 * ========================================================================== */
(function () {
  // Cargamos los archivos del núcleo en el MISMO orden que index.html.
  // (En el navegador los carga el HTML; en Node los cargamos con require.)
  if (typeof require === 'function') {
    [
      'nucleo/configuracion', 'nucleo/parser-regex', 'nucleo/thompson', 'nucleo/afd',
      'nucleo/simulacion', 'nucleo/compilador',
      'credenciales/seguridad', 'credenciales/diagnostico', 'credenciales/validador', 'credenciales/generador',
    ].forEach((f) => require('../app/js/' + f + '.js'));
  }

  const C = globalThis.Cred;
  const res = []; // aquí se acumulan los resultados
  const T = (id, ent, esp, obt, nota = '') => res.push({ id, ent, esp, obt, ok: esp === obt, nota });

  // ---------------------------------------------------------------------------
  // Tamaño de los autómatas de contraseña (cantidad de estados del AFD)
  // ---------------------------------------------------------------------------
  T('AFD-02', 'AFD R_may', 9, C.M.R_may.d.length);
  T('AFD-03', 'AFD R_long', 14, C.M.R_long.d.length);
  for (const k of ['R_min', 'R_dig', 'R_sim']) T('AFD-' + k, 'AFD ' + k, 9, C.M[k].d.length);
  T('ε-01', 'cierre ε del inicio contiene al inicio', true, C.cierre(C.M.correo.nfa, new Set([0])).has(0));

  // ---------------------------------------------------------------------------
  // Correos conocidos: [correo, ¿debe ser válido? (1 = sí, 0 = no)]
  // ---------------------------------------------------------------------------
  [
    ['juan.perez@unis.edu.gt', 1], ['maria_lopez99@gmail.com', 1], ['.carlos@dominio.com', 0],
    ['usuario@-dominio.com', 0], ['usuario@dominio.c', 0], ['juan..perez@gmail.com', 0],
    ['juan.@gmail.com', 0], ['a@b.co', 1], ['juan@@gmail.com', 0], ['mi correo@gmail.com', 0],
    ['', 0], ['usuario@dominio-.com', 0], ['x@y.z1', 0],
  ].forEach(([c, e], i) => T('COR-' + (i + 1), c || '(vacío)', !!e, C.validarCorreo(c).valido));

  // ---------------------------------------------------------------------------
  // Contraseñas conocidas: [contraseña, ¿debe ser válida?]
  // ---------------------------------------------------------------------------
  [
    ['Tu9@guate2026', 1], ['Mk3#Verde2026Sol', 1], ['xK7$mundoAzul', 1], ['TTu9@guate2026', 1],
    ['tu9@guate2026', 0], ['TU9@GUATE2026', 0], ['Tu@guateXelaYZ', 0], ['Tu9guate2026', 0],
    ['Tu9@corto', 0], ['Tu9@aaaguate26', 0], ['Tu9@Guatemala2026', 0], ['Tu9@guate 2026', 0],
    ['Zq7#Lm4$Rt8!Vb2&Xn5%Pd3*Hk6+Wc9=Fy1-Jg0_Ua7#Se4$Oi2&Ln8!Qz3@Bx5%Mr6^', 0],
    ['Ab9#xqZ!k3Q$w', 1], ['Ab9#xyz!k3Q$w', 0],
  ].forEach(([p, e], i) => T('PAS-' + (i + 1), p, !!e, C.validarPassword(p).valido));

  // ---------------------------------------------------------------------------
  // Comparación con el AFD del documento AVANCE_1 (tabla de 17 estados)
  // ---------------------------------------------------------------------------
  // DOC[estado][clase] = estado destino. Es una referencia INDEPENDIENTE,
  // hecha a mano, con clases más gruesas: C (letra), D, G, S, P, A.
  const DOC = {
    0: { C: 1, D: 1, G: 1, S: 1 }, 1: { C: 2, D: 2, G: 2, S: 2, P: 3, A: 4 }, 2: { C: 2, D: 2, G: 2, S: 2, P: 3, A: 4 },
    3: { C: 5, D: 5, G: 5, S: 5 }, 4: { C: 6, D: 6 }, 5: { C: 7, D: 7, G: 7, S: 7, P: 3, A: 4 },
    6: { C: 8, D: 8, G: 9, P: 10 }, 7: { C: 7, D: 7, G: 7, S: 7, P: 3, A: 4 }, 8: { C: 8, D: 8, G: 9, P: 10 },
    9: { C: 8, D: 8, G: 9 }, 10: { C: 11, D: 12 }, 11: { C: 13, D: 14, G: 15, P: 10 }, 12: { C: 14, D: 14, G: 15, P: 10 },
    13: { C: 16, D: 14, G: 15, P: 10 }, 14: { C: 14, D: 14, G: 15, P: 10 }, 15: { C: 14, D: 14, G: 15 },
    16: { C: 16, D: 14, G: 15, P: 10 },
  };
  // Simula el AFD del documento (aceptan los estados 13 y 16).
  const docAcepta = (s) => {
    let q = 0;
    for (const ch of s) {
      const a = C.clase(ch, C.DEFS.correo.atomos);
      // traducimos nuestras clases a las del documento
      const k = { L: 'C', l: 'C', D: 'D', G: 'G', S_e: 'S', P: 'P', A: 'A' }[a];
      if (!k || DOC[q][k] === undefined) return false;
      q = DOC[q][k];
    }
    return q === 13 || q === 16;
  };
  T(
    'AFD-01', 'estados mínimos: generado vs AFD del documento',
    C.minimizar({ atomos: ['C', 'D', 'G', 'S', 'P', 'A'], d: Object.values(DOC), fin: new Set([13, 16]) }),
    C.minimizar(C.M.correo),
    `sin minimizar: generado ${C.M.correo.d.length}, documento 17`
  );

  // Generador de números pseudoaleatorios con SEMILLA fija: así las pruebas
  // dan siempre el mismo resultado (repetibles). Devuelve valores en [0, 1).
  let semilla = 1;
  const rnd = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;

  // ---------------------------------------------------------------------------
  // EQUIVALENCIA AFND ≡ AFD con 300 cadenas aleatorias por autómata
  // ---------------------------------------------------------------------------
  for (const k of Object.keys(C.M)) {
    const m = C.M[k];
    let mal = 0;
    const alfabeto = m.atomos.map((a) => C.CONJ[a]).join('');
    for (let i = 0; i < 300; i++) {
      let s = '';
      const n = Math.floor(rnd() * 16);
      for (let j = 0; j < n; j++) s += alfabeto[Math.floor(rnd() * alfabeto.length)];
      if (C.simular(m, s).acepta !== C.simularAFND(m, s)) mal++;
    }
    T('EQV-' + k, 'AFND≡AFD (300 cadenas)', 0, mal);
  }

  // AFD generado ≡ AFD del documento, con 3000 cadenas aleatorias
  {
    let mal = 0;
    const alfabeto = Object.keys(C.CONJ).filter((k) => k !== 'C_p' && k !== 'S_p').map((k) => C.CONJ[k]).join('') + 'aaab.@';
    for (let i = 0; i < 3000; i++) {
      let x = '';
      const n = Math.floor(rnd() * 14);
      for (let j = 0; j < n; j++) x += alfabeto[Math.floor(rnd() * alfabeto.length)];
      if (C.simular(C.M.correo, x).acepta !== docAcepta(x)) mal++;
    }
    for (const x of ['a@b.co', 'ab.cd@e-f.gh.com', 'a@b.cc']) if (!docAcepta(x)) mal++;
    T('DOC-01', 'AFD generado ≡ AFD del documento (3000 cadenas)', 0, mal);
  }

  // ---------------------------------------------------------------------------
  // GENERADOR: todo lo que genera debe ser aceptado
  // ---------------------------------------------------------------------------
  let g1 = 0, g2 = 0, g3 = 0;
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    const p = C.genPar();
    if (C.validarCorreo(p.correo).valido) g1++;
    if (C.validarPassword(p.password).valido) g2++;
    if (C.simularAFND(C.M.correo, p.correo)) g3++;
  }
  T('GEN-01', '50 correos generados aceptados por AFD', 50, g1);
  T('GEN-02', '50 contraseñas generadas válidas', 50, g2);
  T('GEN-03', '50 correos aceptados por el AFND', 50, g3);
  T('GEN-04', 'generación termina (<5 s)', true, Date.now() - t0 < 5000);

  // ---------------------------------------------------------------------------
  // DIAGNÓSTICO del correo (el AFD decide; el diagnóstico solo explica)
  // ---------------------------------------------------------------------------
  // [correo, fragmento de texto que debe aparecer en el mensaje]
  [
    ['juan..perez@gmail.com', 'dos puntos seguidos'], ['.carlos@dominio.com', 'comienza con punto'],
    ['juan.@gmail.com', 'termina con punto'], ['usuario@-dominio.com', 'comienza con guion'],
    ['usuario@dominio-.com', 'termina con guion'], ['usuario@dominio.c', 'una sola letra'],
    ['juan@@gmail.com', 'más de un @'], ['juan.perezgmail.com', 'Falta el símbolo @'],
    ['mi correo@gmail.com', 'espacio'], ['a@b', 'extensión'], ['x@y.z1', 'solo letras'], ['', 'vacío'],
    ['@gmail.com', 'No hay parte local'], ['a@', 'Falta el dominio'], ['a@b_c.com', 'solo admite'],
  ].forEach(([c, frag], i) => {
    const v = C.validarCorreo(c);
    const txt = v.reglas.map((x) => x.detalle).join(' ');
    T('DIAG-' + (i + 1), c || '(vacío)', true, !v.valido && txt.includes(frag) && !/\bq\d+/.test(txt), 'contiene «' + frag + '» y sin q# en el mensaje');
  });
  T('DIAG-sec', 'el detalle técnico conserva el recorrido q#', true, /q\d+/.test(C.validarCorreo('a@b.c').tecnico));
  T('DIAG-ok', 'correo válido: sin diagnóstico', 0, C.validarCorreo('a@b.co').diagnostico.length);
  {
    // Mutaciones: tomamos correos válidos, les metemos o quitamos un carácter
    // y verificamos que el diagnóstico sea coherente con el AFD.
    let incoherentes = 0, sinDiag = 0, rechazados = 0;
    const pool = 'ab1.-@Zc_%+ om'.split('');
    for (let i = 0; i < 1500; i++) {
      let x = C.genCorreo(rnd);
      const k = Math.floor(rnd() * 3);
      const pos = Math.floor(rnd() * (x.length + 1));
      if (k === 0) x = x.slice(0, pos) + pool[Math.floor(rnd() * pool.length)] + x.slice(pos); // insertar
      else if (k === 1) x = x.slice(0, pos) + x.slice(pos + 1); //                               borrar
      const ok = C.simular(C.M.correo, x).acepta;
      const dg = C.diagnosticarCorreo(x);
      if (ok && dg.length) incoherentes++; // aceptado pero con diagnóstico: error
      if (!ok) {
        rechazados++;
        if (!dg.length) sinDiag++; //        rechazado sin causa explicada: hueco
      }
    }
    T('DIAG-cons', 'aceptado por AFD ⇒ sin diagnóstico (1500 mutaciones)', 0, incoherentes);
    T('DIAG-cob', 'rechazado por AFD ⇒ hay causa identificada', 0, sinDiag, `rechazos analizados: ${rechazados}`);
  }

  // ---------------------------------------------------------------------------
  // REPORTE DETALLADO del correo: todas las reglas en una sola validación
  // ---------------------------------------------------------------------------
  {
    const est = (v, nombre, grupo) => (v.reglas.find((x) => x.regla.startsWith(nombre) && (!grupo || x.grupo === grupo)) || {}).estado;
    // Correo válido: todas las reglas cumplen y cada una explica por qué.
    const ok = C.validarCorreo('juan.perez@unis.edu.gt');
    T('REP-01', 'correo válido: todas las reglas cumplen', true, ok.valido && ok.reglas.every((x) => x.estado === 'cumple'));
    T('REP-02', 'correo válido: cada regla trae el motivo', true, ok.reglas.every((x) => x.motivo.length > 0));
    // Varios errores a la vez: espacios + dos @ + extensión de una letra.
    const v = C.validarCorreo('ju an@@gm ail.c');
    T('REP-03', 'espacios, dos @ y TLD corto se reportan juntos', true,
      est(v, 'Sin espacios') === 'incumple' && est(v, 'Tiene exactamente un @') === 'incumple' && est(v, 'Extensión de al menos 2 letras') === 'incumple');
    T('REP-04', 'con varios @ se indica la referencia usada', true, /referencia/.test(v.reglas.find((x) => x.regla === 'Parte local presente').motivo));
    T('REP-05', 'cada regla incumplida trae cómo corregirla', true, v.reglas.filter((x) => x.estado === 'incumple').every((x) => x.corregir.length > 0));
    // Parte local, dominio y TLD con errores simultáneos.
    const w = C.validarCorreo('a..b.@-x_y..com1');
    T('REP-06', 'a..b.@-x_y..com1: 9 reglas incumplidas a la vez (8 parciales + AFD)', 9, w.reglas.filter((x) => x.estado === 'incumple').length);
    // Sin @: las reglas que dependen de él quedan no_evaluable (no se inventan resultados).
    const s0 = C.validarCorreo('sinarroba.com');
    T('REP-07', 'sin @: parte local/dominio/TLD no evaluables', true,
      s0.reglas.filter((x) => ['Parte local', 'Dominio', 'Extensión (TLD)'].includes(x.grupo)).every((x) => x.estado === 'no_evaluable'));
    T('REP-08', 'sin @: espacios y alfabeto sí se evalúan', true, est(s0, 'Sin espacios') === 'cumple' && est(s0, 'Solo contiene') === 'cumple');
    // Sin punto: la extensión no se puede delimitar.
    const s1 = C.validarCorreo('a@b');
    T('REP-09', 'a@b: falta punto y TLD no evaluable', true, est(s1, 'Punto antes') === 'incumple' && est(s1, 'Extensión presente') === 'no_evaluable');
    T('REP-10', 'correo vacío: solo falla «no está vacío»; el resto no evaluable', true,
      C.validarCorreo('').reglas.filter((x) => x.estado === 'incumple').map((x) => x.regla).join('|') === 'El correo no está vacío|Estructura completa parteLocal@dominio.TLD (AFD del correo)');
    // Los autómatas siguen siendo la base: reglas parciales compiladas con el mismo proceso.
    T('REP-11', 'reglas parciales compiladas (ER→AFND→AFD)', true,
      Object.keys(C.DEFS_CORREO).every((k) => C.MR[k] && C.MR[k].nfa && C.MR[k].d.length > 0 && C.MR[k].fin.size > 0));
    T('REP-12', 'el detalle técnico compara AFND y AFD', true, /AFND: acepta \(coincide con el AFD\)/.test(ok.tecnico) && /AFND: rechaza \(coincide/.test(v.tecnico));
    T('REP-13', 'se guardan las rutas de los AFD por regla', true, !!ok.rutas.E_arroba && !!ok.rutas.E_loc && !!ok.rutas.E_dom && !!ok.rutas.E_tld);
    // Coherencia con el AFD original: las reglas parciales aceptan ⇔ el AFD completo acepta.
    let dif = 0, rech = 0;
    const pool2 = 'ab1.-@Zc_%+ om!ñ'.split('');
    for (let i = 0; i < 3000; i++) {
      let x = C.genCorreo(rnd);
      for (let j = 0, n = 1 + Math.floor(rnd() * 4); j < n; j++) {
        const pos = Math.floor(rnd() * (x.length + 1)), m = Math.floor(rnd() * 3), ch = pool2[Math.floor(rnd() * pool2.length)];
        x = m === 0 ? x.slice(0, pos) + ch + x.slice(pos) : m === 1 ? x.slice(0, pos) + x.slice(pos + 1) : x.slice(0, pos) + ch + x.slice(pos + 1);
      }
      const afd = C.simular(C.M.correo, x).acepta;
      const r = C.validarCorreo(x);
      const parciales = r.reglas.filter((q) => q.grupo !== 'Autómata completo').every((q) => q.estado === 'cumple');
      if (afd !== r.valido || afd !== parciales || afd !== C.simularAFND(C.M.correo, x)) dif++;
      if (!afd) rech++;
    }
    T('REP-cons', 'reglas parciales ⇔ AFD ⇔ AFND (3000 mutaciones)', 0, dif, `rechazados analizados: ${rech}`);
  }

  // ---------------------------------------------------------------------------
  // Caracteres fuera del alfabeto en contraseñas (ej.: el punto no está permitido)
  // ---------------------------------------------------------------------------
  {
    const v = C.validarPassword('Tu9.guate2026');
    const regla = (n) => v.reglas.find((x) => x.regla.startsWith(n));
    T('ALF-01', 'Tu9.guate2026: regla de alfabeto incumple y es la 1ª', true, v.reglas[0].regla === 'Solo contiene caracteres permitidos' && v.reglas[0].estado === 'incumple');
    T('ALF-02', 'detalle indica «.» y posición 4', true, /«\.»/.test(v.reglas[0].detalle) && v.reglas[0].detalle.includes('posición 4'));
    T('ALF-03', 'rechazo final se mantiene', false, v.valido);
    T('ALF-04', 'R_may/R_min/R_dig cumplen por separado', true, ['R_may', 'R_min', 'R_dig'].every((k) => regla(k).estado === 'cumple'));
    T('ALF-05', 'R_sim incumple (el «.» no es símbolo permitido)', true, regla('R_sim').estado === 'incumple');
    T('ALF-06', 'R_long no evaluable', true, regla('R_long').estado === 'no_evaluable');
    T('ALF-07', 'no todas las reglas fallan', true, v.reglas.some((x) => x.estado === 'cumple') && v.reglas.filter((x) => x.estado === 'incumple').length < v.reglas.length - 1);
    const w = C.validarPassword('Tu9@guate2026ñ');
    T('ALF-08', 'Tu9@guate2026ñ: solo alfabeto falla (+no evaluable)', 1, w.reglas.filter((x) => x.estado === 'incumple').length, 'ñ posición 14');
    T('ALF-09', 'contraseña válida: regla de alfabeto cumple', true, C.validarPassword('Tu9@guate2026').reglas[0].estado === 'cumple');
  }

  // ---------------------------------------------------------------------------
  // Nivel de seguridad
  // ---------------------------------------------------------------------------
  {
    const N = (p) => C.validarPassword(p);
    T('SEG-01', 'inválida ⇒ baja', 'baja', N('tu9@guate2026').seguridad.nivel);
    T('SEG-02', 'válida de 13 caracteres ⇒ media (válida ≠ fuerte)', 'media', N('Tu9@guate2026').seguridad.nivel);
    T('SEG-03', 'válida ⇒ el reporte lo marca válida y media', true, N('Tu9@guate2026').valido && N('Tu9@guate2026').seguridad.valida);
    T('SEG-04', '16 caracteres y ≥10 distintos ⇒ fuerte', 'fuerte', N('Ab1!Cd2@Ef3#Gh4$').seguridad.nivel);
    T('SEG-05', '15 caracteres ⇒ media', 'media', N('Ab1!Cd2@Ef3#Gh4').seguridad.nivel);
    T('SEG-06', '16 caracteres pero solo 4 distintos ⇒ media', 'media', N('Ab1!Ab1!Ab1!Ab1!').seguridad.nivel);
    T('SEG-07', 'el motivo explica lo que falta', true, /16 caracteres o más \(tiene 13\)/.test(N('Tu9@guate2026').seguridad.motivo));
    T('SEG-08', 'baja: el motivo nombra la regla incumplida', true, /R_may/.test(N('tu9@guate2026').seguridad.motivo));
    let okG = 0, okP = 0;
    for (let i = 0; i < 50; i++) {
      const g = C.genPasswordInfo();
      const p = C.genPar();
      if (['media', 'fuerte'].includes(g.seguridad.nivel) && g.seguridad.motivo) okG++;
      if (['media', 'fuerte'].includes(p.seguridad.nivel)) okP++;
    }
    T('SEG-09', '50 contraseñas generadas traen nivel y motivo', 50, okG);
    T('SEG-10', '50 pares generados traen nivel', 50, okP);
  }

  // ---------------------------------------------------------------------------
  // Informe en pantalla
  // ---------------------------------------------------------------------------
  res.forEach((x) =>
    console.log(x.ok ? 'OK   ' : 'FALLA', x.id.padEnd(10), String(x.ent).slice(0, 40).padEnd(42), 'esp=', x.esp, 'obt=', x.obt, x.nota)
  );
  console.log(`\n${res.filter((x) => x.ok).length}/${res.length} aprobadas`);
  console.log('10 pares:');
  for (let i = 0; i < 10; i++) {
    const p = C.genPar();
    console.log(' ', p.correo, '|', p.password, C.validarPassword(p.password).seguridad.nivel);
  }
  C.resultadosPruebas = res;
})();
