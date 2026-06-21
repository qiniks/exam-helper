const test = require('node:test');
const assert = require('node:assert');
const M = require('./matcher.js');

test('normalize lowercases, trims, collapses whitespace', () => {
  assert.strictEqual(M.normalize('  Привет   Мир  '), 'привет мир');
});

test('normalize strips punctuation but keeps letters and digits', () => {
  assert.strictEqual(M.normalize('Пик «Победы», 7439 м?'), 'пик победы 7439 м');
});

test('normalize unifies ё and latin homoglyphs to cyrillic', () => {
  assert.strictEqual(M.normalize('ёлка'), 'елка');
  assert.strictEqual(M.normalize('Pоссия'), 'россия'); // leading latin P -> cyrillic р
});

test('normalize keeps kyrgyz letters', () => {
  assert.strictEqual(M.normalize('Манас — улуу'), 'манас улуу');
  assert.strictEqual(M.normalize('Сүйүнбай'), 'сүйүнбай');
});

test('normalize handles null/empty', () => {
  assert.strictEqual(M.normalize(''), '');
  assert.strictEqual(M.normalize(null), '');
});

test('score: identical strings score ~1', () => {
  const s = M.score('пик победы', 'пик победы');
  assert.ok(s > 0.99, `expected ~1, got ${s}`);
});

test('score: unrelated strings score low', () => {
  const s = M.score('пик победы на хребте', 'кыргызский язык и литература');
  assert.ok(s < 0.3, `expected <0.3, got ${s}`);
});

test('score: tolerates a few OCR-style character errors', () => {
  const original = 'на каком горном хребте расположен пик победы';
  const noisy = 'на каком гopном хребте располoжен пик пoбеды';
  const s = M.score(noisy, original);
  assert.ok(s > 0.7, `expected >0.7 despite noise, got ${s}`);
});

test('score: handles empty input without throwing', () => {
  assert.strictEqual(M.score('', 'что-то'), 0);
  assert.strictEqual(M.score('что-то', ''), 0);
});
