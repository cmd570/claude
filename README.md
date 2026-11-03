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
- **Renderizado WebGL propio** (sin librerías) con iluminación física: luces lineales
  (tiras LED del techo y foco del pin deck) con reflejos alargados reales (método del
  punto representativo), sombras suaves, reflejo planar de la pista aceitada con
  Fresnel, bloom, tono ACES, FXAA y grano. La pista tiene arce en las cabeceras y
  en la zona de bolos, pino en el centro, juntas a tope por tabla, flechas, puntos,
  marcas de rango, pin deck sintético oscuro con marcas blancas, y un patrón de
  aceite de casa (más grueso en el centro, buffer y cola seca) que cambia el brillo.
- **Bolos con el perfil oficial USBC** (15 estaciones interpoladas, corona de 1,273 in),
  dos franjas rojas en el cuello, corona del fabricante, desgaste de la línea de bola y
  laca brillante; **bola de resina perlada** con escamas que destellan y agujeros.
- **Sala completa**: canales, capping entre pistas, retorno de bolas con dos bolas en
  el bastidor, kickbacks con placas, unidades de enmascaramiento de vídeo que muestran
  el jugador, el cuadro y el tiro (y «¡STRIKE!»), dos pistas vecinas con sus bolos,
  luminarias, fascia y sala de máquinas.
- **Pinsetter animado como el real**: la barra baja a la posición de guarda cuando la
  bola entra en el foso, la mesa desciende, eleva los bolos en pie, la barra empuja la
  madera caída al foso, la mesa vuelve a dejar los bolos en su marca (o baja con un
  rack nuevo colgado de las copas) y todo sube de nuevo.
- **Repetición a cámara lenta**: tras un strike, la jugada se repite desde la cámara
  lateral de los bolos (como en televisión); se puede saltar con un toque.
- **Efecto (gancho)**: el giro de la bola y la fricción hacen que patine en el aceite y
  curve en la zona seca, con el ángulo de entrada de una bola real.
- **Marcador oficial**: strikes, spares, bonos, cuadro 10 con tiros extra, máximo 300.
  Los totales acumulados aparecen solo cuando ya se conocen (como en un marcador real).
- **1 a 4 jugadores** por turnos, con nombres.
- **Controles táctiles, de ratón y de teclado.**
- **Sonido sintetizado** con Web Audio: reverberación de sala, rodar de la bola (más
  hueco en el canal, siseo en la madera seca), crack de la bola sobre los bolos, clacks
  de madera, golpes en los kickbacks y en el foso, clank y motor del pinsetter, retorno
  de bola y ambiente de sala con strikes lejanos.
- **Calidad automática**: mide el tiempo por fotograma y ajusta resolución, bloom,
  reflejos, sombras suaves y detalle de las pistas vecinas en tres niveles.
- **Récord personal** guardado en el dispositivo (`localStorage`).
- Accesible: se puede jugar solo con teclado, mensajes en `aria-live`, respeta
  `prefers-reduced-motion` (sin cámara lenta ni repetición). Si WebGL no está
  disponible se usa una vista cenital 2D sencilla.

## Cómo jugar

| Control | Acción |
| --- | --- |
| Toque / ratón | Toca la pista para colocar la bola, **arrastra hacia arriba y suelta** para lanzar. Más velocidad de gesto = más fuerza; la inclinación del gesto marca la dirección. |
| `←` `→` | Mover la bola a los lados (con `Mayús`, más rápido). |
| `↑` `↓` | Ajustar el ángulo del tiro. |
| `A` `D` (o los botones ↶ ↷) | Efecto hacia la izquierda o la derecha. |
| `Espacio` / `Enter` | Arranca el medidor de potencia; vuelve a pulsar para lanzar. Mientras rueda la bola: acelera; después: salta la repetición o la recogida. |
| `R` | Repite el último tiro (misma posición, fuerza y efecto). |
| Toque en la pista durante la jugada | Acelera la bola y salta la repetición, el mensaje y la recogida. |
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
tests/       Pruebas: scoring.test.js, physics.test.js y render.test.js (unitarias, Node)
             y e2e.test.js (Playwright).
```

La simulación física, el marcador y la geometría del renderizador no dependen del DOM,
por eso se prueban en Node directamente sobre el código embebido en `index.html`.

## Pruebas

Requiere Node.js 20 o superior. Las pruebas de extremo a extremo usan
[Playwright](https://playwright.dev) con Chromium y se omiten si no está instalado.

```bash
npm test
```

Solo las pruebas unitarias (marcador, física y renderizador):

```bash
npm run test:unit
```

## API de depuración

En la consola del navegador, `window.__bowling` expone utilidades para pruebas
automáticas: `start(nombres)`, `throwBall({x, power, angle, spin})`, `applyRoll(n)`
(aplica un tiro sin física), `setFast(true)`, `setSeed(n)`, `setQuality(0..2)`,
`pauseLoop(true)` y `step(segundos)` (avanzan el juego de forma determinista),
`skip()`, `state()`, `lastThrow()`, `renderer()` (el renderizador WebGL),
`machine` (posición de la barra y la mesa del pinsetter) y `freezeCamera(ojo, objetivo)`.
