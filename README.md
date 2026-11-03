# 🎳 Bowling

Juego de **bowling de diez bolos** en un único archivo HTML. Sin dependencias,
sin servidor y sin recursos externos: abre `index.html` en cualquier navegador moderno
(PC o móvil) y juega.

## Características

- **Física 3D de cuerpos rígidos** escrita desde cero: los bolos son cuerpos con
  orientación e inercia que vuelcan, vuelan, giran y rebotan en las paredes y el foso;
  la bola patina, gancha y rueda por fricción de Coulomb real con el aceite de la
  pista (patrón de 42 ft) y la madera seca del final. Dimensiones oficiales USBC
  (41,5 in de ancho, 60 ft hasta el bolo 1, bolos a 12 in, canales de 9,25 in,
  foso a 62 ft 10 3/16 in), bola de 15 lb, bolos de 3 lb 6 oz.
- **Renderizado WebGL propio** (sin librerías): iluminación física (GGX/Fresnel),
  sombras suaves, reflejos planares de la pista aceitada, madera, bola de resina y
  bolos generados proceduralmente, foco sobre la zona de bolos, tono ACES y FXAA.
  Si WebGL no está disponible se usa una vista cenital 2D sencilla.
- **Efecto (gancho)**: el giro de la bola y la fricción hacen que patine en el aceite y
  curve en la zona seca, con el ángulo de entrada de una bola real.
- **Pinsetter**: la barra recoge la madera caída y la empuja al foso; los bolos en pie
  se elevan y vuelven a su marca; el rack nuevo baja desde arriba.
- **Marcador oficial**: strikes, spares, bonos, cuadro 10 con tiros extra, máximo 300.
  Los totales acumulados aparecen solo cuando ya se conocen (como en un marcador real).
- **1 a 4 jugadores** por turnos, con nombres.
- **Controles táctiles, de ratón y de teclado.**
- **Sonido sintetizado** con Web Audio (rodar de la bola, choques, strike, spare, canal).
- **Récord personal** guardado en el dispositivo (`localStorage`).
- Accesible: se puede jugar solo con teclado, mensajes en `aria-live`, respeta
  `prefers-reduced-motion`.

## Cómo jugar

| Control | Acción |
| --- | --- |
| Toque / ratón | Toca la pista para colocar la bola, **arrastra hacia arriba y suelta** para lanzar. Más velocidad de gesto = más fuerza; la inclinación del gesto marca la dirección. |
| `←` `→` | Mover la bola a los lados (con `Mayús`, más rápido). |
| `↑` `↓` | Ajustar el ángulo del tiro. |
| `A` `D` (o los botones ↶ ↷) | Efecto hacia la izquierda o la derecha. |
| `Espacio` / `Enter` | Arranca el medidor de potencia; vuelve a pulsar para lanzar. Mientras rueda la bola: acelera; después: salta la recogida. |
| `R` | Repite el último tiro (misma posición, fuerza y efecto). |
| Toque en la pista durante la jugada | Acelera la bola y salta el mensaje y la recogida. |
| `M` | Silenciar / activar el sonido. |
| `?` | Ayuda. |

Consejo: apunta al «bolsillo» entre el bolo 1 y el 3 (o el 1 y el 2) con buena velocidad.
A potencia máxima el tiro pierde algo de precisión (riesgo y recompensa).
Una bola con efecto que entra en el bolsillo contrario al sentido del gancho consigue
más strikes, igual que en la vida real.

## Puntuación

- **Strike** (`X`): 10 + los dos tiros siguientes.
- **Spare** (`/`): 10 + el tiro siguiente.
- **Cuadro 10**: un strike o un spare dan derecho a un tercer tiro.
- Partida perfecta: 300 puntos.

## Estructura

```
index.html   El juego completo (HTML + CSS + JS). Contiene cinco bloques <script>:
             scoring (marcador), physics (simulación 3D), audio (sonido),
             gl (renderizador WebGL) y main (juego).
tests/       Pruebas: scoring.test.js y physics.test.js (unitarias, Node) y e2e.test.js (Playwright).
```

La simulación física y el marcador no dependen del DOM, por eso se prueban en Node
directamente sobre el código embebido en `index.html`.

## Pruebas

Requiere Node.js 20 o superior. Las pruebas de extremo a extremo usan
[Playwright](https://playwright.dev) con Chromium y se omiten si no está instalado.

```bash
npm test
```

Solo las pruebas unitarias (marcador y física):

```bash
node --test tests/scoring.test.js tests/physics.test.js
```

## API de depuración

En la consola del navegador, `window.__bowling` expone utilidades para pruebas
automáticas: `start(nombres)`, `throwBall({x, power, angle, spin})`, `applyRoll(n)`
(aplica un tiro sin física), `setFast(true)`, `setSeed(n)`, `skip()`, `state()`,
`lastThrow()`, `renderer()` (el renderizador WebGL) y `freezeCamera(ojo, objetivo)`.
