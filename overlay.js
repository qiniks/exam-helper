(function () {
  'use strict';

  const HOST_ID = 'exam-helper-overlay-host';
  const DEFAULT_AUTOCLOSE_MS = 1500;
  let cssText = null;
  let autoCloseTimer = null;
  let shadowRef = null;

  const FONT_FAMILIES = {
    system: '-apple-system, Segoe UI, Roboto, Arial, sans-serif',
    mono: "'Courier New', Courier, monospace",
    serif: "Georgia, 'Times New Roman', serif"
  };

  const DEFAULT_SETTINGS = { answerFontSize: 11, baseFontSize: 14, fontFamily: 'system' };
  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);

  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    currentSettings = Object.assign({}, DEFAULT_SETTINGS, stored);
    if (shadowRef) applySettings(shadowRef);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let changed = false;
    ['answerFontSize', 'baseFontSize', 'fontFamily'].forEach((k) => {
      if (k in changes) { currentSettings[k] = changes[k].newValue; changed = true; }
    });
    if (changed && shadowRef) applySettings(shadowRef);
  });

  function buildSettingsCSS(s) {
    const ff = FONT_FAMILIES[s.fontFamily] || FONT_FAMILIES.system;
    return (
      `.eh-panel{font-size:${s.baseFontSize}px;font-family:${ff}}` +
      `.eh-answer{font-size:${s.answerFontSize}px}` +
      `.eh-guesses li{font-size:${s.answerFontSize}px}`
    );
  }

  function applySettings(shadow) {
    let cfgStyle = shadow.querySelector('#eh-cfg');
    if (!cfgStyle) {
      cfgStyle = document.createElement('style');
      cfgStyle.id = 'eh-cfg';
      shadow.appendChild(cfgStyle);
    }
    cfgStyle.textContent = buildSettingsCSS(currentSettings);
  }

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
    shadowRef = shadow;
    applySettings(shadow);
    return shadow;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clearAutoClose() {
    if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  }

  async function renderPanel(buildBody, autoCloseMs) {
    const shadow = await ensureHost();
    clearAutoClose();
    const old = shadow.querySelector('.eh-panel');
    if (old) old.remove();
    const panel = el('div', 'eh-panel');
    const body = el('div', 'eh-body');
    buildBody(body);
    panel.appendChild(body);
    shadow.appendChild(panel);
    if (autoCloseMs && autoCloseMs > 0) {
      autoCloseTimer = setTimeout(() => {
        if (panel.isConnected) panel.remove();
        autoCloseTimer = null;
      }, autoCloseMs);
    }
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
          ul.appendChild(el('li', null, window.ExamMatcher.formatAnswer(t.cand)));
        });
        body.appendChild(ul);
        return;
      }
      body.appendChild(el('div', 'eh-answer', window.ExamMatcher.formatAnswer(result.best)));
    }, DEFAULT_AUTOCLOSE_MS);
  }

  function showMessage(msg, isError, autoCloseMs) {
    if (autoCloseMs === undefined) autoCloseMs = DEFAULT_AUTOCLOSE_MS;
    return renderPanel((body) => {
      body.appendChild(el('div', isError ? 'eh-error' : 'eh-dim', msg));
    }, autoCloseMs);
  }

  window.ExamOverlay = { showResult, showMessage };
})();
