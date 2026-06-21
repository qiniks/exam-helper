(function (global) {
  'use strict';

  const HOMOGLYPH = {
    a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т'
  };

  function normalize(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    s = s.replace(/ё/g, 'е');
    s = s.replace(/[acepxykmt]/g, (ch) => HOMOGLYPH[ch] || ch);
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  const api = { normalize };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ExamMatcher = api;
})(typeof self !== 'undefined' ? self : this);
