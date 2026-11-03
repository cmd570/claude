'use strict';
/*
 * Pruebas unitarias del motor de puntuación.
 * Ejecutar:  node --test tests/
 * El motor vive dentro de index.html (<script id="scoring">); aquí lo
 * extraemos y evaluamos para probar exactamente el código que corre el juego.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadScoring() {
  const override = process.env.SCORING_JS;
  if (override) {
    return require(path.resolve(override));
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="scoring">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No se encontró <script id="scoring"> en index.html');
  // Se evalúa en este mismo contexto (no en vm) para que los Array/Object
  // creados por el motor compartan prototipos con los del test (deepEqual estricto).
  const factory = new Function('module', m[1] + '\nreturn BowlingScoring;');
  return factory({ exports: {} });
}

const S = loadScoring();

const rep = (arr, n) => Array.from({ length: n }, () => arr).flat();

/* Cada caso: tiros planos, acumulado por cuadro (null = aún no se conoce),
   puntaje final (null si la partida no terminó) y si terminó. */
const CASES = [
  { name: 'Partida perfecta 300', rolls: rep([10], 12),
    totals: [30, 60, 90, 120, 150, 180, 210, 240, 270, 300], final: 300, over: true },
  { name: 'Todo spares de 5 = 150', rolls: rep([5], 21),
    totals: [15, 30, 45, 60, 75, 90, 105, 120, 135, 150], final: 150, over: true },
  { name: 'Todo canal = 0', rolls: rep([0], 20),
    totals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], final: 0, over: true },
  { name: '9 y fallo en cada cuadro = 90', rolls: rep([9, 0], 10),
    totals: [9, 18, 27, 36, 45, 54, 63, 72, 81, 90], final: 90, over: true },
  { name: 'Dutch 200 (X 9/ alternados)', rolls: [...rep([10, 9, 1], 4), 10, 9, 1, 10],
    totals: [20, 40, 60, 80, 100, 120, 140, 160, 180, 200], final: 200, over: true },
  { name: 'Ejemplo clásico (Wikipedia) = 168',
    rolls: [10, 7, 3, 7, 2, 9, 1, 10, 10, 10, 2, 3, 6, 4, 7, 3, 3],
    totals: [20, 37, 46, 66, 96, 118, 133, 138, 155, 168], final: 168, over: true },
  { name: 'Parcial: solo un strike', rolls: [10],
    totals: [null, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'Parcial: tres strikes seguidos', rolls: [10, 10, 10],
    totals: [30, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'Parcial: spare y luego 3', rolls: [5, 5, 3],
    totals: [13, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'Parcial: spare y luego strike', rolls: [5, 5, 10],
    totals: [20, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'Parcial: primer tiro abierto', rolls: [3],
    totals: [null, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'Parcial: cuadro abierto completo', rolls: [3, 4],
    totals: [7, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'Cuadro 10: X X X', rolls: [...rep([1, 1], 9), 10, 10, 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 48], final: 48, over: true },
  { name: 'Cuadro 10: X 7 /', rolls: [...rep([1, 1], 9), 10, 7, 3],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 38], final: 38, over: true },
  { name: 'Cuadro 10: 7 / X', rolls: [...rep([1, 1], 9), 7, 3, 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 38], final: 38, over: true },
  { name: 'Cuadro 10: X 9 -', rolls: [...rep([1, 1], 9), 10, 9, 0],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 37], final: 37, over: true },
  { name: 'Cuadro 10: 7 / 3', rolls: [...rep([1, 1], 9), 7, 3, 3],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 31], final: 31, over: true },
  { name: 'Cuadro 10: abierto 7 2 (sin tercer tiro)', rolls: [...rep([1, 1], 9), 7, 2],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 27], final: 27, over: true },
  { name: 'Cuadro 10: X - / (spare tras strike)', rolls: [...rep([1, 1], 9), 10, 0, 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 38], final: 38, over: true },
  { name: 'Cuadro 10: X X 4', rolls: [...rep([1, 1], 9), 10, 10, 4],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 42], final: 42, over: true },
  { name: 'Strike en el 9 y X X X en el 10', rolls: [...rep([1, 1], 8), 10, 10, 10, 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 46, 76], final: 76, over: true },
  { name: 'Strike en el 9 y 7 2 en el 10', rolls: [...rep([1, 1], 8), 10, 7, 2],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 35, 44], final: 44, over: true },
  { name: 'Strikes en 8 y 9, luego 3 4', rolls: [...rep([1, 1], 7), 10, 10, 3, 4],
    totals: [2, 4, 6, 8, 10, 12, 14, 37, 54, 61], final: 61, over: true },
  { name: 'Parcial 10: strike, esperando bonos', rolls: [...rep([1, 1], 9), 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, null], final: null, over: false },
  { name: 'Parcial 10: strike y 7, falta el tercero', rolls: [...rep([1, 1], 9), 10, 7],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, null], final: null, over: false },
  { name: 'Parcial 10: spare, falta el tercero', rolls: [...rep([1, 1], 9), 4, 6],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, null], final: null, over: false },
  { name: 'Parcial 9: strike en 9, 10 sin tirar', rolls: [...rep([1, 1], 8), 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, null, null], final: null, over: false },
  { name: 'Spare en 9, strike en 10 primer tiro', rolls: [...rep([1, 1], 8), 5, 5, 10],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 36, null], final: null, over: false },
  { name: 'Spare en 9, 10 completo abierto', rolls: [...rep([1, 1], 8), 5, 5, 3, 4],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 29, 36], final: 36, over: true },
  { name: 'Strikes 9 y 10, luego 2 y 5', rolls: [...rep([1, 1], 8), 10, 10, 2, 5],
    totals: [2, 4, 6, 8, 10, 12, 14, 16, 38, 55], final: 55, over: true },
  { name: 'Casi perfecta: 11 strikes y 9', rolls: [...rep([10], 11), 9],
    totals: [30, 60, 90, 120, 150, 180, 210, 240, 270, 299], final: 299, over: true },
  { name: 'Strike, canal, canal', rolls: [10, 0, 0],
    totals: [10, 10, null, null, null, null, null, null, null, null], final: null, over: false },
];

