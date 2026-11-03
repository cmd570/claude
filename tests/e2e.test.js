'use strict';
/*
 * Pruebas de extremo a extremo con Playwright (Chromium) sobre index.html.
 * Ejecutar:  node --test tests/e2e.test.js
 * Si Playwright no está instalado, las pruebas se omiten.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* sin Playwright */ }

const URL = 'file://' + (process.env.BOWLING_HTML || path.join(__dirname, '..', 'index.html'));

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 1 }, opts || {}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__bowling);
  return { ctx, page, errors };
}

/** Juega tiros sin física (API de depuración) esperando a que vuelva el estado "aim". */
async function playRolls(page, rolls) {
  for (const n of rolls) {
    await page.waitForFunction(() => window.__bowling.state().state === 'aim', null, { timeout: 10000 });
    const ok = await page.evaluate((k) => window.__bowling.applyRoll(k), n);
    assert.equal(ok, true, `applyRoll(${n}) debe aceptarse`);
    await page.waitForFunction(() => ['aim', 'over'].includes(window.__bowling.state().state), null, { timeout: 10000 });
  }
}

test('carga sin errores y muestra la configuración', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    assert.equal(await page.isVisible('#overlay-setup'), true);
    assert.equal(await page.title(), 'Bowling');
    await page.click('#btn-start');
    assert.equal(await page.isVisible('#overlay-setup'), false);
    const st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.state, 'aim');
    assert.equal(st.players.length, 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('partida perfecta de 300 con el marcador real', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana']); });
    await playRolls(page, Array(12).fill(10));
    const st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.state, 'over');
    assert.equal(st.players[0].total, 300);
    assert.equal(await page.isVisible('#overlay-over'), true);
    const cells = await page.$$eval('.sb-frame[data-frame="9"] .sb-rolls span', (s) => s.map((x) => x.textContent));
    assert.deepEqual(cells, ['X', 'X', 'X']);
    const totals = await page.$$eval('.sb-frame .sb-total', (s) => s.map((x) => x.textContent));
    assert.deepEqual(totals, ['30', '60', '90', '120', '150', '180', '210', '240', '270', '300']);
    assert.match(await page.textContent('#best-line'), /300/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('dos jugadores alternan por cuadro y el 10º cuadro da tiros extra', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana', 'Luis']); });
    // Cuadro 1: Ana 7 + 2 (abierto); Luis strike
    await playRolls(page, [7]);
    let st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.current, 0, 'Ana sigue tras el primer tiro');
    assert.deepEqual(st.standing.length, 3, 'quedan 3 pinos para el segundo tiro');
    await playRolls(page, [2]);
    st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.current, 1, 'turno de Luis');
    assert.equal(st.standing.length, 10, 'rack completo para Luis');
    await playRolls(page, [10]);
    st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.current, 0, 'vuelve Ana tras el strike de Luis');
    // Cuadros 2-9: ambos 1 y 1
    for (let f = 0; f < 8; f++) await playRolls(page, [1, 1, 1, 1]);
    // Cuadro 10: Ana spare 5/ + 5; Luis 3 4 (sin tercer tiro)
    await playRolls(page, [5, 5]);
    st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.current, 0, 'Ana tiene tiro extra tras el spare');
    assert.equal(st.standing.length, 10, 'rack completo para el tiro extra');
    await playRolls(page, [5]);
    st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.current, 1);
    await playRolls(page, [3, 4]);
    st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.state, 'over');
    assert.equal(st.players[0].total, 9 + 16 + 15);
    assert.equal(st.players[1].total, 12 + 16 + 7);
    const winner = await page.textContent('#final-table tr.winner td');
    assert.match(winner, /Ana/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('un tiro con física real derriba pinos y actualiza el marcador', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    const ok = await page.evaluate(() => window.__bowling.throwBall({ x: 0.06, power: 0.85, angle: 0 }));
    assert.equal(ok, true);
    await page.waitForFunction(() => window.__bowling.state().players[0].rolls.length === 1, null, { timeout: 20000 });
    const st = await page.evaluate(() => window.__bowling.state());
    assert.ok(st.players[0].rolls[0] >= 6, `un tiro al bolsillo derriba muchos pinos (derribó ${st.players[0].rolls[0]})`);
    await page.waitForFunction(() => window.__bowling.state().state === 'aim', null, { timeout: 20000 });
    const first = await page.$eval('.sb-frame[data-frame="0"] .sb-rolls span', (s) => s.textContent);
    assert.ok(first === '' || /\d|X/.test(first));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('la bola en el canal no derriba pinos', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    await page.evaluate(() => window.__bowling.throwBall({ x: 0.5, power: 0.9, angle: 3 * Math.PI / 180 }));
    await page.waitForFunction(() => window.__bowling.state().players[0].rolls.length === 1, null, { timeout: 20000 });
    const st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.players[0].rolls[0], 0);
    assert.equal(st.lastRoll.gutter, true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('el gesto de deslizar lanza la bola (táctil)', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser, { hasTouch: true, isMobile: true });
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    const box = await page.$eval('#game', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const x = box.x + box.w / 2, y0 = box.y + box.h * 0.8;
    await page.mouse.move(x, y0);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(x, y0 - i * 30); await page.waitForTimeout(12); }
    await page.mouse.up();
    await page.waitForFunction(() => window.__bowling.state().state !== 'aim', null, { timeout: 5000 });
    await page.waitForFunction(() => window.__bowling.state().players[0].rolls.length === 1, null, { timeout: 20000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('el medidor de potencia por teclado lanza la bola', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('d');
    await page.keyboard.press('Space');
    assert.equal(await page.$eval('#power', (p) => p.classList.contains('visible')), true);
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__bowling.state().state === 'rolling', null, { timeout: 5000 });
    const st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.spin, 0.25);
    await page.waitForFunction(() => window.__bowling.state().players[0].rolls.length === 1, null, { timeout: 20000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('tocar la pista durante la jugada acelera y salta la recogida', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    await page.evaluate(() => window.__bowling.throwBall({ x: 0.07, power: 0.8, angle: 0 }));
    await page.waitForFunction(() => window.__bowling.state().state === 'rolling');
    const box = await page.$eval('#game', (c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const t0 = Date.now();
    await page.mouse.click(box.x, box.y);               // acelera la bola
    assert.equal(await page.evaluate(() => window.__bowling.game.timeScale), 3);
    await page.waitForFunction(() => window.__bowling.state().state === 'result', null, { timeout: 15000 });
    await page.mouse.click(box.x, box.y);               // salta el mensaje
    await page.waitForFunction(() => window.__bowling.state().state === 'sweep', null, { timeout: 5000 });
    await page.keyboard.press('Space');                 // salta la recogida
    await page.waitForFunction(() => window.__bowling.state().state === 'aim', null, { timeout: 5000 });
    assert.ok(Date.now() - t0 < 9000, 'la jugada completa acelerada dura menos de 9 s');
    const st = await page.evaluate(() => window.__bowling.state());
    assert.equal(st.players[0].rolls.length, 1);
    assert.equal(await page.evaluate(() => window.__bowling.game.timeScale), 1, 'la velocidad vuelve a la normalidad');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('R repite el último tiro con los mismos parámetros', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.setFast(true); window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    await page.evaluate(() => window.__bowling.throwBall({ x: 0.12, power: 0.6, angle: 0.01, spin: 0.5 }));
    const first = await page.evaluate(() => window.__bowling.lastThrow());
    await page.waitForFunction(() => window.__bowling.state().state === 'aim' && window.__bowling.state().players[0].rolls.length === 1, null, { timeout: 20000 });
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__bowling.state().state === 'rolling', null, { timeout: 5000 });
    const second = await page.evaluate(() => window.__bowling.lastThrow());
    assert.deepEqual(second, first);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Espacio/Enter sobre un botón enfocado activan el botón, no el medidor', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => { window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    await page.focus('#btn-help');
    await page.keyboard.press('Enter');
    assert.equal(await page.isVisible('#overlay-help'), true, 'Enter abre la ayuda');
    assert.equal(await page.evaluate(() => window.__bowling.game.power.active), false, 'el medidor no arranca');
    await page.keyboard.press('Escape');
    await page.focus('#spin-right');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__bowling.state().spin), 0.25, 'Espacio pulsa el botón de efecto');
    assert.equal(await page.evaluate(() => window.__bowling.game.power.active), false);
    await page.focus('#game');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__bowling.game.power.active), true, 'con el lienzo enfocado sí arranca el medidor');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('con prefers-reduced-motion el mensaje del resultado sigue siendo visible', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser, { reducedMotion: 'reduce' });
    await page.evaluate(() => { window.__bowling.start(['Ana']); });
    await page.waitForFunction(() => window.__bowling.state().state === 'aim');
    await page.evaluate(() => window.__bowling.applyRoll(10));
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => { const m = document.getElementById('message'); return { text: m.textContent, opacity: getComputedStyle(m).opacity }; });
    assert.match(info.text, /STRIKE/);
    assert.equal(info.opacity, '1');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
