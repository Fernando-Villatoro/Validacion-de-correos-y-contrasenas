/* =============================================================================
 * app.js  —  LA INTERFAZ: conecta la pantalla (index.html) con el núcleo
 * =============================================================================
 * Este archivo NO contiene algoritmos de autómatas. Solo:
 *   - lee lo que el usuario escribe / hace clic,
 *   - llama a las funciones del núcleo (C.validarCorreo, C.genCorreo,
 *     C.simular, C.M ...),
 *   - y dibuja el resultado en la página.
 *
 * Secciones del archivo:
 *   1) Utilidades pequeñas (atajos del DOM, avisos, copiar al portapapeles)
 *   2) Navegación entre pantallas (Inicio / Validador / Generador / Autómatas)
 *   3) "Fichas" de colores: cada carácter coloreado según su clase del alfabeto
 *   4) Pantalla VALIDADOR: informes de validación
 *   5) Pantalla GENERADOR: tarjetas con credenciales generadas
 *   6) Pantalla AUTÓMATAS: dibujo del AFND/AFD, tabla y simulación paso a paso
 *   7) Pantalla INICIO y arranque
 *
 * Se carga de ÚLTIMO en index.html, cuando todo el núcleo ya existe.
 * ========================================================================== */
(function () {
  const C = Cred; // el objeto global con todo el núcleo

  // ===========================================================================
  // 1) UTILIDADES
  // ===========================================================================
  const $ = (id) => document.getElementById(id); //                        busca un elemento por su id
  const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)]; // busca varios (lista)

  // Escapa caracteres especiales de HTML (&, <, >, ") para que lo que escribe
  // el usuario se muestre como texto y nunca se interprete como código.
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Devuelve el HTML de un icono (los iconos están definidos en index.html).
  const ic = (nombre) => `<svg class="ic"><use href="#i-${nombre}"/></svg>`;

  // Aviso emergente ("toast") que desaparece solo a los 2.2 segundos.
  let temporizadorToast;
  const toast = (mensaje) => {
    const t = $('toast');
    t.textContent = mensaje;
    t.classList.add('on');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => t.classList.remove('on'), 2200);
  };

  // Copia un texto al portapapeles. Si el navegador no ofrece la API moderna
  // (o falla), usa un método alternativo con un <textarea> temporal.
  const copiar = (txt) => {
    const exito = () => toast('Copiado al portapapeles');
    function alternativo() {
      const a = document.createElement('textarea');
      a.value = txt;
      document.body.appendChild(a);
      a.select();
      try {
        document.execCommand('copy');
        exito();
      } catch (e) {
        toast('No se pudo copiar');
      }
      a.remove();
    }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(exito, () => alternativo());
    else alternativo();
  };

  // ===========================================================================
  // 2) NAVEGACIÓN ENTRE PANTALLAS
  // ===========================================================================
  // Título y subtítulo que se muestran arriba en cada pantalla.
  const TITULOS = {
    inicio: ['Inicio', 'Resumen del sistema y accesos a cada módulo.'],
    validar: ['Validador', 'Comprueba un correo o una contraseña contra los autómatas.'],
    generar: ['Generador', 'Credenciales creadas por recorrido del AFD y revalidadas.'],
    automatas: ['Laboratorio de autómatas', 'AFND (Thompson) y AFD (subconjuntos) generados por los algoritmos.'],
  };

  let laboratorioDibujado = false; // el laboratorio se dibuja la primera vez que se abre

  // ir(vista, idCampo): muestra una pantalla; opcionalmente pone el cursor en un campo.
  const ir = (vista, idCampo) => {
    $$('.view').forEach((e) => e.classList.toggle('on', e.id === 'v-' + vista));
    $$('.nav').forEach((e) => e.classList.toggle('on', e.dataset.go === vista));
    $('ttl').textContent = TITULOS[vista][0];
    $('sub').textContent = TITULOS[vista][1];
    if (vista === 'automatas' && !laboratorioDibujado) {
      laboratorioDibujado = true;
      dibujar(); //            dibuja el autómata elegido
      $('zf').onclick(); //    y lo ajusta al tamaño de la ventana
    }
    if (idCampo) $(idCampo).focus();
    scrollTo(0, 0);
  };
  // Todos los botones con atributo data-go navegan a esa pantalla.
  $$('[data-go]').forEach((b) => (b.onclick = () => ir(b.dataset.go, b.dataset.f)));

  // ===========================================================================
  // 3) FICHAS DE COLORES POR CARÁCTER
  // ===========================================================================
  // Cada carácter se pinta como una "ficha" cuyo color depende de su clase
  // léxica real, obtenida con C.clase (simulacion.js):
  //   L mayúscula · l minúscula · D dígito · S símbolo/separador · x fuera del alfabeto
  const claseVisual = (a) => (a === 'L' ? 'L' : a === 'l' ? 'l' : a === 'D' ? 'D' : a ? 'S' : 'x');
  const NOMBRE_CLASE = { L: 'mayúscula', l: 'minúscula', D: 'dígito', S: 'símbolo o separador', x: 'fuera del alfabeto' };

  // `atomos` = alfabeto del autómata con el que se clasifica cada carácter.
  const tiles = (s, atomos) =>
    [...s]
      .map((c, i) => {
        const k = claseVisual(C.clase(c, atomos));
        return `<i class="t k-${k}" style="animation-delay:${Math.min(i * 18, 500)}ms" title="${NOMBRE_CLASE[k]}">${esc(c === ' ' ? '␣' : c)}</i>`;
      })
      .join('');

  // Leyenda de colores que se muestra debajo de las fichas.
  const LEYENDA =
    '<div class="leyenda"><span><i class="k-L"></i>mayúscula</span><span><i class="k-l"></i>minúscula</span><span><i class="k-D"></i>dígito</span><span><i class="k-S"></i>símbolo / separador</span><span><i class="k-x"></i>fuera del alfabeto</span></div>';

  // ===========================================================================
  // 4) PANTALLA VALIDADOR
  // ===========================================================================
  const ALFA_PASS = ['L', 'l', 'D', 'S_p']; //   alfabeto con el que se colorea una contraseña
  const ALFA_CORREO = C.DEFS.correo.atomos; //    alfabeto con el que se colorea un correo

  // Las tres barritas de "Seguridad baja / media / fuerte".
  const barras = (n) =>
    `<span class="nivel n-${n}" title="Nivel de seguridad: ${n}">${[1, 2, 3]
      .map((i) => `<i style="height:${6 + i * 4}px" class="${i <= { baja: 1, media: 2, fuerte: 3 }[n] ? 'f' : ''}"></i>`)
      .join('')}Seguridad ${n}</span>`;

  const ICONO_ESTADO = { cumple: 'check', incumple: 'x', no_evaluable: 'warn' };
  const ETIQUETA_ESTADO = { cumple: 'Cumple', incumple: 'No cumple', no_evaluable: 'No evaluable' };

  // informe(titulo, reporte, alfabeto): construye el HTML del resultado de
  // una validación a partir del reporte que devuelve validador.js.
  const informe = (titulo, r, atomos) => {
    // Cuenta cuántas reglas cumplen / incumplen / no son evaluables.
    const cuenta = { cumple: 0, incumple: 0, no_evaluable: 0 };
    r.reglas.forEach((x) => cuenta[x.estado]++);

    // Texto del "detalle técnico": recorrido de estados de los autómatas.
    const tecnico =
      (r.tecnico || '') +
      (r.rutas
        ? Object.keys(r.rutas).map((k) => `Ruta ${k}: ` + r.rutas[k].map((q) => 'q' + q).join(' → ')).join('\n')
        : '');

    // Encabezado: VÁLIDO / INVÁLIDO y el resumen de reglas.
    const cabecera =
      `<div class="res ${r.valido ? 'ok' : 'bad'}"><div class="hd">${ic(r.valido ? 'shield' : 'x')}${titulo}: ${r.valido ? 'VÁLIDO' : 'INVÁLIDO'}` +
      `<span class="badge">${cuenta.cumple} cumplen · ${cuenta.incumple} no cumplen${cuenta.no_evaluable ? ' · ' + cuenta.no_evaluable + ' no evaluables' : ''}</span></div><div class="bd">`;

    // Fichas de colores con el texto analizado.
    const fichas = r.entrada ? `<div class="tiles">${tiles(r.entrada, atomos)}</div>${LEYENDA}` : '';

    // Lista de reglas, una por una. Cada regla muestra su icono y:
    //   - si cumple: por qué cumple (`motivo`, solo el correo lo trae),
    //   - si no cumple / no es evaluable: qué está mal (`detalle`) y, cuando el
    //     reporte lo trae, cómo corregirlo (`corregir`).
    // Si las reglas traen `grupo` (correo), se agrupan bajo un subtítulo.
    let grupo = '';
    const lista =
      '<ul class="rules">' +
      r.reglas
        .map((x) => {
          const titulo = x.grupo && x.grupo !== grupo ? `<li class="grp">${esc((grupo = x.grupo))}</li>` : '';
          const texto =
            x.estado === 'cumple'
              ? x.motivo ? `<span class="det">Cumple: ${esc(x.motivo)}</span>` : ''
              : `<span class="det">${ETIQUETA_ESTADO[x.estado]}: ${esc(x.detalle.replace(/^no evaluable:\s*/, ''))}</span>` +
                (x.corregir ? `<span class="fix">Cómo corregirlo: ${esc(x.corregir)}</span>` : '');
          return titulo + `<li class="${x.estado}">${ic(ICONO_ESTADO[x.estado])}<span><b>${esc(x.regla)}</b><span class="tag">${x.tipo}</span>${texto}</span></li>`;
        })
        .join('') +
      '</ul>';

    // Nivel de seguridad (solo para contraseñas).
    const nivel = r.seguridad
      ? `<p>${barras(r.seguridad.nivel)} <span class="sm mut">${esc(r.seguridad.motivo)} Criterio del proyecto, orientativo; la validez y el nivel son independientes.</span></p>`
      : '';

    // Detalle técnico desplegable.
    const detalle = tecnico ? `<details><summary>Detalle técnico del autómata</summary><pre>${esc(tecnico)}</pre></details>` : '';

    return [cabecera, fichas, lista, nivel, detalle + '</div></div>'].join('\n ');
  };

  // Si el campo está vacío, avisa (se valida igual, como cadena vacía).
  const avisoVacio = (idCampo, idAviso) => {
    const vacio = !$(idCampo).value;
    $(idAviso).textContent = vacio ? 'El campo está vacío; se valida como cadena vacía.' : '';
    $(idCampo).classList.toggle('err', vacio);
  };
  const avisoResultado = (nombre, valido) => toast(`${nombre}: ${valido ? 'válido' : 'inválido'}`);

  // "Mostrar contraseña": cambia el tipo del campo entre texto y password.
  $('ver').onchange = (e) => ($('p').type = e.target.checked ? 'text' : 'password');

  // Botón "Validar correo"
  $('vc').onclick = () => {
    avisoVacio('c', 'hc');
    const r = C.validarCorreo($('c').value);
    $('out').innerHTML = informe('Correo', r, ALFA_CORREO);
    avisoResultado('Correo', r.valido);
  };
  // Botón "Validar contraseña"
  $('vp').onclick = () => {
    avisoVacio('p', 'hp');
    const r = C.validarPassword($('p').value);
    $('out').innerHTML = informe('Contraseña', r, ALFA_PASS);
    avisoResultado('Contraseña', r.valido);
  };
  // Botón "Validar par completo"
  $('vk').onclick = () => {
    avisoVacio('c', 'hc');
    avisoVacio('p', 'hp');
    const r = C.validarPar($('c').value, $('p').value);
    $('out').innerHTML =
      `<div class="res ${r.valido ? 'ok' : 'bad'}"><div class="hd">${ic(r.valido ? 'shield' : 'x')}Resultado general: ${r.valido ? 'VÁLIDO' : 'INVÁLIDO'}</div></div>` +
      informe('Correo', r.correo, ALFA_CORREO) +
      informe('Contraseña', r.password, ALFA_PASS);
    avisoResultado('Par', r.valido);
  };

  // ===========================================================================
  // 5) PANTALLA GENERADOR
  // ===========================================================================
  // `items` guarda lo generado: cada elemento puede traer correo, password y seg.
  let items = [];

  // Texto para "Copiar todo": una línea por elemento, columnas separadas por tabulador.
  const textoGenerado = () =>
    items
      .map((x) => [x.correo, x.password, x.seg && `[${x.seg.nivel}] ${x.seg.motivo}`].filter(Boolean).join('\t'))
      .join('\n');

  // gen(funcionGeneradora): crea N elementos (máx. 50) llamando a esa función.
  const gen = (fabricar) => {
    const n = Math.min(50, +$('n').value || 1);
    items = Array.from({ length: n }, () => ({ ...fabricar() }));
    pintar();
    toast(`${n} generados`);
  };

  // Dibuja las tarjetas de `items` en la pantalla.
  const pintar = () => {
    const tarjeta = (x, i) => {
      const correo =
        x.correo !== undefined
          ? `<span class="lab">Correo</span><p class="mail">${esc(x.correo)}</p><button class="btn ghost" data-cp="correo">${ic('copy')}Copiar correo</button>`
          : '';
      const password =
        x.password !== undefined
          ? `<span class="lab" style="margin-top:8px">Contraseña</span><div class="tiles">${tiles(x.password, ALFA_PASS)}</div>` +
            `<p class="top2">${barras(x.seg.nivel)}<span class="sm mut">${esc(x.seg.motivo)}</span></p>` +
            `<button class="btn ghost" data-cp="password">${ic('copy')}Copiar contraseña</button>`
          : '';
      return (
        `<div class="card" style="animation-delay:${Math.min(i * 30, 400)}ms" data-i="${i}">\n ` +
        correo + '\n ' + password + '\n ' +
        `<button class="btn ghost" data-v="1">${ic('check')}Comprobar</button><span class="vr"></span></div>`
      );
    };
    $('gen').innerHTML = `<div class="gi">` + items.map(tarjeta).join('') + `</div>` + LEYENDA;
  };

  // Botón "Comprobar" de una tarjeta: revalida lo generado con el validador.
  const comprobar = (i) => {
    const x = items[i];
    const el = $$('.card', $('gen'))[i].querySelector('.vr');
    const a = x.correo !== undefined ? C.validarCorreo(x.correo).valido : true;
    const b = x.password !== undefined ? C.validarPassword(x.password).valido : true;
    const ok = a && b;
    el.innerHTML = `<span class="vchip ${ok ? 'ok' : 'bad'}">${ic(ok ? 'check' : 'x')}${ok ? 'Aprobada por el validador' : 'Rechazada por el validador'}</span>`;
  };

  // Un solo "oyente" de clics para todas las tarjetas (copiar / comprobar).
  $('gen').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = +b.closest('.card').dataset.i;
    if (b.dataset.cp) copiar(items[i][b.dataset.cp]);
    if (b.dataset.v) comprobar(i);
  };

  // Botones de generación (llaman a generador.js)
  $('gc').onclick = () => gen(() => ({ correo: C.genCorreo() }));
  $('gp').onclick = () =>
    gen(() => {
      const g = C.genPasswordInfo();
      return { password: g.password, seg: g.seguridad };
    });
  $('gk').onclick = () =>
    gen(() => {
      const p = C.genPar();
      return { correo: p.correo, password: p.password, seg: p.seguridad };
    });
  $('cp').onclick = () => (items.length ? copiar(textoGenerado()) : toast('Primero genera credenciales'));
  $('vall').onclick = () =>
    items.length
      ? (items.forEach((_, i) => comprobar(i)), toast('Comprobación completada'))
      : toast('Primero genera credenciales');

  // ===========================================================================
  // 6) PANTALLA AUTÓMATAS (laboratorio)
  // ===========================================================================
  let tipo = 'afd'; //  qué se muestra: 'afd' o 'afnd'
  let zoom = 1; //      zoom actual del dibujo
  let ss = null; //     simulación actual: { sets, txt }  (sets = estados activos en cada paso)
  let paso = 0; //      paso de la simulación que se está mostrando

  const nm = (q) => 'q' + q; //                    nombre de un estado: 3 -> "q3"
  const modelo = () => C.M[$('aut').value]; //     autómata elegido en el desplegable

  // ---------------------------------------------------------------------------
  // grafo(m, t): prepara los DATOS para dibujar (no dibuja nada todavía).
  //   - Reúne los estados y las flechas del AFND (m.nfa) o del AFD (m.d).
  //   - Agrupa flechas repetidas entre los mismos dos estados en una sola
  //     con varias etiquetas ("L, l").
  //   - Calcula dónde poner cada estado: la COLUMNA (rk) según qué tan lejos
  //     está del inicio, y la FILA (row) para acomodarlos sin enredarse.
  //   - Marca los estados "muertos" (desde los que ya no se puede llegar a
  //     un estado final).
  // ---------------------------------------------------------------------------
  function grafo(m, t) {
    let E, ini, fi, N; // E = flechas, ini = estado inicial, fi = finales, N = # de estados

    if (t === 'afnd') {
      // Datos del AFND de Thompson (ε se muestra como "ε")
      N = m.nfa.n;
      ini = m.nfa.inicio;
      fi = new Set([m.nfa.aceptacion]);
      E = m.nfa.trans.map((x) => ({ a: x.from, b: x.to, l: x.sym === null ? 'ε' : x.sym }));
    } else {
      // Datos del AFD (el estado inicial siempre es el 0)
      N = m.d.length;
      ini = 0;
      fi = m.fin;
      E = [];
      m.d.forEach((tr, i) => {
        for (const a in tr) E.push({ a: i, b: tr[a], l: a });
      });
    }

    // Agrupar flechas con mismo origen y destino: clave "origen>destino".
    const grupos = new Map();
    E.forEach((e) => {
      const k = e.a + '>' + e.b;
      if (!grupos.has(k)) grupos.set(k, { a: e.a, b: e.b, ls: [] });
      if (!grupos.get(k).ls.includes(e.l)) grupos.get(k).ls.push(e.l);
    });
    const ed = [...grupos.values()]; // flechas ya agrupadas
    const salen = Array.from({ length: N }, () => []); //   flechas que salen de cada estado
    const entran = Array.from({ length: N }, () => []); //  flechas que llegan a cada estado
    ed.forEach((e) => {
      salen[e.a].push(e);
      entran[e.b].push(e);
    });

    // Recorrido en profundidad desde el inicial:
    //   - detecta flechas "de retorno" (las que vuelven a un estado ya en
    //     proceso: ciclos), marcándolas con e.back = true;
    //   - guarda el orden de salida (post) para ordenar luego los estados.
    const marcaVisita = new Array(N).fill(0); // 0 = sin visitar, 1 = en proceso, 2 = terminado
    const post = [];
    (function visitar(u) {
      marcaVisita[u] = 1;
      salen[u].forEach((e) => {
        if (marcaVisita[e.b] === 0) visitar(e.b);
        else if (marcaVisita[e.b] === 1) e.back = true;
      });
      marcaVisita[u] = 2;
      post.push(u);
    })(ini);

    // COLUMNA de cada estado = camino más largo desde el inicial sin usar
    // flechas de retorno ni bucles. Así el dibujo avanza de izquierda a derecha.
    const rk = new Array(N).fill(0);
    post.reverse().forEach((u) =>
      salen[u].forEach((e) => {
        if (!e.back && e.a !== e.b) rk[e.b] = Math.max(rk[e.b], rk[u] + 1);
      })
    );
    const R = Math.max(...rk) + 1; // cantidad de columnas
    const cols = Array.from({ length: R }, () => []);
    post.forEach((u) => cols[rk[u]].push(u));

    // FILA de cada estado: primero el orden en su columna; luego 3 pasadas de
    // reordenado por el promedio de fila de sus predecesores (reduce cruces).
    const row = new Array(N).fill(0);
    cols.forEach((c) => c.forEach((u, i) => (row[u] = i)));
    for (let it = 0; it < 3; it++) {
      cols.forEach((c, r) => {
        if (!r) return;
        const baricentro = (u) => {
          const p = entran[u].filter((e) => rk[e.a] < r);
          return p.length ? p.reduce((s, e) => s + row[e.a], 0) / p.length : row[u];
        };
        c.sort((x, y) => baricentro(x) - baricentro(y));
        c.forEach((u, i) => (row[u] = i));
      });
    }

    // Estados "vivos" = los que pueden llegar a un final (se propaga hacia atrás).
    const vivo = new Set(fi);
    for (let cambio = true; cambio; ) {
      cambio = false;
      ed.forEach((e) => {
        if (vivo.has(e.b) && !vivo.has(e.a)) {
          vivo.add(e.a);
          cambio = true;
        }
      });
    }

    return { N, ini, fi, ed, rk, row, R, H: Math.max(...cols.map((c) => c.length)), muerto: (u) => !vivo.has(u) };
  }

  // ---------------------------------------------------------------------------
  // dibujar(): genera el dibujo SVG del autómata elegido, más su tabla e info.
  // ---------------------------------------------------------------------------
  function dibujar() {
    const m = modelo();
    const g = grafo(m, tipo);
    const X = 86; //   separación horizontal entre columnas
    const Y = 62; //   separación vertical entre filas
    const r = 18; //   radio de cada estado (círculo)
    const W = g.R * X + 90; //   ancho total del dibujo
    const H = g.H * Y + 220; //  alto total del dibujo
    const px = (u) => 50 + g.rk[u] * X; //   coordenada x del estado u
    const py = (u) => 110 + g.row[u] * Y; // coordenada y del estado u
    let s = '';

    // --- Flechas (transiciones) -------------------------------------------------
    g.ed.forEach((e) => {
      const x1 = px(e.a), y1 = py(e.a), x2 = px(e.b), y2 = py(e.b);
      const d = g.rk[e.b] - g.rk[e.a]; // cuántas columnas salta la flecha
      const eps = e.ls.includes('ε') && e.ls.length === 1; // ¿es una flecha solo-ε?
      let p, lx, ly; // p = trazo de la curva, (lx,ly) = posición de la etiqueta

      if (e.a === e.b) {
        // Bucle: el estado vuelve a sí mismo (curva por arriba)
        p = `M${x1 - 8} ${y1 - r}C${x1 - 30} ${y1 - r - 34} ${x1 + 30} ${y1 - r - 34} ${x1 + 8} ${y1 - r}`;
        lx = x1;
        ly = y1 - r - 26;
      } else if (d === 1 && !e.back) {
        // Flecha a la columna siguiente: curva suave directa
        const mx = (x1 + x2) / 2;
        p = `M${x1 + r} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2 - r} ${y2}`;
        lx = mx;
        ly = (y1 + y2) / 2 - 5;
      } else if (d > 1 && !e.back) {
        // Flecha que salta varias columnas: arco por arriba
        const cy = Math.min(y1, y2) - 18 - 9 * Math.min(d, 8);
        const cx = (x1 + x2) / 2;
        p = `M${x1} ${y1 - r}Q${cx} ${cy} ${x2} ${y2 - r}`;
        lx = cx;
        ly = 0.25 * (y1 - r) + 0.5 * cy + 0.25 * (y2 - r) - 3;
      } else {
        // Flecha de retorno (hacia atrás): arco por abajo
        const cy = Math.max(y1, y2) + 26 + 9 * Math.min(Math.abs(d) + 1, 8);
        const cx = (x1 + x2) / 2 + (x1 === x2 ? 46 : 0);
        p = `M${x1} ${y1 + r}Q${cx} ${cy} ${x2} ${y2 + r}`;
        lx = cx;
        ly = 0.25 * (y1 + r) + 0.5 * cy + 0.25 * (y2 + r) + 10;
      }

      s += `<g class="ed${eps ? ' eps' : ''}" id="e${e.a}-${e.b}" data-a="${e.a}" data-b="${e.b}"><path d="${p}" marker-end="url(#ar)"/><text x="${lx}" y="${ly}">${esc(e.ls.join(', '))}</text></g>`;
    });

    // --- Estados (círculos) -------------------------------------------------------
    for (let u = 0; u < g.N; u++) {
      const esFinal = g.fi.has(u);
      const x = px(u), y = py(u);
      const esMuerto = !esFinal && g.muerto(u);
      s +=
        `<g class="nd${u === g.ini ? ' ini' : ''}${esFinal ? ' fin' : ''}${esMuerto ? ' dead' : ''}" id="n${u}" data-u="${u}">` +
        // flechita de entrada al estado inicial
        `${u === g.ini ? `<path d="M${x - r - 26} ${y}H${x - r - 3}" stroke="#2547f5" stroke-width="2" marker-end="url(#ab)"/>` : ''}` +
        `<circle class="o" cx="${x}" cy="${y}" r="${r}"/>` +
        // círculo interior = doble círculo de los estados finales
        `${esFinal ? `<circle class="i" cx="${x}" cy="${y}" r="${r - 4}"/>` : ''}` +
        `<text x="${x}" y="${y + 4}">${nm(u)}</text></g>`;
    }

    // --- Armar el SVG completo (con las puntas de flecha en <defs>) ---------------
    $('svgbox').innerHTML =
      `<svg class="g" id="svg" width="${W * zoom}" height="${H * zoom}" viewBox="0 0 ${W} ${H}"><defs>` +
      `<marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4 0 8z" fill="#8a96ad" stroke="none"/></marker>` +
      `<marker id="ab" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4 0 8z" fill="#2547f5" stroke="none"/></marker>` +
      `</defs>${s}</svg>`;

    // --- Resaltado al pasar el cursor sobre un estado ------------------------------
    // Aísla visualmente el estado y sus flechas de entrada/salida.
    const sv = $('svg');
    sv.onmouseover = (e) => {
      const n = e.target.closest('.nd');
      sv.classList.remove('hov');
      $$('.h', sv).forEach((x) => x.classList.remove('h'));
      if (!n) return;
      const u = n.dataset.u;
      sv.classList.add('hov');
      n.classList.add('h');
      $$('.ed', sv).forEach((x) => {
        if (x.dataset.a === u || x.dataset.b === u) {
          x.classList.add('h');
          $('n' + x.dataset.a).classList.add('h');
          $('n' + x.dataset.b).classList.add('h');
        }
      });
    };
    sv.onmouseleave = () => sv.classList.remove('hov');

    info(m, g);
    tabla(m, g);
    ss = null; //                       se borra cualquier simulación anterior
    $('simout').innerHTML = '';
  }

  // Panel lateral con datos del autómata: tipo, estados, finales, ER, etc.
  function info(m, g) {
    const D = C.DEFS[$('aut').value];
    const eps = tipo === 'afnd' ? m.nfa.trans.filter((t) => t.sym === null).length : 0; // cantidad de flechas ε
    $('info').innerHTML =
      `<h3>${esc(D.nombre)}</h3><dl class="kv"><dt>Tipo</dt><dd>${tipo.toUpperCase()}</dd><dt>Estados</dt><dd>${g.N}</dd><dt>Inicial</dt><dd>${nm(g.ini)}</dd><dt>Finales</dt><dd>${[...g.fi].map(nm).join(', ')}</dd>\n ` +
      `<dt>Transiciones</dt><dd>${tipo === 'afnd' ? m.nfa.trans.length + ` (${eps} ε)` : g.ed.reduce((s, e) => s + e.ls.length, 0)}</dd><dt>Alfabeto</dt><dd>${m.atomos.join(', ')}</dd>` +
      // "Estados mínimos" usa C.minimizar (afd.js); solo aplica al AFD
      `${tipo === 'afd' ? `<dt>Estados mínimos</dt><dd>${C.minimizar(m)}</dd>` : ''}</dl>\n ` +
      `<details open><summary>Expresión regular</summary><pre>${esc(D.er)}</pre></details><p class="sm mut">Estado inicial en azul, finales con doble círculo verde, y en rojo discontinuo los estados desde los que no se alcanza ningún final. Pasa el cursor sobre un estado para aislar sus transiciones.</p>`;
  }

  // Tabla de transiciones (filas = estados, columnas = símbolos; en el AFND se añade ε).
  function tabla(m, g) {
    const at = m.atomos;
    const columnas = tipo === 'afnd' ? [...at, 'ε'] : at;

    // Contenido de una celda: a qué estado(s) va el estado u con el símbolo a.
    const celda = (u, a) => {
      const destinos = g.ed.filter((e) => e.a === u && e.ls.includes(a)).map((e) => nm(e.b));
      return destinos.length ? (tipo === 'afnd' ? '{' + destinos.join(', ') + '}' : destinos[0]) : '—';
    };

    let h = `<table><thead><tr><th>Estado</th>${columnas.map((a) => `<th class="${a === 'ε' ? 'me' : ''}">${a}</th>`).join('')}</tr></thead><tbody>`;
    for (let u = 0; u < g.N; u++) {
      const esFinal = g.fi.has(u);
      h +=
        `<tr><td class="m">${u === g.ini ? '<span class="mk" title="inicial">→</span> ' : ''}` +
        `${esFinal ? '<span class="mf" title="final">*</span> ' : ''}` +
        `${!esFinal && g.muerto(u) ? '<span class="md" title="sin salida a un final">✗</span> ' : ''}${nm(u)}</td>` +
        `${columnas.map((a) => `<td class="m ${a === 'ε' ? 'me' : ''}">${celda(u, a)}</td>`).join('')}</tr>`;
    }
    $('tabla').innerHTML = h + '</tbody></table>';
  }

  // ---------------------------------------------------------------------------
  // marca(): resalta en el dibujo el PASO actual de la simulación.
  //   AFD : un solo estado activo por paso; los anteriores quedan como "rastro".
  //   AFND: varios estados activos a la vez (el conjunto S de cada paso).
  // ---------------------------------------------------------------------------
  const marca = () => {
    if (!ss) return;
    const sv = $('svg');
    $$('.on,.trail,.used', sv).forEach((x) => x.classList.remove('on', 'trail', 'used')); // limpiar
    const p = ss.sets; // p[i] = lista de estados activos después de leer i caracteres

    if (tipo === 'afd') {
      for (let i = 0; i <= paso && i < p.length; i++) {
        const n = $('n' + p[i][0]);
        n.classList.add(i === paso ? 'on' : 'trail');
        if (i > 0) {
          const e = $(`e${p[i - 1][0]}-${p[i][0]}`); // la flecha recorrida
          e && e.classList.add('used');
        }
      }
    } else {
      const previo = paso > 0 ? new Set(p[paso - 1]) : null;
      p[paso].forEach((u) => $('n' + u).classList.add('on'));
      if (paso > 0) {
        $$('.ed', sv).forEach((e) => {
          if (previo.has(+e.dataset.a) && p[paso].includes(+e.dataset.b)) e.classList.add('used');
        });
      }
    }

    // Texto explicativo del paso: carácter leído, su clase y estado(s) alcanzado(s).
    const k = ss.txt[paso - 1];
    const cl = k && C.clase(k, modelo().atomos);
    $('sstep').textContent =
      paso === 0
        ? 'Inicio: estado inicial' + (tipo === 'afnd' ? ' y su cierre ε' : '')
        : `Paso ${paso} de ${ss.txt.length}: «${k}» (clase ${cl}) → ${p[paso].map(nm).join(', ')}`;
    const a = $('n' + p[paso][0]);
    a && a.scrollIntoView({ block: 'nearest', inline: 'center' });
  };

  // ---------------------------------------------------------------------------
  // Botón "Simular": ejecuta el autómata sobre la cadena escrita.
  //   AFD : usa C.simular (simulacion.js) -> una ruta de estados.
  //   AFND: repite a mano  S = cierre(mover(S, clase))  para poder mostrar el
  //         conjunto de estados de cada paso, y C.simularAFND para el veredicto.
  // ---------------------------------------------------------------------------
  $('sim').onclick = () => {
    const m = modelo();
    const txt = $('cad').value;
    let sets, acepta, motivo = '';

    if (tipo === 'afd') {
      const r = C.simular(m, txt);
      sets = r.ruta.map((q) => [q]); // cada paso = un solo estado
      acepta = r.acepta;
      motivo = r.motivo;
    } else {
      let S = C.cierre(m.nfa, new Set([m.nfa.inicio]));
      sets = [[...S]];
      for (const ch of txt) {
        const a = C.clase(ch, m.atomos);
        if (!a) {
          motivo = `el símbolo «${ch}» no pertenece al alfabeto`;
          break;
        }
        S = C.cierre(m.nfa, C.mover(m.nfa, S, a));
        if (!S.size) {
          motivo = 'el conjunto de estados quedó vacío';
          break;
        }
        sets.push([...S]);
      }
      acepta = C.simularAFND(m, txt);
      if (!acepta && !motivo) motivo = 'no se alcanzó el estado de aceptación';
    }

    ss = { sets, txt };
    paso = sets.length - 1; //          se muestra el último paso alcanzado
    ss.txt = txt.slice(0, paso); //     solo los caracteres realmente leídos

    $('simout').innerHTML =
      `<div class="res ${acepta ? 'ok' : 'bad'}"><div class="hd">${ic(acepta ? 'check' : 'x')}${tipo.toUpperCase()} ${acepta ? 'acepta' : 'rechaza'} la cadena<span class="badge">${esc(motivo)}</span></div>` +
      `<div class="bd"><div class="tiles">${tiles(txt, m.atomos)}</div><div class="top2"><button class="ib" id="pa" aria-label="Paso anterior">‹</button><button class="ib" id="ps" aria-label="Paso siguiente">›</button><span id="sstep" class="sm mut"></span></div></div></div>`;
    $('pa').onclick = () => {
      paso = Math.max(0, paso - 1);
      marca();
    };
    $('ps').onclick = () => {
      paso = Math.min(sets.length - 1, paso + 1);
      marca();
    };
    marca();
    toast(`${tipo.toUpperCase()}: ${acepta ? 'cadena aceptada' : 'cadena rechazada'}`);
  };

  // --- Zoom del dibujo (+, −, ajustar) ---------------------------------------
  const aplicarZoom = (z) => {
    zoom = Math.max(0.2, Math.min(2.5, z));
    const s = $('svg');
    if (s) {
      const v = s.viewBox.baseVal;
      s.setAttribute('width', v.width * zoom);
      s.setAttribute('height', v.height * zoom);
    }
  };
  $('zp').onclick = () => aplicarZoom(zoom * 1.25);
  $('zm').onclick = () => aplicarZoom(zoom / 1.25);
  $('zf').onclick = () => {
    const v = $('svg').viewBox.baseVal;
    aplicarZoom(Math.min(1, ($('svgbox').clientWidth - 4) / v.width));
  };

  // --- Controles del laboratorio ------------------------------------------------
  // Desplegable con todos los autómatas (correo y reglas de contraseña).
  $('aut').innerHTML = Object.keys(C.DEFS)
    .map((k) => `<option value="${k}">${esc(C.DEFS[k].nombre)}</option>`)
    .join('');
  $('aut').onchange = () => {
    dibujar();
    $('zf').onclick();
  };
  // Botones AFD / AFND
  $$('.seg button').forEach(
    (b) =>
      (b.onclick = () => {
        tipo = b.dataset.t;
        $$('.seg button').forEach((x) => x.classList.toggle('on', x === b));
        dibujar();
        $('zf').onclick();
      })
  );

  // ===========================================================================
  // 7) PANTALLA INICIO Y ARRANQUE
  // ===========================================================================
  // Tarjetas de estadísticas leídas de los autómatas ya construidos.
  const inicioEstadisticas = () => {
    const m = C.M;
    const k = Object.keys(m);
    $('stats').innerHTML = [
      [k.length, 'autómatas compilados al abrir la aplicación'],
      [`${m.correo.d.length} / ${m.correo.nfa.n}`, 'estados del AFD y del AFND del correo'],
      [C.CONJ.C_p.length, 'caracteres permitidos en una contraseña'],
    ]
      .map(([a, b]) => `<div class="card stat"><b>${a}</b><span>${b}</span></div>`)
      .join('');
  };

  // Ejemplo real: un correo evaluado por el AFD, mostrando su ruta de estados.
  const EJEMPLO = 'juan.perez@unis.edu.gt';
  const rutaEjemplo = C.simular(C.M.correo, EJEMPLO);
  $('demo').innerHTML = tiles(EJEMPLO, ALFA_CORREO);
  $('demo').insertAdjacentHTML('afterend', LEYENDA);
  $('demoRuta').textContent = `Ruta del AFD: ${rutaEjemplo.ruta.map(nm).join(' → ')} · ${rutaEjemplo.acepta ? 'acepta' : 'rechaza'}`;
  $('demoGo').onclick = () => {
    $('c').value = EJEMPLO;
    ir('validar', 'c');
    $('vc').click();
  };

  inicioEstadisticas();
  ir('inicio'); // pantalla inicial
})();
