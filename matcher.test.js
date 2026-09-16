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

const SAMPLE_DATA = {
  geography: {
    title: "География",
    tests: [
      {
        id: "geo_1",
        title: "Тест 1",
        questions: [
          {
            id: "geo_q1",
            question: "Кыргызстан на севере граничит с каким государством?",
            options: ["Казахстан", "Китай", "Россия", "Узбекистан"],
            answerIndex: 0
          },
          {
            id: "geo_q2",
            question: "На каком горном хребте расположен пик Победы?",
            options: ["Алайский", "Бозкыр", "Акшыйрак", "Сарыжазский"],
            answerIndex: 3
          },
          {
            id: "geo_q3",
            question: "В каком месте Иссыккульской котловины добывается бурый уголь?",
            options: ["Курменты", "Джергалан", "Сарыджаз", "Барскаун"],
            answerIndex: 2,
            verification: {
              status: "discrepancy",
              actualAnswerIndex: 1
            }
          }
        ]
      }
    ]
  }
};

test('flattenBank flattens all subjects/tests into entries', () => {
  const flat = M.flattenBank(SAMPLE_DATA);
  assert.strictEqual(flat.length, 3);
  const first = flat[0];
  assert.ok(first.question && Array.isArray(first.options));
  assert.ok(typeof first.answerIndex === 'number');
  assert.ok(first.subjectKey && first.subjectTitle);
});

test('findBest returns the exact question on exact text', () => {
  const flat = M.flattenBank(SAMPLE_DATA);
  const target = flat[1];
  const res = M.findBest(target.question, flat);
  assert.strictEqual(res.best.id, target.id);
  assert.ok(res.score > 0.95, `score ${res.score}`);
  assert.ok(Array.isArray(res.top) && res.top.length >= 2);
});

test('findBest still finds the right question with OCR-style noise', () => {
  const flat = M.flattenBank(SAMPLE_DATA);
  const target = flat[1];
  const noisy = target.question.replace(/о/g, 'o');
  const res = M.findBest(noisy, flat);
  assert.strictEqual(res.best.id, target.id);
});

test('formatAnswer returns options[answerIndex] when there is no verification', () => {
  const flat = M.flattenBank(SAMPLE_DATA);
  const q = flat.find((x) => !x.verification);
  assert.strictEqual(M.formatAnswer(q), q.options[q.answerIndex]);
});

test('formatAnswer shows both answers (verification one in brackets) on a discrepancy', () => {
  const flat = M.flattenBank(SAMPLE_DATA);
  const q = flat.find((x) => x.verification && x.verification.status === 'discrepancy'
    && x.verification.actualAnswerIndex !== x.answerIndex);
  assert.ok(q, 'expected a discrepancy with a different actualAnswerIndex in the bank');
  const expected = q.options[q.answerIndex] + ' (' + q.options[q.verification.actualAnswerIndex] + ')';
  assert.strictEqual(M.formatAnswer(q), expected);
});

test('formatAnswer handles custom candidate with direct answer field and no options', () => {
  const customCand = {
    id: 'c1',
    question: 'What is the speed of light?',
    answer: '299,792 km/s'
  };
  assert.strictEqual(M.formatAnswer(customCand), '299,792 km/s');
});
