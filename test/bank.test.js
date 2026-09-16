const test = require('node:test');
const assert = require('node:assert');
const Bank = require('../bank.js');

const MOCK_NESTED_DATA = {
  geography: {
    title: "Geography",
    tests: [
      {
        id: "geo_1",
        title: "World Geography",
        questions: [
          {
            id: "q1",
            question: "What is the capital of France?",
            options: ["Berlin", "Madrid", "Paris"],
            answerIndex: 2
          },
          {
            id: "q2",
            question: "What is the largest desert in the world?",
            options: ["Sahara", "Antarctica", "Gobi"],
            answerIndex: 1
          }
        ]
      }
    ]
  }
};

test('parseQuestionData handles nested subject/tests structure', () => {
  const result = Bank.parseQuestionData(MOCK_NESTED_DATA);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'What is the capital of France?');
  assert.strictEqual(result[0].answer, 'Paris');
  assert.strictEqual(result[0].subjectTitle, 'Geography');
});

test('parseQuestionData handles JSON string of nested structure', () => {
  const jsonStr = JSON.stringify(MOCK_NESTED_DATA);
  const result = Bank.parseQuestionData(jsonStr);
  assert.strictEqual(result.length, 2);
});

test('parseQuestionData handles flat array of questions with options and answerIndex', () => {
  const input = [
    {
      question: 'Capital of Japan?',
      options: ['Kyoto', 'Tokyo', 'Osaka'],
      answerIndex: 1
    },
    {
      question: 'Capital of Canada?',
      options: ['Toronto', 'Ottawa', 'Vancouver'],
      answerIndex: 1
    }
  ];
  const result = Bank.parseQuestionData(input);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'Capital of Japan?');
  assert.strictEqual(result[0].answer, 'Tokyo');
  assert.strictEqual(result[0].answerIndex, 1);
  assert.strictEqual(result[1].answer, 'Ottawa');
});

test('parseQuestionData handles simple Q&A array (question / answer)', () => {
  const input = [
    { question: 'What is H2O?', answer: 'Water' },
    { q: 'Speed of light?', a: '299,792 km/s' }
  ];
  const result = Bank.parseQuestionData(input);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'What is H2O?');
  assert.strictEqual(result[0].answer, 'Water');
  assert.strictEqual(result[1].question, 'Speed of light?');
  assert.strictEqual(result[1].answer, '299,792 km/s');
});

test('parseQuestionData handles key-value map format', () => {
  const input = {
    'What is 2+2?': '4',
    'What is the freezing point of water?': '0°C'
  };
  const result = Bank.parseQuestionData(input);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'What is 2+2?');
  assert.strictEqual(result[0].answer, '4');
});

test('parseQuestionData handles CSV with headers', () => {
  const csv = `Question,Answer,Option1,Option2
"What is the capital of France?","Paris","London","Paris"
"Is the earth round?","Yes","Yes","No"`;
  const result = Bank.parseQuestionData(csv);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'What is the capital of France?');
  assert.strictEqual(result[0].answer, 'Paris');
  assert.deepStrictEqual(result[0].options, ['London', 'Paris']);
  assert.strictEqual(result[0].answerIndex, 1); // automatically matched Paris to index 1!
  assert.strictEqual(result[1].answer, 'Yes');
});

test('parseQuestionData handles TSV with tab delimiter', () => {
  const tsv = "Question\tAnswer\nWhat is the color of grass?\tGreen\nSky color?\tBlue";
  const result = Bank.parseQuestionData(tsv);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'What is the color of grass?');
  assert.strictEqual(result[0].answer, 'Green');
  assert.strictEqual(result[1].question, 'Sky color?');
  assert.strictEqual(result[1].answer, 'Blue');
});

test('parseQuestionData handles semicolon-separated values', () => {
  const ssv = "Вопрос;Ответ\nСколько дней в году?;365\nСтолица КР;Бишкек";
  const result = Bank.parseQuestionData(ssv);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'Сколько дней в году?');
  assert.strictEqual(result[0].answer, '365');
  assert.strictEqual(result[1].question, 'Столица КР');
  assert.strictEqual(result[1].answer, 'Бишкек');
});

test('parseQuestionData throws error on invalid or empty input', () => {
  assert.throws(() => Bank.parseQuestionData(''), /empty/);
  assert.throws(() => Bank.parseQuestionData('{ bad json'), /Invalid JSON format/);
  assert.throws(() => Bank.parseQuestionData([]), /No valid questions found/);
});

test('getSampleJson and getSampleCsv generate valid parseable data', () => {
  const jsonSample = Bank.getSampleJson();
  const parsedJson = Bank.parseQuestionData(jsonSample);
  assert.ok(parsedJson.length >= 2);

  const csvSample = Bank.getSampleCsv();
  const parsedCsv = Bank.parseQuestionData(csvSample);
  assert.ok(parsedCsv.length >= 2);
});

const Matcher = require('../matcher.js');

test('ExamMatcher.findBest successfully matches query against parsed custom bank', () => {
  const customCsv = `Question,Answer
"What is the capital of Iceland?","Reykjavik"
"What is the largest organ in the human body?","Skin"
"Who wrote Romeo and Juliet?","William Shakespeare"`;

  const customBank = Bank.parseQuestionData(customCsv);
  const res = Matcher.findBest('capital of Iceland', customBank);
  assert.ok(res.best);
  assert.strictEqual(res.best.answer, 'Reykjavik');
  assert.strictEqual(Matcher.formatAnswer(res.best), 'Reykjavik');
  assert.ok(res.score > 0.6);
});
