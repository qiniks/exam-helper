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

  function makeDraggable(panel, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = (ox + e.clientX - sx) + 'px';
      panel.style.top = (oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  async function renderPanel(buildBody) {
    const shadow = await ensureHost();
    const old = shadow.querySelector('.eh-panel');
    if (old) old.remove();
    const panel = el('div', 'eh-panel');
    const header = el('div', 'eh-header');
    header.appendChild(el('span', 'eh-title', 'Exam Helper'));
    const close = el('button', 'eh-close', '×');
    close.addEventListener('click', () => panel.remove());
    header.appendChild(close);
    panel.appendChild(header);
    const body = el('div', 'eh-body');
    buildBody(body);
    panel.appendChild(body);
    shadow.appendChild(panel);
    makeDraggable(panel, header);
  }

  function showResult(result, threshold) {
    return renderPanel((body) => {
      if (!result || !result.best) {
        body.appendChild(el('div', 'eh-error', 'No questions to match against.'));
        return;
      }
      if (result.score < threshold) {
        body.appendChild(el('div', 'eh-note eh-low', 'No confident match. Did you mean:'));
        const ul = el('ul', 'eh-guesses');
        result.top.slice(0, 2).forEach((t) => {
          const a = window.ExamMatcher.resolveAnswer(t.cand);
          const li = el('li');
          li.textContent = `${t.cand.question}  →  ${a.text}  (${Math.round(t.score * 100)}%)`;
          ul.appendChild(li);
        });
        body.appendChild(ul);
        return;
      }
      const ans = window.ExamMatcher.resolveAnswer(result.best);
      body.appendChild(el('div', 'eh-q', result.best.question));
      body.appendChild(el('div', 'eh-answer', ans.text));
      const meta = el('div', 'eh-meta');
      meta.appendChild(el('span', null, `${Math.round(result.score * 100)}% match`));
      meta.appendChild(el('span', null, result.best.subjectTitle));
      body.appendChild(meta);
      if (ans.corrected) {
        body.appendChild(el('div', 'eh-note', 'Corrected answer (original key was wrong): ' + ans.note));
      }
    });
  }

  function showMessage(msg, isError) {
    return renderPanel((body) => {
      body.appendChild(el('div', isError ? 'eh-error' : 'eh-q', msg));
    });
  }

  window.ExamOverlay = { showResult, showMessage };
})();
