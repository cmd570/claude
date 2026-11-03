'use strict';
/*
 * Pruebas de la simulación física 3D (bloque <script id="physics"> de index.html),
 * ejecutadas en Node sin navegador. Comprueban invariantes y, con tiros
 * sembrados, que el comportamiento se parezca al bowling real.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadPhysics() {
  const html = fs.readFileSync(process.env.BOWLING_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="physics">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No se encontró <script id="physics"> en index.html');
  const factory = new Function('module', m[1] + '\nreturn BowlingPhysics;');
  return factory({ exports: {} });
}
const P = loadPhysics();
const { LANE, SIM } = P;
const len = (v) => Math.hypot(v[0], v[1], v[2]);

function rate(opts, n, seed0) {
  let strikes = 0, sum = 0; const leaves = [];
  for (let s = 0; s < n; s++) {
    const r = P.simulateThrow(Object.assign({}, opts, { x: opts.x + ((s % 5) - 2) * 0.006, speed: opts.speed + ((s % 3) - 1) * 0.15 }), (seed0 || 100) + s * 7);
    sum += r.knocked; if (r.knocked === 10) strikes++;
    leaves.push(r.standingIds);
  }
  return { strike: strikes / n, avg: sum / n, leaves };
}

test('dimensiones reales de la pista (USBC)', () => {
  assert.ok(Math.abs(LANE.width - 1.0541) < 1e-3);
  assert.ok(Math.abs(LANE.headPinZ - 18.288) < 1e-3);
  assert.ok(Math.abs(LANE.pinSpacing - 0.3048) < 1e-3);
  assert.ok(Math.abs(LANE.gutter - 0.2349) < 1e-3);
  assert.ok(Math.abs(LANE.pitZ - 19.156) < 2e-3, 'borde del foso a 62 ft 10 3/16 in');
  const rack = P.rackPositions();
  assert.equal(rack.length, 10);
  assert.deepEqual(rack.map((p) => p.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(rack.every((p) => Math.abs(p.x) + P.PIN.beltRadius < LANE.halfWidth), 'todos los bolos caben en la pista');
});

test('determinismo: misma semilla, mismo resultado', () => {
  const a = P.simulateThrow({ x: 0.07, speed: 8, angle: 0, spin: 0 }, 42);
  const b = P.simulateThrow({ x: 0.07, speed: 8, angle: 0, spin: 0 }, 42);
  assert.deepEqual(a, b);
});

test('los bolos en pie son estables sin que nadie los toque', () => {
  const w = P.createWorld(1);
  P.step(w, 2);
  for (const p of w.pins) {
    assert.ok(P.isStanding(p), `bolo ${p.id} sigue en pie`);
    assert.ok(Math.abs(p.p[0] - p.homeX) < 1e-6 && Math.abs(p.p[2] - p.homeZ) < 1e-6, 'no se mueve');
  }
});

test('todos los tiros terminan, sin NaN y dentro de los límites', () => {
  const rnd = P.rng(7);
  for (let i = 0; i < 25; i++) {
    const opts = { x: (rnd() - 0.5) * 1.0, speed: 4.5 + rnd() * 5.1, angle: (rnd() - 0.5) * 0.1, spin: (rnd() - 0.5) * 2 };
    const w = P.createWorld(1000 + i);
    P.throwBall(w, opts);
    P.step(w, SIM.maxTime + 1);
    assert.equal(w.finished, true, `el tiro ${i} debe terminar`);
    assert.ok(w.time <= SIM.maxTime + 0.01, 'dentro del tope de tiempo');
    for (const p of w.pins) {
      assert.ok(p.p.every(Number.isFinite), 'coordenadas finitas');
      assert.ok(Math.abs(p.p[0]) <= LANE.kickbackX + 0.12, `bolo ${p.id} dentro de las paredes (x=${p.p[0].toFixed(2)})`);
      assert.ok(p.p[2] <= LANE.endZ + 0.12, 'no atraviesa el cojín del foso');
      assert.ok(p.p[1] > -LANE.pitDepth - 0.2, 'no atraviesa el suelo del foso');
    }
    assert.ok(w.ball.p.every(Number.isFinite));
  }
});

test('un tiro al bolsillo suele ser strike; de frente suele dejar split', () => {
  const pocket = rate({ x: 0.07, speed: 8, angle: 0, spin: 0 }, 15);
  assert.ok(pocket.strike >= 0.6, `bolsillo derecho: ${pocket.strike}`);
  const pocketL = rate({ x: -0.07, speed: 8, angle: 0, spin: 0 }, 15);
  assert.ok(pocketL.strike >= 0.6, `bolsillo izquierdo: ${pocketL.strike}`);
  const head = rate({ x: 0, speed: 8, angle: 0, spin: 0 }, 15);
  assert.ok(head.strike <= 0.45, `de frente: ${head.strike}`);
  const sides = head.leaves.filter((ids) => ids.length >= 2 && ids.some((id) => [4, 7, 8].includes(id)) && ids.some((id) => [6, 9, 10].includes(id))).length;
  assert.ok(sides >= 3, `bolos a ambos lados de frente: ${sides}/15`);
});

test('una bola desviada derriba pocos bolos', () => {
  const off = rate({ x: 0.3, speed: 8, angle: 0, spin: 0 }, 10);
  assert.ok(off.avg >= 2 && off.avg <= 8, `desviada: ${off.avg}`);
  const far = rate({ x: 0.47, speed: 8, angle: 0, spin: 0 }, 8);
  assert.ok(far.avg <= 6, `muy desviada: ${far.avg}`);
});

test('la bola en el canal no derriba bolos y queda hundida', () => {
  const g = P.simulateThrow({ x: 0.5, speed: 8, angle: 2 * Math.PI / 180, spin: 0 }, 5);
  assert.equal(g.gutter, true);
  assert.equal(g.knocked, 0);
  const w = P.createWorld(5);
  P.throwBall(w, { x: 0.5, speed: 8, angle: 2 * Math.PI / 180, spin: 0, exact: true });
  P.step(w, 1.5);
  assert.ok(w.ball.inGutter && w.ball.p[1] < P.BALL.radius - 0.02, 'la bola rueda por debajo del nivel de la pista');
});

test('el efecto hace curvar la bola al final de la pista (patina, gancha, rueda)', () => {
  const path = (spin, speed) => {
    const w = P.createWorld(1, []);
    P.throwBall(w, { x: 0, speed, angle: 0, spin, exact: true });
    let xMid = null;
    while (!w.finished && w.ball.p[2] < LANE.headPinZ && w.time < 8) { P.stepOnce(w, SIM.dt); if (xMid == null && w.ball.p[2] >= 10) xMid = w.ball.p[0]; }
    return { x: w.ball.p[0], xMid, angle: Math.atan2(w.ball.v[0], w.ball.v[2]) * 180 / Math.PI, speed: Math.hypot(w.ball.v[0], w.ball.v[2]), rolling: w.ball.rolling };
  };
  const straight = path(0, 8);
  assert.ok(Math.abs(straight.x) < 0.01, 'sin efecto va recta');
  assert.ok(straight.speed > 6 && straight.speed < 7.6, `pierde algo de velocidad (${straight.speed.toFixed(2)})`);
  const hook = path(1, 8);
  assert.ok(hook.x > 0.25 && hook.x < 0.8, `con efecto +1 se desplaza a la derecha (${hook.x.toFixed(2)} m)`);
  assert.ok(hook.angle > 3 && hook.angle < 8, `ángulo de entrada realista (${hook.angle.toFixed(1)}°)`);
  assert.ok(Math.abs(hook.xMid) < hook.x * 0.4, 'la mayor parte del gancho ocurre en la zona seca');
  const left = path(-1, 8);
  assert.ok(Math.abs(left.x + hook.x) < 0.02, 'el efecto negativo es simétrico');
  const half = path(0.5, 8);
  assert.ok(half.x > 0.1 && half.x < hook.x, 'medio efecto gancha menos');
});

test('la bola gira como un cuerpo real: rueda sin deslizar al llegar a los bolos', () => {
  const w = P.createWorld(1, []);
  P.throwBall(w, { x: 0, speed: 8, angle: 0, spin: 0, exact: true });
  while (!w.finished && w.ball.p[2] < LANE.headPinZ && w.time < 8) P.stepOnce(w, SIM.dt);
  const b = w.ball;
  const slip = Math.abs(b.v[2] - b.w[0] * b.r);
  assert.ok(slip < 0.1, `deslizamiento residual pequeño (${slip.toFixed(3)} m/s)`);
});

test('segundo tiro sobre los bolos que quedaron en pie', () => {
  const first = P.simulateThrow({ x: 0.3, speed: 7, angle: 0, spin: 0 }, 11);
  assert.ok(first.knocked < 10 && first.knocked > 0, `primer tiro deja bolos (${first.knocked})`);
  const rack = Object.fromEntries(P.rackPositions().map((p) => [p.id, p]));
  const standing = first.standing.map((p) => ({ id: p.id, x: rack[p.id].x, z: rack[p.id].z }));
  const target = standing[0];
  const second = P.simulateThrow({ x: target.x, speed: 8, angle: 0, spin: 0 }, 12, standing);
  assert.ok(second.knocked <= standing.length, 'no derriba más de los que quedaban');
  assert.ok(second.standingIds.every((id) => first.standingIds.includes(id)), 'los que quedan ya estaban en pie');
  assert.ok(second.knocked >= 1, 'apuntando a un bolo en pie derriba al menos uno');
});

test('la velocidad y el ángulo de salida se limitan a un rango jugable', () => {
  const w = P.createWorld(3);
  P.throwBall(w, { x: 0, speed: 100, angle: 0, spin: 0, exact: true });
  assert.ok(Math.hypot(w.ball.v[0], w.ball.v[2]) <= SIM.maxSpeed + 1e-9);
  P.throwBall(w, { x: 0, speed: 0.1, angle: 0, spin: 0, exact: true });
  assert.ok(Math.hypot(w.ball.v[0], w.ball.v[2]) >= SIM.minSpeed - 1e-9);
  P.throwBall(w, { x: 5, speed: 8, angle: 1, spin: 0, exact: true });
  assert.ok(Math.abs(w.ball.p[0]) < LANE.halfWidth, 'la posición se limita a la pista');
  assert.ok(Math.abs(Math.atan2(w.ball.v[0], w.ball.v[2])) <= SIM.maxAngle + 1e-9, 'el ángulo se limita');
  P.throwBall(w, { x: NaN, speed: NaN, angle: NaN, spin: NaN });
  P.step(w, SIM.maxTime + 1);
  assert.equal(w.finished, true, 'parámetros inválidos no cuelgan la simulación');
});

test('la trayectoria prevista coincide con la simulación real (sin bolos)', () => {
  const pts = P.predictPath({ x: -0.2, speed: 8, angle: 0, spin: 1 }, LANE.headPinZ);
  assert.ok(pts.length > 10);
  const last = pts[pts.length - 1];
  const w = P.createWorld(1, []);
  P.throwBall(w, { x: -0.2, speed: 8, angle: 0, spin: 1, exact: true });
  while (!w.finished && w.ball.p[2] < last.z && w.time < 8) P.stepOnce(w, SIM.dt);
  assert.ok(Math.abs(w.ball.p[0] - last.x) < 0.03, `guía y física coinciden (${w.ball.p[0].toFixed(3)} vs ${last.x.toFixed(3)})`);
});
