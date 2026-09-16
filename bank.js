(function (global) {
  'use strict';

  /**
   * Parse CSV or TSV text into an array of rows.
   * Handles quoted fields containing commas, tabs, and line breaks.
   */
  function parseDelimitedText(text, delimiter) {
    if (!text || !text.trim()) return [];
    
    // Auto-detect delimiter if not explicitly provided
    if (!delimiter) {
      const firstLine = text.split(/\r?\n/)[0] || '';
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const semiCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
      else if (semiCount > commaCount) delimiter = ';';
      else delimiter = ',';
    }

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote: ""
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i++;
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === '\r' && nextChar === '\n') i++;
        i++;
      } else {
        currentField += char;
        i++;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Normalize an array of raw candidate objects or questions into uniform candidates.
   */
  function normalizeCandidates(items, defaultSubject) {
    const list = [];
    const fallbackSubject = defaultSubject || 'Custom';

    (items || []).forEach((item, idx) => {
      if (!item) return;
      const qText = String(item.question || item.q || item.title || '').trim();
      if (!qText) return;

      let answer = '';
      let options = Array.isArray(item.options) ? item.options.map((o) => String(o).trim()) : [];
      let answerIndex = Number.isInteger(item.answerIndex) ? item.answerIndex : -1;

      if (item.answer != null) {
        answer = String(item.answer).trim();
      } else if (item.a != null) {
        answer = String(item.a).trim();
      }

      // If answerIndex is provided and matches an option, extract answer if missing
      if (answerIndex >= 0 && answerIndex < options.length && !answer) {
        answer = options[answerIndex];
      } else if (answer && options.length > 0 && answerIndex === -1) {
        // Find if answer matches one of the options
        const matchIdx = options.findIndex((opt) => opt.toLowerCase() === answer.toLowerCase());
        if (matchIdx !== -1) answerIndex = matchIdx;
      }

      list.push({
        id: item.id || `custom_q${idx + 1}`,
        question: qText,
        answer: answer || (options.length > 0 && answerIndex >= 0 ? options[answerIndex] : ''),
        options: options,
        answerIndex: answerIndex >= 0 ? answerIndex : 0,
        verification: item.verification || null,
        subjectKey: item.subjectKey || 'custom',
        subjectTitle: item.subjectTitle || fallbackSubject
      });
    });

    return list;
  }

  /**
   * Parse CSV / TSV rows into questions.
   */
  function parseFromRows(rows) {
    if (!rows || rows.length === 0) return [];
    let startIdx = 0;
    const header = rows[0].map((c) => c.toLowerCase());

    let qCol = -1;
    let aCol = -1;
    let optCols = [];

    // Check if first row is a header
    const hasHeader = header.some((h) =>
      ['question', 'q', 'вопрос', 'answer', 'a', 'ответ', 'options'].includes(h)
    );

    if (hasHeader) {
      startIdx = 1;
      header.forEach((h, idx) => {
        if (h === 'question' || h === 'q' || h === 'вопрос') qCol = idx;
        else if (h === 'answer' || h === 'a' || h === 'ответ' || h === 'correct') aCol = idx;
        else if (h.startsWith('option') || h.startsWith('вариант') || h === 'options') optCols.push(idx);
      });
    }

    // If columns weren't identified by header, assume first column is Question, second is Answer
    if (qCol === -1) qCol = 0;
    if (aCol === -1 && rows[0].length > 1) aCol = 1;

    const rawItems = [];
    for (let r = startIdx; r < rows.length; r++) {
      const row = rows[r];
      const q = (row[qCol] || '').trim();
      const a = aCol !== -1 ? (row[aCol] || '').trim() : '';
      if (!q) continue;

      let options = [];
      if (optCols.length > 0) {
        options = optCols.map((c) => (row[c] || '').trim()).filter(Boolean);
      } else if (row.length > 2 && aCol === 1) {
        // Remaining columns are options
        options = row.slice(2).map((c) => (c || '').trim()).filter(Boolean);
      }

      rawItems.push({
        id: `row_${r}`,
        question: q,
        answer: a,
        options: options
      });
    }

    return normalizeCandidates(rawItems);
  }

  /**
   * Main parsing function: accepts raw text (JSON or CSV/TSV) or parsed JS Object.
   */
  function parseQuestionData(rawInput, defaultSubject) {
    if (!rawInput) {
      throw new Error('Input is empty.');
    }

    let parsed = rawInput;
    if (typeof rawInput === 'string') {
      const trimmed = rawInput.trim();
      if (!trimmed) throw new Error('Input is empty.');

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (err) {
          throw new Error('Invalid JSON format: ' + (err.message || err));
        }
      } else {
        // Assume CSV / TSV text
        const rows = parseDelimitedText(trimmed);
        if (!rows || rows.length === 0) {
          throw new Error('No data found in delimited text.');
        }
        const candidates = parseFromRows(rows);
        if (candidates.length === 0) {
          throw new Error('No valid questions could be extracted from text.');
        }
        return candidates;
      }
    }

    // Process parsed object / array
    if (Array.isArray(parsed)) {
      // Flat array of questions
      const candidates = normalizeCandidates(parsed, defaultSubject);
      if (candidates.length === 0) {
        throw new Error('No valid questions found in array (each question must have a "question" or "q" field).');
      }
      return candidates;
    }

    if (typeof parsed === 'object' && parsed !== null) {
      // Check if it's the bundled nested format: { subject: { tests: [{ questions: [] }] } }
      const hasSubjectTests = Object.values(parsed).some(
        (val) => val && Array.isArray(val.tests)
      );
      if (hasSubjectTests) {
        const out = [];
        for (const subjectKey of Object.keys(parsed)) {
          const subject = parsed[subjectKey] || {};
          const subjTitle = subject.title || subjectKey;
          for (const t of subject.tests || []) {
            const testQuestions = normalizeCandidates(t.questions || [], subjTitle);
            testQuestions.forEach((q) => {
              q.subjectKey = subjectKey;
              q.subjectTitle = subjTitle;
              out.push(q);
            });
          }
        }
        if (out.length === 0) {
          throw new Error('Nested tests object contains no questions.');
        }
        return out;
      }

      // Check if it's `{ tests: [{ questions: [] }] }`
      if (Array.isArray(parsed.tests)) {
        const out = [];
        for (const t of parsed.tests) {
          const testQuestions = normalizeCandidates(t.questions || [], t.title || defaultSubject);
          out.push(...testQuestions);
        }
        if (out.length === 0) {
          throw new Error('Tests array contains no questions.');
        }
        return out;
      }

      // Check if it has a `questions` property: `{ questions: [...] }`
      if (Array.isArray(parsed.questions)) {
        const candidates = normalizeCandidates(parsed.questions, parsed.title || defaultSubject);
        if (candidates.length === 0) {
          throw new Error('Questions array contains no valid entries.');
        }
        return candidates;
      }

      // Key-value pair format: { "Question 1": "Answer 1", "Question 2": "Answer 2" }
      const entries = Object.entries(parsed);
      if (entries.length > 0 && typeof entries[0][1] === 'string') {
        const items = entries.map(([q, a], idx) => ({
          id: `entry_${idx + 1}`,
          question: q,
          answer: a
        }));
        return normalizeCandidates(items, defaultSubject);
      }
    }

    throw new Error('Unrecognized question data format. Use JSON array or CSV format.');
  }

  /**
   * Sample templates for users to download
   */
  function getSampleJson() {
    return JSON.stringify(
      [
        {
          question: "What is the capital of France?",
          answer: "Paris",
          options: ["London", "Berlin", "Paris", "Madrid"],
          answerIndex: 2
        },
        {
          question: "Which planet is known as the Red Planet?",
          answer: "Mars"
        },
        {
          question: "What is the largest ocean on Earth?",
          options: ["Atlantic Ocean", "Pacific Ocean", "Indian Ocean", "Arctic Ocean"],
          answerIndex: 1
        }
      ],
      null,
      2
    );
  }

  function getSampleCsv() {
    return (
      'Question,Answer,Option1,Option2,Option3,Option4\r\n' +
      '"What is the capital of France?","Paris","London","Berlin","Paris","Madrid"\r\n' +
      '"Which planet is known as the Red Planet?","Mars","","","",""\r\n' +
      '"What is the chemical symbol for water?","H2O","CO2","H2O","O2","NaCl"\r\n'
    );
  }

  const api = {
    parseQuestionData,
    parseDelimitedText,
    normalizeCandidates,
    getSampleJson,
    getSampleCsv
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ExamBank = api;
})(typeof self !== 'undefined' ? self : this);
