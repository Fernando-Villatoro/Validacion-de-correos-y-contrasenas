# Guía de estudio — Validador Léxico de Credenciales Seguras

Guía para entender el proyecto y prepararse para la exposición. Está escrita en lenguaje sencillo; cada archivo de código también está comentado.

## 1. La idea general en una frase
> Describimos qué es un correo o una contraseña válida con **expresiones regulares**; el programa las convierte en **autómatas** y usa esos autómatas para **validar** y para **generar** credenciales.

## 2. El recorrido completo (de la ER al resultado)

```
 Expresión regular  ──►  Árbol  ──►  AFND  ──►  AFD  ──►  Simular / Generar
   (texto)            parser     Thompson   subconjuntos   (validador / generador)
 configuracion.js  parser-regex.js thompson.js   afd.js     simulacion.js, validador.js, generador.js
                                                  └──── compilador.js los une y guarda en C.M ────┘
```

| Paso | Archivo | Qué hace | Entrada → salida |
|---|---|---|---|
| 0 | `nucleo/configuracion.js` | Define el alfabeto (clases L, l, D, P, A, G, S_e, S_p, C_p) y las ER | — → texto de ER |
| 1 | `nucleo/parser-regex.js` | Lee la ER y arma un árbol (`sym`, `alt`, `cat`, `star`) | texto → árbol |
| 2 | `nucleo/thompson.js` | **Algoritmo de Thompson**: pega "piezas" para obtener un AFND con transiciones ε | árbol → AFND |
| 3 | `nucleo/afd.js` | **Construcción de subconjuntos** (con `cierre` ε y `mover`): quita el no determinismo | AFND → AFD |
| 4 | `nucleo/simulacion.js` | Recorre un autómata con una cadena y dice si acepta o rechaza | AFD/AFND + texto → sí/no + ruta |
| 5 | `nucleo/compilador.js` | Ejecuta los pasos 1-3 para cada ER y guarda todo en `C.M` | definición → modelo |
| 6 | `credenciales/validador.js` | Usa los AFD para validar y arma el reporte por reglas | texto → reporte |
| 7 | `credenciales/generador.js` | Camina por el AFD eligiendo flechas al azar para construir credenciales | AFD → texto válido |
| 8 | `interfaz/app.js` | Pantallas, botones, dibujo de autómatas | — |

## 3. Expresiones regulares (lo esencial)
Operadores usados: `|` unión (o), `·` concatenación (seguido de), `*` repetir 0 o más veces, `( )` agrupar.

Ejemplo de correo (resumen):
`(parte local) @ (dominio) . (TLD)`  →  `V·V*·(P·V·V*)*  ·A·  dominio  ·P·C·C·C*`
- Los puntos solo pueden ir **entre** caracteres (nunca al inicio, al final ni dos seguidos).
- El TLD (`com`, `gt`…) debe tener **al menos 2 letras** (`P·C·C·C*`).

Contraseña: cada regla tiene su propio autómata (longitud ≥ 12, una mayúscula, una minúscula, un dígito, un símbolo). Ejemplo "al menos una mayúscula": `(L|l|D|S_p)*·L·(L|l|D|S_p)*` ("cualquier cosa, una mayúscula, cualquier cosa").

## 4. Algoritmo de Thompson (con ejemplo real del programa)
Cada operador tiene una "pieza". Para `L|l` (unión) el programa genera 6 estados:

```
estado 4 ──ε──► 0 ──L──► 1 ──ε──► 5
   │                              ▲
   └────ε──► 2 ──l──► 3 ──ε───────┘
inicio = 4,  aceptación = 5
```
Para `L·D*` se une una pieza `L` con una pieza `D*` por una ε, y la estrella agrega las ε que permiten repetir `D` cero o más veces (volver atrás y saltarse). Todo está en `thompson.js`; los comentarios muestran cada pieza.

**Frase para la exposición:** *"Thompson construye el AFND por partes, siguiendo la estructura del árbol; cada parte tiene un solo inicio y un solo final, y se pegan con transiciones ε."*

## 5. De AFND a AFD (subconjuntos)
- **cierre ε(S)**: estados a los que llego desde S sin leer nada.
- **mover(S, a)**: estados a los que llego desde S leyendo `a`.
- Cada estado del AFD es **un conjunto** de estados del AFND. Se empieza con `cierre({inicio})` y, para cada símbolo `a`, se calcula `cierre(mover(S, a))`.
- Un estado del AFD es **de aceptación** si su conjunto contiene el estado de aceptación del AFND.

Mismo ejemplo `L|l`: el estado inicial del AFD es `{0,2,4}`; con `L` va a `{1,5}` (final) y con `l` va a `{3,5}` (final).

## 6. Simulación (validar)
`simular(m, texto)` empieza en `q0`, y por cada carácter: lo convierte a su **clase** (`clase('k') = 'l'`) y sigue la flecha `d[estado][clase]`. Rechaza si el carácter no es del alfabeto, si no hay flecha, o si termina en un estado que no es final. Devuelve también la **ruta** de estados (`q0 → q1 → …`) que se ve en el "detalle técnico".
`simularAFND` hace lo mismo manteniendo un **conjunto** de estados; sirve para demostrar que AFND y AFD aceptan lo mismo (pruebas `EQV-*`).

## 7. Validar credenciales
- **Correo**: lo decide únicamente el AFD de `C.M.correo`. Si lo rechaza, `diagnostico.js` solo **explica** la causa (falta @, dos puntos seguidos, TLD de una letra…).
- **Contraseña**: pasa por 5 AFD (longitud, mayúscula, minúscula, dígito, símbolo) + reglas "adicionales" que no se escriben bien como ER (máximo 64, sin espacios, sin 3 iguales seguidas, sin secuencias abc/123, sin palabras prohibidas).
- **Nivel** (`seguridad.js`): baja / media / fuerte, independiente de la validez.

## 8. Generar credenciales (recorrido del AFD)
Se camina por el AFD desde `q0`: se elige una flecha, se escribe un carácter de esa clase y se avanza; se puede parar al estar en un estado final. Para el correo se calcula antes la **distancia de cada estado a un final** para no meterse en caminos sin salida. Para la contraseña se avanzan los 5 AFD a la vez y se prioriza la clase que falta. Todo resultado se **revalida** con el validador.

## 9. Posibles preguntas de la exposición
1. *¿Por qué usar clases (L, l, D…) y no cada carácter?* → autómatas mucho más pequeños y legibles.
2. *¿Para qué sirven las transiciones ε?* → permiten pegar piezas de Thompson sin consumir caracteres.
3. *¿Por qué hay que pasar a AFD?* → es determinista: un solo camino por cadena, simple y rápido de simular.
4. *¿Cómo sabes que están bien construidos?* → pruebas `EQV` (AFND ≡ AFD) y `DOC-01` (igual al AFD hecho a mano del documento).
5. *¿Qué pasa con el estado "muerto"?* → no se dibuja: la ausencia de flecha equivale a rechazar.
6. *¿Qué reglas NO decide un autómata?* → las "adicionales" (máximo 64, 3 iguales, secuencias, palabras prohibidas, espacios).
7. *¿Dónde cambio una regla?* → solo en `nucleo/configuracion.js`; todo se reconstruye solo.

## 10. Cómo ejecutar
```bash
npm install     # una vez
npm start       # abre la aplicación de escritorio
npm test        # 98 pruebas del núcleo (no necesita Electron: solo Node)
```
Para ver la interfaz sin Electron también se puede abrir `app/index.html` en un navegador.
