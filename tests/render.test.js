'use strict';
/*
 * Pruebas del renderizador que no necesitan WebGL: perfil USBC del bolo,
 * interpolación PCHIP y utilidades de malla, sobre el código embebido en index.html.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(id) {
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`bloque ${id} no encontrado`);
  return m[1];
}
const { GLCore, BowlingRenderer } = new Function(`${block('gl')}; return { GLCore, BowlingRenderer };`)();
const IN = 0.0254;

test('el perfil del bolo sigue las estaciones USBC (panza, cuello, cabeza, altura)', () => {
  const P = BowlingRenderer.PIN_PROFILE;
  assert.ok(P.length > 60, 'perfil con suficientes puntos');
  for (let i = 1; i < P.length; i++) assert.ok(P[i][0] >= P[i - 1][0], `altura monótona en ${i}`);
  assert.equal(P[0][0], 0); assert.equal(P[0][1], 0);
  const top = P[P.length - 1];
  assert.ok(Math.abs(top[0] - 15 * IN) < 1e-9 && top[1] === 0, 'termina en el vértice a 15 in');
  const at = (h) => P.reduce((best, p) => (Math.abs(p[0] - h) < Math.abs(best[0] - h) ? p : best), P[0]);
  assert.ok(Math.abs(at(4.5 * IN)[1] - 4.766 * IN / 2) < 0.0006, 'panza de 4,766 in a 4,5 in');
  assert.ok(Math.abs(at(10 * IN)[1] - 1.797 * IN / 2) < 0.0006, 'cuello de 1,797 in a 10 in');
  assert.ok(Math.abs(at(13.5 * IN)[1] - 2.547 * IN / 2) < 0.0008, 'cabeza de 2,547 in a 13,5 in');
  assert.ok(Math.abs(at(0.75 * IN)[1] - 2.828 * IN / 2) < 0.001, 'ensanche del pie a 0,75 in');
  const maxR = Math.max(...P.map((p) => p[1]));
  assert.ok(maxR <= 4.766 * IN / 2 + 0.0003, 'ningún punto supera el diámetro máximo');
  // La coordenada de textura v crece con la altura (las franjas se pintan a su altura real)
  for (let i = 1; i < P.length; i++) assert.ok(P[i][2] >= P[i - 1][2]);
  assert.ok(Math.abs(P[P.length - 1][2] - 1) < 1e-9);
});

test('la corona es un arco de radio 1,273 in tangente a la cabeza', () => {
  const P = BowlingRenderer.PIN_PROFILE;
  const cz = 13.727 * IN, R = 1.273 * IN;
  const crown = P.filter((p) => p[0] > 13.6 * IN && p[0] < 15 * IN - 1e-6);
  assert.ok(crown.length >= 5);
  for (const [y, r] of crown) assert.ok(Math.abs(Math.hypot(r, y - cz) - R) < 0.0006, `punto (${y.toFixed(4)}, ${r.toFixed(4)}) sobre el arco`);
});

test('la interpolación PCHIP es monótona entre puntos monótonos y pasa por ellos', () => {
  const xs = [0, 1, 2, 3, 4], ys = [0, 0.5, 0.52, 2, 2.1];
  const f = GLCore.pchip(xs, ys);
  for (let i = 0; i < xs.length; i++) assert.ok(Math.abs(f(xs[i]) - ys[i]) < 1e-12);
  let prev = -Infinity;
  for (let x = 0; x <= 4; x += 0.01) { const v = f(x); assert.ok(v >= prev - 1e-12, `monótona en ${x}`); prev = v; }
  assert.equal(f(-1), 0); assert.equal(f(9), 2.1);
});

test('las mallas tienen normales unitarias e índices válidos', () => {
  const parts = [GLCore.sphere(0.1, 16, 8), GLCore.box([-1, -1, -1], [1, 1, 1], 1), GLCore.cylinder(0.05, 0, 0.2, 12), GLCore.lathe(BowlingRenderer.PIN_PROFILE.map(([y, r, v]) => [y - 0.145, r, v]), 24), GLCore.quadXZ()];
  for (const part of parts) {
    const n = part.data.length / 8;
    assert.equal(part.data.length % 8, 0);
    for (const i of part.idx) assert.ok(i >= 0 && i < n && Number.isInteger(i));
    assert.equal(part.idx.length % 3, 0);
    for (let i = 0; i < part.data.length; i += 8) {
      const l = Math.hypot(part.data[i + 3], part.data[i + 4], part.data[i + 5]);
      assert.ok(Math.abs(l - 1) < 1e-3, `normal unitaria (${l})`);
    }
  }
});

test('las matrices de rotación son ortonormales y el lookAt zurdo mira hacia +z', () => {
  const M4 = GLCore.M4;
  for (const m of [M4.rotationX(0.7), M4.rotationY(-1.2), M4.rotationZ(2.1)]) {
    const inv = M4.invert(m);
    const id = M4.multiply(m, inv);
    for (let i = 0; i < 16; i++) assert.ok(Math.abs(id[i] - (i % 5 === 0 ? 1 : 0)) < 1e-6);
  }
  const view = M4.lookAt([0, 1, -3], [0, 0, 10], [0, 1, 0]);
  const p = M4.transformPoint(view, [0, 0, 10]);
  assert.ok(p[2] < 0, 'el objetivo queda delante de la cámara (z negativa en el espacio de vista)');
  assert.ok(Math.abs(p[0]) < 1e-6, 'el objetivo queda centrado');
});
