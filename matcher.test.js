const test = require('node:test');
const assert = require('node:assert');
const M = require('./matcher.js');

test('normalize lowercases, trims, collapses whitespace', () => {
  assert.strictEqual(M.normalize('  Hello   World  '), 'hello world');
});

test('normalize strips punctuation but keeps letters and digits', () => {
  assert.strictEqual(M.normalize('Mount Everest, 8848 m?'), 'mount everest 8848 m');
});

test('normalize handles null/empty', () => {
  assert.strictEqual(M.normalize(''), '');
  assert.strictEqual(M.normalize(null), '');
});

test('score: identical strings score ~1', () => {
  const s = M.score('mount everest', 'mount everest');
  assert.ok(s > 0.99, `expected ~1, got ${s}`);
});

test('score: unrelated strings score low', () => {
  const s = M.score('mount everest summit', 'quantum physics laboratory');
  assert.ok(s < 0.3, `expected <0.3, got ${s}`);
});

test('score: tolerates a few OCR-style character errors', () => {
  const original = 'what is the capital city of australia';
  const noisy = 'what is the capita1 city of austra1ia';
  const s = M.score(noisy, original);
  assert.ok(s > 0.7, `expected >0.7 despite noise, got ${s}`);
});

test('score: handles empty input without throwing', () => {
  assert.strictEqual(M.score('', 'something'), 0);
  assert.strictEqual(M.score('something', ''), 0);
});

const SAMPLE_DATA = {
  geography: {
    title: "Geography",
    tests: [
      {
        id: "geo_1",
        title: "World Geography",
        questions: [
          {
            id: "geo_q1",
            question: "What is the capital of Australia?",
            options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
            answerIndex: 2
          },
          {
            id: "geo_q2",
            question: "What is the longest river in the world?",
            options: ["Amazon", "Nile", "Yangtze", "Mississippi"],
            answerIndex: 1
          },
          {
            id: "geo_q3",
            question: "What is the largest desert in the world?",
            options: ["Sahara", "Antarctica", "Gobi", "Arabian"],
            answerIndex: 0,
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
  const noisy = target.question.replace(/o/g, '0');
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
