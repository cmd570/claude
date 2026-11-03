# 🎳 Bowling

Juego de **bowling (boliche) de diez pinos** en un único archivo HTML. Sin dependencias,
sin servidor y sin recursos externos: abre `index.html` en cualquier navegador moderno
(PC o móvil) y juega.

## Características

- **Física real en 2D** con vista pseudo-3D: dimensiones oficiales USBC de la pista
  (41,5 in de ancho, 60 ft hasta el pino 1, pinos a 12 in), bola de 15 lb, pinos de
  3 lb 6 oz, colisiones por impulso con restitución y fricción, canales, paredes
  laterales (*kickbacks*) y foso.
- **Efecto (gancho)**: la bola curva más al final de la pista, como en una pista aceitada.
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
| `←` `→` | Mover la bola a los lados. |
| `↑` `↓` | Ajustar el ángulo del tiro. |
| `A` `D` (o los botones ↶ ↷) | Efecto hacia la izquierda o la derecha. |
| `Espacio` / `Enter` | Arranca el medidor de potencia; vuelve a pulsar para lanzar. |
| `M` | Silenciar / activar el sonido. |
| `?` | Ayuda. |

Consejo: apunta al «bolsillo» entre el pino 1 y el 3 (o el 1 y el 2) con buena velocidad.
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
index.html   El juego completo (HTML + CSS + JS). Contiene cuatro bloques <script>:
             scoring (marcador), physics (simulación), audio (sonido) y main (juego).
tests/       Pruebas: scoring.test.js (unitarias, Node) y e2e.test.js (Playwright).
```

La simulación física y el marcador no dependen del DOM, por eso se prueban en Node
directamente sobre el código embebido en `index.html`.

## Pruebas

Requiere Node.js 20 o superior. Las pruebas de extremo a extremo usan
[Playwright](https://playwright.dev) con Chromium y se omiten si no está instalado.

```bash
npm test
```

Solo las pruebas unitarias del marcador:

```bash
node --test tests/scoring.test.js
```

## API de depuración

En la consola del navegador, `window.__bowling` expone utilidades para pruebas
automáticas: `start(nombres)`, `throwBall({x, power, angle, spin})`, `applyRoll(n)`
(aplica un tiro sin física), `setFast(true)` y `state()`.