for (const c of CASES) {
  test(c.name, () => {
    const st = S.analyze(c.rolls);
    assert.deepEqual(st.frames.map((f) => f.cumulative), c.totals, 'acumulados por cuadro');
    assert.equal(st.gameOver, c.over, 'gameOver');
    if (c.over) {
      assert.equal(st.total, c.final, 'puntaje final');
      assert.equal(st.next, null, 'sin próximo tiro');
    } else {
      assert.ok(st.next, 'debe haber próximo tiro');
    }
    assert.equal(st.extraRolls, 0, 'sin tiros sobrantes');
  });
}

test('próximo tiro y pinos en pie (cuadros 1-9)', () => {
  assert.deepEqual(S.analyze([]).next, { frame: 0, roll: 0, pinsStanding: 10 });
  assert.deepEqual(S.analyze([7]).next, { frame: 0, roll: 1, pinsStanding: 3 });
  assert.deepEqual(S.analyze([7, 2]).next, { frame: 1, roll: 0, pinsStanding: 10 });
  assert.deepEqual(S.analyze([10]).next, { frame: 1, roll: 0, pinsStanding: 10 });
  assert.deepEqual(S.analyze([0]).next, { frame: 0, roll: 1, pinsStanding: 10 });
});

test('próximo tiro y pinos en pie (cuadro 10)', () => {
  const base = rep([1, 1], 9);
  assert.deepEqual(S.analyze(base).next, { frame: 9, roll: 0, pinsStanding: 10 });
  assert.deepEqual(S.analyze([...base, 10]).next, { frame: 9, roll: 1, pinsStanding: 10 });
  assert.deepEqual(S.analyze([...base, 10, 10]).next, { frame: 9, roll: 2, pinsStanding: 10 });
  assert.deepEqual(S.analyze([...base, 10, 6]).next, { frame: 9, roll: 2, pinsStanding: 4 });
  assert.deepEqual(S.analyze([...base, 6]).next, { frame: 9, roll: 1, pinsStanding: 4 });
  assert.deepEqual(S.analyze([...base, 6, 4]).next, { frame: 9, roll: 2, pinsStanding: 10 });
  assert.equal(S.analyze([...base, 6, 3]).next, null);
  assert.equal(S.analyze([...base, 10, 6, 0]).next, null);
});

test('etiquetas de casillas (cuadros 1-9)', () => {
  const fr = (rolls) => S.analyze(rolls).frames[0];
  assert.deepEqual(S.labels(fr([])), ['', '']);
  assert.deepEqual(S.labels(fr([10])), ['', 'X']);
  assert.deepEqual(S.labels(fr([7])), ['7', '']);
  assert.deepEqual(S.labels(fr([7, 3])), ['7', '/']);
  assert.deepEqual(S.labels(fr([0, 10])), ['-', '/']);
  assert.deepEqual(S.labels(fr([7, 2])), ['7', '2']);
  assert.deepEqual(S.labels(fr([0, 0])), ['-', '-']);
});

