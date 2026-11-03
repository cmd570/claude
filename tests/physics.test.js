'use strict';
/*
 * Pruebas de la simulación física (bloque <script id="physics"> de index.html),
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
const { LANE } = P;

function rate(opts, n, seed0) {
  let strikes = 0, sum = 0; const leaves = [];
  for (let s = 0; s < n; s++) {
    const r = P.simulateThrow(opts, (seed0 || 100) + s * 7);
    sum += r.knocked; if (r.knocked === 10) strikes++;
    leaves.push(r.standingIds);
  }
  return { strike: strikes / n, avg: sum / n, leaves };
}

test('dimensiones reales de la pista (USBC)', () => {
  assert.ok(Math.abs(LANE.width - 1.0541) < 1e-3);
  assert.ok(Math.abs(LANE.headPinY - 18.288) < 1e-3);
  assert.ok(Math.abs(LANE.pinSpacing - 0.3048) < 1e-3);
  assert.ok(Math.abs(LANE.gutter - 0.2349) < 1e-3);
  const rack = P.rackPositions();
  assert.equal(rack.length, 10);
  assert.deepEqual(rack.map((p) => p.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(rack.every((p) => Math.abs(p.x) + P.PIN.radius < LANE.halfWidth), 'todos los bolos caben en la pista');
});

test('determinismo: misma semilla, mismo resultado', () => {
  const a = P.simulateThrow({ x: 0.07, speed: 8, angle: 0, spin: 0 }, 42);
  const b = P.simulateThrow({ x: 0.07, speed: 8, angle: 0, spin: 0 }, 42);
  assert.deepEqual(a, b);
});

test('todos los tiros terminan, sin NaN y dentro de los límites', () => {
  const rnd = P.rng(7);
  for (let i = 0; i < 40; i++) {
    const opts = { x: (rnd() - 0.5) * 1.0, speed: 4.5 + rnd() * 5.1, angle: (rnd() - 0.5) * 0.1, spin: (rnd() - 0.5) * 2 };
    const w = P.createWorld(1000 + i);
    P.throwBall(w, opts);
    P.step(w, 20);
    assert.equal(w.finished, true, `el tiro ${i} debe terminar`);
    assert.ok(w.time < 14.5, 'dentro del tope de tiempo');
    for (const p of w.pins) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'coordenadas finitas');
      if (p.state !== 'pit') {
        assert.ok(Math.abs(p.x) <= LANE.kickbackX + 1e-6, 'ningún bolo atraviesa las paredes');
        assert.ok(p.y <= LANE.pitY + p.r + 1e-6, 'ningún bolo más allá del foso sin estar en el foso');
      }
    }
    assert.ok(Number.isFinite(w.ball.x) && Number.isFinite(w.ball.y));
  }
});

test('un tiro al bolsillo suele ser strike; de frente suele dejar split', () => {
  const pocket = rate({ x: 0.07, speed: 8, angle: 0, spin: 0 }, 30);
  assert.ok(pocket.strike >= 0.6, `bolsillo derecho: ${pocket.strike}`);
  const pocketL = rate({ x: -0.07, speed: 8, angle: 0, spin: 0 }, 30);
  assert.ok(pocketL.strike >= 0.6, `bolsillo izquierdo: ${pocketL.strike}`);
  const head = rate({ x: 0, speed: 8, angle: 0, spin: 0 }, 30);
  assert.ok(head.strike <= 0.45, `de frente: ${head.strike}`);
  const splits = head.leaves.filter((ids) => ids.length >= 2 && ids.some((id) => [4, 7, 8].includes(id)) && ids.some((id) => [6, 9, 10].includes(id))).length;
  assert.ok(splits >= 3, `bolos a ambos lados de frente: ${splits}/30`);
});

test('una bola lenta rara vez hace strike y una bola desviada derriba pocos bolos', () => {
  const slow = rate({ x: 0.07, speed: 5, angle: 0, spin: 0 }, 20);
  assert.ok(slow.strike <= 0.3, `lenta: ${slow.strike}`);
  const off = rate({ x: 0.3, speed: 8, angle: 0, spin: 0 }, 20);
  assert.ok(off.avg >= 2 && off.avg <= 7.5, `desviada: ${off.avg}`);
  const far = rate({ x: 0.47, speed: 8, angle: 0, spin: 0 }, 20);
  assert.ok(far.avg <= 6, `muy desviada: ${far.avg}`);
});

test('la bola en el canal no derriba bolos y el canal llega hasta el foso', () => {
  const g = P.simulateThrow({ x: 0.5, speed: 8, angle: 2 * Math.PI / 180, spin: 0 }, 5);
  assert.equal(g.gutter, true);
  assert.equal(g.knocked, 0);
  // Gancho fuerte hacia fuera desde el borde: se va al canal antes de los bolos
  const late = P.simulateThrow({ x: 0.45, speed: 8, angle: 0, spin: 1 }, 5);
  assert.equal(late.gutter, true);
  assert.equal(late.knocked, 0);
});

test('el efecto curva la bola al final de la pista', () => {
  assert.ok(P.hookProfile(2) < P.hookProfile(16), 'más gancho en la zona seca');
  const straight = P.simulateThrow({ x: -0.45, speed: 8, angle: 0, spin: 0, exact: true }, 9);
  const hooked = P.simulateThrow({ x: -0.45, speed: 8, angle: 0, spin: 1, exact: true }, 9);
  assert.ok(hooked.knocked > straight.knocked, `con gancho ${hooked.knocked} > recto ${straight.knocked}`);
  const away = P.simulateThrow({ x: -0.45, speed: 8, angle: 0, spin: -1, exact: true }, 9);
  assert.equal(away.gutter, true, 'con gancho hacia fuera se va al canal');
});

test('segundo tiro sobre los bolos que quedaron en pie', () => {
  const first = P.simulateThrow({ x: 0.2, speed: 7, angle: 0, spin: 0 }, 11);
  assert.ok(first.knocked < 10 && first.knocked > 0, `primer tiro deja bolos (${first.knocked})`);
  const second = P.simulateThrow({ x: first.standing[0].x, speed: 8, angle: 0, spin: 0 }, 12, first.standing);
  assert.ok(second.knocked <= first.standing.length, 'no derriba más de los que quedaban');
  assert.ok(second.standingIds.every((id) => first.standingIds.includes(id)), 'los que quedan ya estaban en pie');
  assert.ok(second.knocked >= 1, 'apuntando a un bolo en pie derriba al menos uno');
});

test('la velocidad de salida se limita a un rango jugable', () => {
  const w = P.createWorld(3);
  P.throwBall(w, { x: 0, speed: 100, angle: 0, spin: 0, exact: true });
  assert.ok(Math.hypot(w.ball.vx, w.ball.vy) <= P.SIM.maxSpeed + 1e-9);
  P.throwBall(w, { x: 0, speed: 0.1, angle: 0, spin: 0, exact: true });
  assert.ok(Math.hypot(w.ball.vx, w.ball.vy) >= P.SIM.minSpeed - 1e-9);
  P.throwBall(w, { x: 5, speed: 8, angle: 1, spin: 0, exact: true });
  assert.ok(Math.abs(w.ball.x) < LANE.halfWidth, 'la posición se limita a la pista');
  assert.ok(Math.abs(Math.atan2(w.ball.vx, w.ball.vy)) <= P.SIM.maxAngle + 1e-9, 'el ángulo se limita');
});
