(function (global) {
  'use strict';

  const HOMOGLYPH = {
    a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т'
  };

  function normalize(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    s = s.replace(/ё/g, 'е');
    s = s.replace(/[aceopxykmt]/g, (ch) => HOMOGLYPH[ch] || ch);
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function trigrams(s) {
    const norm = normalize(s);
    if (!norm) return new Set();
    const padded = '  ' + norm + '  ';
    const set = new Set();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  }

  function diceCoefficient(aSet, bSet) {
    if (aSet.size === 0 || bSet.size === 0) return 0;
    let inter = 0;
    for (const g of aSet) if (bSet.has(g)) inter++;
    return (2 * inter) / (aSet.size + bSet.size);
  }

  function tokenJaccard(a, b) {
    const at = new Set(normalize(a).split(' ').filter(Boolean));
    const bt = new Set(normalize(b).split(' ').filter(Boolean));
    if (at.size === 0 || bt.size === 0) return 0;
    let inter = 0;
    for (const t of at) if (bt.has(t)) inter++;
    const union = at.size + bt.size - inter;
    return inter / union;
  }

  function score(a, b) {
    if (!normalize(a) || !normalize(b)) return 0;
    const dice = diceCoefficient(trigrams(a), trigrams(b));
    const jac = tokenJaccard(a, b);
    return 0.6 * dice + 0.4 * jac;
  }

  function flattenBank(data) {
    const out = [];
    for (const subjectKey of Object.keys(data || {})) {
      const subject = data[subjectKey] || {};
      for (const t of subject.tests || []) {
        for (const q of t.questions || []) {
          out.push({
            subjectKey,
            subjectTitle: subject.title || subjectKey,
            id: q.id,
            question: q.question,
            options: q.options || [],
            answerIndex: q.answerIndex,
            verification: q.verification || null
          });
        }
      }
    }
    return out;
  }

  function findBest(query, flatBank, topN) {
    topN = topN || 3;
    const scored = flatBank.map((cand) => ({ cand, score: score(query, cand.question) }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topN);
    return {
      best: top.length ? top[0].cand : null,
      score: top.length ? top[0].score : 0,
      top
    };
  }

  // Display string for a question's answer. When the bank flags a verification
  // discrepancy whose actualAnswerIndex differs, both are shown: the original
  // (bank) answer first, the verification alternative in brackets.
  function formatAnswer(cand) {
    const base = cand.options[cand.answerIndex];
    const v = cand.verification;
    if (v && v.status === 'discrepancy' && Number.isInteger(v.actualAnswerIndex)
        && v.actualAnswerIndex !== cand.answerIndex) {
      return base + ' (' + cand.options[v.actualAnswerIndex] + ')';
    }
    return base;
  }

  const api = { normalize, trigrams, diceCoefficient, tokenJaccard, score, flattenBank, findBest, formatAnswer };
  api.CONFIDENCE_THRESHOLD = 0.55;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ExamMatcher = api;
})(typeof self !== 'undefined' ? self : this);