test('etiquetas de casillas (cuadro 10)', () => {
  const base = rep([1, 1], 9);
  const fr = (tenth) => S.analyze([...base, ...tenth]).frames[9];
  assert.deepEqual(S.labels(fr([])), ['', '', '']);
  assert.deepEqual(S.labels(fr([10, 10, 10])), ['X', 'X', 'X']);
  assert.deepEqual(S.labels(fr([10, 7, 3])), ['X', '7', '/']);
  assert.deepEqual(S.labels(fr([7, 3, 10])), ['7', '/', 'X']);
  assert.deepEqual(S.labels(fr([10, 9, 0])), ['X', '9', '-']);
  assert.deepEqual(S.labels(fr([7, 3, 3])), ['7', '/', '3']);
  assert.deepEqual(S.labels(fr([7, 2])), ['7', '2', '']);
  assert.deepEqual(S.labels(fr([10, 0, 10])), ['X', '-', '/']);
  assert.deepEqual(S.labels(fr([10, 10, 4])), ['X', 'X', '4']);
  assert.deepEqual(S.labels(fr([0, 10, 5])), ['-', '/', '5']);
  assert.deepEqual(S.labels(fr([10, 10])), ['X', 'X', '']);
});

test('puntaje provisional cuenta pinos derribados y bonos conocidos', () => {
  assert.equal(S.analyze([]).provisional, 0);
  assert.equal(S.analyze([10]).provisional, 10);
  assert.equal(S.analyze([10, 5]).provisional, 20);
  assert.equal(S.analyze([5, 5]).provisional, 10);
  assert.equal(S.analyze([5, 5, 3]).provisional, 16);
  assert.equal(S.analyze(rep([10], 12)).provisional, 300);
  assert.equal(S.analyze([...rep([1, 1], 9), 10, 7]).provisional, 35);
});

test('validación de tiros', () => {
  assert.equal(S.isValidRoll([], 10), true);
  assert.equal(S.isValidRoll([], 11), false);
  assert.equal(S.isValidRoll([], -1), false);
  assert.equal(S.isValidRoll([7], 3), true);
  assert.equal(S.isValidRoll([7], 4), false);
  assert.equal(S.isValidRoll(rep([10], 12), 0), false, 'partida terminada');
  assert.equal(S.isValidRoll([...rep([1, 1], 9), 10, 6], 4), true);
  assert.equal(S.isValidRoll([...rep([1, 1], 9), 10, 6], 5), false);
});

test('tiros sobrantes tras terminar se reportan', () => {
  assert.equal(S.analyze([...rep([10], 12), 5]).extraRolls, 1);
});

