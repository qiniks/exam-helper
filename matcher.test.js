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
