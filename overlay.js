(function () {
  'use strict';

  const HOST_ID = 'exam-helper-overlay-host';
  let cssText = null;

  async function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host.shadowRoot;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.all = 'initial';
    (document.documentElement || document.body).appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    if (cssText === null) {
      try {
        cssText = await fetch(chrome.runtime.getURL('ui/overlay.css')).then((r) => r.text());
      } catch (e) { cssText = ''; }
    }
    const style = document.createElement('style');
    style.textContent = cssText;
    shadow.appendChild(style);
    return shadow;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  async function renderPanel(buildBody) {
    const shadow = await ensureHost();
    const old = shadow.querySelector('.eh-panel');
    if (old) old.remove();
    const panel = el('div', 'eh-panel');
    const close = el('button', 'eh-close', '×');
    close.addEventListener('click', () => panel.remove());
    panel.appendChild(close);
    const body = el('div', 'eh-body');
    buildBody(body);
    panel.appendChild(body);
    shadow.appendChild(panel);
  }

  // Minimal, translucent overlay: shows ONLY the correct answer when confident,
  // or the possible answers when the match is uncertain.
  function showResult(result, threshold) {
    return renderPanel((body) => {
      if (!result || !result.best) {
        body.appendChild(el('div', 'eh-dim', 'no match'));
        return;
      }
      if (result.score < threshold) {
        body.appendChild(el('div', 'eh-label', 'possible answers'));
        const ul = el('ul', 'eh-guesses');
        result.top.slice(0, 2).forEach((t) => {
          const a = window.ExamMatcher.resolveAnswer(t.cand);
          ul.appendChild(el('li', null, a.text));
        });
        body.appendChild(ul);
        return;
      }
      // resolveAnswer already returns the corrected option when the bank flagged
      // a discrepancy, so this is always the actual correct answer.
      const ans = window.ExamMatcher.resolveAnswer(result.best);
      body.appendChild(el('div', 'eh-answer', ans.text));
    });
  }

  function showMessage(msg, isError) {
    return renderPanel((body) => {
      body.appendChild(el('div', isError ? 'eh-error' : 'eh-dim', msg));
    });
  }

  window.ExamOverlay = { showResult, showMessage };
})();