/* Casos adicionales recopilados de fuentes externas (reglas USBC, bowling kata, exercism, ejemplos de marcadores). */
const EXTERNAL_CASES = [
  { name: 'perfect game: 12 strikes = 300 (USBC 2b: \'the player must bowl 12 strikes in succession\')', rolls: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], totals: [30, 60, 90, 120, 150, 180, 210, 240, 270, 300], final: 300, over: true },
  { name: 'all spares of 5 with fill ball 5 = 150 (each frame 10+5)', rolls: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], totals: [15, 30, 45, 60, 75, 90, 105, 120, 135, 150], final: 150, over: true },
  { name: 'all gutters = 0 (20 rolls, open 10th, no third ball)', rolls: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], final: 0, over: true },
  { name: '9 then miss every frame = 90', rolls: [9, 0, 9, 0, 9, 0, 9, 0, 9, 0, 9, 0, 9, 0, 9, 0, 9, 0, 9, 0], totals: [9, 18, 27, 36, 45, 54, 63, 72, 81, 90], final: 90, over: true },
  { name: 'all ones (Uncle Bob kata) = 20', rolls: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], totals: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], final: 20, over: true },
  { name: 'one spare 5,5 then 3, rest gutters (kata) = 16', rolls: [5, 5, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totals: [13, 16, 16, 16, 16, 16, 16, 16, 16, 16], final: 16, over: true },
  { name: 'one strike then 3,4, rest gutters (kata) = 24 (19 rolls)', rolls: [10, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totals: [17, 24, 24, 24, 24, 24, 24, 24, 24, 24], final: 24, over: true },
  { name: '10th frame X X X = 30 after nine open 3-4 frames', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10, 10, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, 93], final: 93, over: true },
  { name: '10th frame strike then spare (X 1 /) = 20', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10, 1, 9], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, 83], final: 83, over: true },
  { name: '10th frame spare then strike fill (9 / X) = 20', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 9, 1, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, 83], final: 83, over: true },
  { name: '10th frame strike, 9, miss (X 9 -) = 19', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10, 9, 0], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, 82], final: 82, over: true },
  { name: '10th frame spare then 7 (3 / 7) = 17', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 7, 7], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, 80], final: 80, over: true },
  { name: 'open 10th frame (8 1), game over after 20 rolls, third box blank', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 8, 1], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, 72], final: 72, over: true },
  { name: 'Dutch 200: strikes in odd frames, spare in 10th with strike fill ball', rolls: [10, 5, 5, 10, 5, 5, 10, 5, 5, 10, 5, 5, 10, 5, 5, 10], totals: [20, 40, 60, 80, 100, 120, 140, 160, 180, 200], final: 200, over: true },
  { name: 'Dutch 200: strikes in even frames, 10th = X 5 /', rolls: [5, 5, 10, 5, 5, 10, 5, 5, 10, 5, 5, 10, 5, 5, 10, 5, 5], totals: [20, 40, 60, 80, 100, 120, 140, 160, 180, 200], final: 200, over: true },
  { name: 'classic mixed game 181 (bowlmath: X 7/ 9- X -8 8/ 9- X X X9/)', rolls: [10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 9, 0, 10, 10, 10, 9, 1], totals: [20, 39, 48, 66, 74, 93, 102, 132, 161, 181], final: 181, over: true },
  { name: 'USBC worked example 180 with a foul (F entered as 0): X X X 72 8/ F9 X 7/ 9- XX8', rolls: [10, 10, 10, 7, 2, 8, 2, 0, 9, 10, 7, 3, 9, 0, 10, 10, 8], totals: [30, 57, 76, 85, 95, 104, 124, 143, 152, 180], final: 180, over: true },
  { name: 'scoreboard example 170 (BnkColon): 81 X 5/ 80 X X 9/ 81 9/ X72', rolls: [8, 1, 10, 5, 5, 8, 0, 10, 10, 9, 1, 8, 1, 9, 1, 10, 7, 2], totals: [9, 29, 47, 55, 84, 104, 122, 131, 151, 170], final: 170, over: true },
  { name: '299: eleven strikes then 9', rolls: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9], totals: [30, 60, 90, 120, 150, 180, 210, 240, 270, 299], final: 299, over: true },
  { name: 'exercism: strikes in frames 9 and 10 then fill 0,1 = 31', rolls: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 0, 1], totals: [0, 0, 0, 0, 0, 0, 0, 0, 20, 31], final: 31, over: true },
  { name: 'exercism: 10th frame X X 6 = 26', rolls: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 6], totals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 26], final: 26, over: true },
  { name: 'partial: single strike, nothing determinable', rolls: [10], totals: [null, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial: open frame then strike awaiting two rolls', rolls: [3, 4, 10], totals: [7, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial: two consecutive strikes awaiting (frame 1 still needs one more roll)', rolls: [10, 10], totals: [null, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial: three consecutive strikes, only frame 1 (30) known', rolls: [10, 10, 10], totals: [30, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial: spare awaiting its bonus roll', rolls: [3, 4, 5, 5], totals: [7, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial: spare resolved by a strike (20), strike pending', rolls: [3, 4, 5, 5, 10], totals: [7, 27, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial: only first ball of frame 2 bowled', rolls: [3, 4, 5], totals: [7, null, null, null, null, null, null, null, null, null], final: null, over: false },
  { name: 'partial 10th: strike, both fill balls pending (19 rolls)', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, null], final: null, over: false },
  { name: 'partial 10th: strike + strike, third ball pending (20 rolls but NOT over)', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, null], final: null, over: false },
  { name: 'partial 10th: spare, fill ball pending (20 rolls but NOT over)', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 5, 5], totals: [7, 14, 21, 28, 35, 42, 49, 56, 63, null], final: null, over: false },
  { name: 'partial: frame 9 strike and 10th-frame strike both pending', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, null, null], final: null, over: false },
  { name: 'frame 9 strike then X X X in 10th: frame 9 = 30 from fill balls', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 10, 10, 10, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, 86, 116], final: 116, over: true },
  { name: 'frame 9 spare then X X X in 10th: frame 9 = 20', rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 5, 5, 10, 10, 10], totals: [7, 14, 21, 28, 35, 42, 49, 56, 76, 106], final: 106, over: true },
  { name: 'foul (0) on first ball then all ten = spare (F /), then 3,4', rolls: [0, 10, 3, 4], totals: [13, 20, null, null, null, null, null, null, null, null], final: null, over: false },
];

for (const c of EXTERNAL_CASES) {
  test('externo: ' + c.name, () => {
    const st = S.analyze(c.rolls);
    assert.deepEqual(st.frames.map((f) => f.cumulative), c.totals, 'acumulados por cuadro');
    assert.equal(st.gameOver, c.over, 'gameOver');
    if (c.over) assert.equal(st.total, c.final, 'puntaje final');
    assert.equal(st.extraRolls, 0, 'sin tiros sobrantes');
  });
}
