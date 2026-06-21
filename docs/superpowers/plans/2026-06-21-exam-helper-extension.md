# Exam Prep Answer-Checker Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that, on a hotkey, reads a question (from selected text or by OCR-ing a dragged screen region) and shows the correct answer in a corner overlay, matched against a bundled 228-question bank — fully offline.

**Architecture:** All client-side. A content script (injected on every page) handles the hotkeys, the region-select crosshair, and the Shadow-DOM corner overlay, and does the fuzzy matching against a bundled question bank. A service worker captures the visible tab and manages an offscreen document. The offscreen document runs Tesseract.js (Web Worker + WASM) to OCR the cropped region — kept off the host page so site CSP can never break it.

**Tech Stack:** Chrome Manifest V3 (service worker, `commands`, `offscreen`), vanilla JS (no build step), Tesseract.js v5 bundled locally (`rus`+`kir` traineddata), Node's built-in `node:test` for unit tests.

---

## File Structure

```
exam/                                  (extension root = repo root)
├── manifest.json                      MV3 manifest: commands, permissions, WAR
├── background.js                      service worker: command relay, captureVisibleTab, offscreen lifecycle
├── content.js                         orchestrator on page: hotkey handlers, crosshair, message wiring
├── matcher.js                         PURE logic: normalize, similarity, flattenBank, findBest, resolveAnswer
├── matcher.test.js                    node:test unit tests for matcher.js
├── overlay.js                         Shadow-DOM corner overlay renderer (content-script scope)
├── ui/overlay.css                     overlay styles (fetched into the shadow root)
├── offscreen.html                     offscreen document host page (loads tesseract + offscreen.js)
├── offscreen.js                       crops the screenshot and runs Tesseract OCR
├── data/tests_data.js                 bundled 228-question bank (copied from the prep site + export shim)
├── vendor/tesseract/
│   ├── tesseract.min.js               Tesseract.js main lib
│   ├── worker.min.js                  Tesseract.js worker script
│   ├── core/                          Tesseract WASM core files (8 files)
│   └── lang/                          rus.traineddata.gz, kir.traineddata.gz
├── test/sample.html                   local manual-test page with known questions
└── README.md                          load + usage instructions
```

**Responsibilities (one job each):**
- `matcher.js` — pure, DOM-free, Node-testable text matching. The reliability core.
- `overlay.js` — only DOM rendering of the result panel inside a shadow root.
- `content.js` — only wiring: listen for commands, gather input (selection / region), call matcher, call overlay.
- `background.js` — only privileged ops: relay commands, `captureVisibleTab`, offscreen create/route.
- `offscreen.js` — only image crop + OCR.

**Message protocol (single source of truth — used across tasks):**
- `background → content tab`: `{type:'START_SCAN'}` and `{type:'CHECK_SELECTION'}`
- `content → background`: `{type:'RUN_OCR', rect:{x,y,width,height}, dpr:number}` → resolves to `{ok:true, text}` or `{ok:false, error}`
- `background → offscreen`: `{target:'offscreen', type:'OCR', dataUrl, rect, dpr}` → resolves to `{ok:true, text}` or `{ok:false, error}`

---

## Task 1: Scaffold, manifest, and bundle the question bank

**Files:**
- Create: `manifest.json`
- Create: `data/tests_data.js` (copied from the prep site)
- Create: `README.md`

- [ ] **Step 1: Copy the question bank into the extension**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force data | Out-Null
Copy-Item "C:\Users\talan\Programming\-\тест сайтик\tests_data.js" "data\tests_data.js"
```

- [ ] **Step 2: Append a CommonJS export shim to the copied bank**

Append these two lines to the END of `data/tests_data.js` (so Node tests can `require` it; harmless in the browser where `module` is undefined):
```js

if (typeof module !== 'undefined' && module.exports) { module.exports = TESTS_DATA; }
```

- [ ] **Step 3: Verify the bank loads in Node and has the expected shape**

Run:
```powershell
node -e "const d=require('./data/tests_data.js'); const subs=Object.keys(d); let n=0; for(const s of subs) for(const t of d[s].tests) n+=t.questions.length; console.log('subjects:',subs.join(','),'total:',n)"
```
Expected: `subjects: geography,history,kyrgyz total: 228`

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Exam Prep Answer Checker",
  "version": "1.0.0",
  "description": "Self-study aid: check your answer against a bundled question bank via selected text or OCR. Offline.",
  "permissions": ["offscreen", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "commands": {
    "check-selection": {
      "suggested_key": { "default": "Alt+Shift+Q" },
      "description": "Check selected text against the question bank"
    },
    "scan-region": {
      "suggested_key": { "default": "Alt+Shift+S" },
      "description": "Scan a screen region with OCR"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["data/tests_data.js", "matcher.js", "overlay.js", "content.js"],
      "run_at": "document_idle"
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "web_accessible_resources": [
    {
      "resources": ["offscreen.html", "offscreen.js", "ui/overlay.css", "vendor/tesseract/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 5: Create `README.md`**

```markdown
# Exam Prep Answer Checker (Chrome extension)

Offline self-study aid. Reads a question from selected text or an OCR'd screen region
and shows the correct answer in a corner overlay, matched against a bundled 228-question bank.

## Hotkeys
- **Alt+Shift+Q** — check the currently selected text
- **Alt+Shift+S** — scan a region: drag a box around the question

Remap in `chrome://extensions/shortcuts`.

## Load it
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. (If you change `data/tests_data.js`, just re-copy it and reload the extension.)

## Update the question bank
Re-copy from the prep site, then re-append the export shim line, then reload the extension.
```

- [ ] **Step 6: Commit**

```powershell
git init; git add -A; git commit -m "chore: scaffold MV3 extension, manifest, bundled question bank"
```

---

## Task 2: matcher.js — text normalization (TDD)

**Files:**
- Create: `matcher.js`
- Create: `matcher.test.js`

- [ ] **Step 1: Write the failing test**

Create `matcher.test.js`:
```js
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
  // latin "o","a","c","p","e" should map to cyrillic look-alikes
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module './matcher.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `matcher.js`:
```js
(function (global) {
  'use strict';

  // Latin glyphs that look identical to Cyrillic ones (common OCR confusions).
  // Mapped latin -> cyrillic so OCR'd latin look-alikes match the Cyrillic bank.
  const HOMOGLYPH = {
    a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т'
  };

  function normalize(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    s = s.replace(/ё/g, 'е');
    s = s.replace(/[acepxykmt]/g, (ch) => HOMOGLYPH[ch] || ch);
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' '); // drop punctuation, keep all letters/digits
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  const api = { normalize };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ExamMatcher = api;
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test`
Expected: PASS (5 normalize tests pass).

- [ ] **Step 5: Commit**

```powershell
git add matcher.js matcher.test.js; git commit -m "feat(matcher): text normalization with homoglyph + punctuation handling"
```

---

## Task 3: matcher.js — similarity scoring (TDD)

**Files:**
- Modify: `matcher.js`
- Modify: `matcher.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `matcher.test.js`:
```js
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
  const noisy = 'на каком гopном хребте располoжен пик пoбеды'; // latin o's injected
  const s = M.score(noisy, original);
  assert.ok(s > 0.7, `expected >0.7 despite noise, got ${s}`);
});

test('score: handles empty input without throwing', () => {
  assert.strictEqual(M.score('', 'что-то'), 0);
  assert.strictEqual(M.score('что-то', ''), 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test`
Expected: FAIL — `M.score is not a function`.

- [ ] **Step 3: Implement scoring**

In `matcher.js`, add these functions above the `const api = ...` line:
```js
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

  // Blended similarity in [0,1]: trigram overlap (robust to char errors) + token overlap.
  function score(a, b) {
    if (!normalize(a) || !normalize(b)) return 0;
    const dice = diceCoefficient(trigrams(a), trigrams(b));
    const jac = tokenJaccard(a, b);
    return 0.6 * dice + 0.4 * jac;
  }
```

Then add them to the exported `api` object:
```js
  const api = { normalize, trigrams, diceCoefficient, tokenJaccard, score };
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test`
Expected: PASS (all normalize + score tests pass).

- [ ] **Step 5: Commit**

```powershell
git add matcher.js matcher.test.js; git commit -m "feat(matcher): blended trigram+token similarity scoring"
```

---

## Task 4: matcher.js — flattenBank, findBest, resolveAnswer (TDD against the real bank)

**Files:**
- Modify: `matcher.js`
- Modify: `matcher.test.js`

- [ ] **Step 1: Write the failing tests (using the real 228-question bank)**

Append to `matcher.test.js`:
```js
const TESTS_DATA = require('./data/tests_data.js');

test('flattenBank flattens all subjects/tests into 228 entries', () => {
  const flat = M.flattenBank(TESTS_DATA);
  assert.strictEqual(flat.length, 228);
  const first = flat[0];
  assert.ok(first.question && Array.isArray(first.options));
  assert.ok(typeof first.answerIndex === 'number');
  assert.ok(first.subjectKey && first.subjectTitle);
});

test('findBest returns the exact question on exact text', () => {
  const flat = M.flattenBank(TESTS_DATA);
  const target = flat[1]; // "На каком горном хребте расположен пик Победы?"
  const res = M.findBest(target.question, flat);
  assert.strictEqual(res.best.id, target.id);
  assert.ok(res.score > 0.95, `score ${res.score}`);
  assert.ok(Array.isArray(res.top) && res.top.length >= 2);
});

test('findBest still finds the right question with OCR-style noise', () => {
  const flat = M.flattenBank(TESTS_DATA);
  const target = flat[1];
  const noisy = target.question.replace(/о/g, 'o'); // cyrillic о -> latin o
  const res = M.findBest(noisy, flat);
  assert.strictEqual(res.best.id, target.id);
});

test('resolveAnswer returns options[answerIndex] normally', () => {
  const flat = M.flattenBank(TESTS_DATA);
  const q = flat.find((x) => !x.verification);
  const a = M.resolveAnswer(q);
  assert.strictEqual(a.text, q.options[q.answerIndex]);
  assert.strictEqual(a.corrected, false);
});

test('resolveAnswer returns the corrected option when a discrepancy is flagged', () => {
  const flat = M.flattenBank(TESTS_DATA);
  const q = flat.find((x) => x.verification && x.verification.status === 'discrepancy');
  assert.ok(q, 'expected at least one verification discrepancy in the bank');
  const a = M.resolveAnswer(q);
  assert.strictEqual(a.text, q.options[q.verification.actualAnswerIndex]);
  assert.strictEqual(a.corrected, true);
  assert.ok(a.note && a.note.length > 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test`
Expected: FAIL — `M.flattenBank is not a function`.

- [ ] **Step 3: Implement flattenBank, findBest, resolveAnswer**

In `matcher.js`, add above the `const api = ...` line:
```js
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

  // Returns { best, score, top: [{cand, score}, ...] }
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

  function resolveAnswer(cand) {
    const v = cand.verification;
    if (v && v.status === 'discrepancy' && Number.isInteger(v.actualAnswerIndex)) {
      return {
        text: cand.options[v.actualAnswerIndex],
        index: v.actualAnswerIndex,
        corrected: true,
        note: v.note || ''
      };
    }
    return { text: cand.options[cand.answerIndex], index: cand.answerIndex, corrected: false, note: '' };
  }
```

Update the exported `api`:
```js
  const api = { normalize, trigrams, diceCoefficient, tokenJaccard, score, flattenBank, findBest, resolveAnswer };
```

Also expose a default confidence threshold for the overlay to use:
```js
  api.CONFIDENCE_THRESHOLD = 0.55;
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test`
Expected: PASS (all matcher tests green).

- [ ] **Step 5: Commit**

```powershell
git add matcher.js matcher.test.js; git commit -m "feat(matcher): flattenBank, findBest, resolveAnswer with verification overrides"
```

---

## Task 5: Corner overlay (overlay.css + overlay.js)

**Files:**
- Create: `ui/overlay.css`
- Create: `overlay.js`

- [ ] **Step 1: Create `ui/overlay.css`**

```css
:host, * { box-sizing: border-box; }
.eh-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 360px;
  max-width: 90vw;
  max-height: 70vh;
  overflow: auto;
  background: #1e1e22;
  color: #f2f2f5;
  font: 14px/1.45 -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  border: 1px solid #3a3a42;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.45);
  z-index: 2147483647;
}
.eh-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; cursor: move; background: #26262c; border-bottom: 1px solid #3a3a42;
  border-radius: 10px 10px 0 0; user-select: none;
}
.eh-title { font-weight: 600; font-size: 13px; }
.eh-close { cursor: pointer; border: none; background: transparent; color: #c9c9cf; font-size: 18px; line-height: 1; padding: 0 4px; }
.eh-close:hover { color: #fff; }
.eh-body { padding: 12px; }
.eh-q { color: #b9b9c2; font-size: 12px; margin-bottom: 8px; }
.eh-answer { font-size: 16px; font-weight: 700; padding: 10px 12px; border-radius: 8px; background: #16331f; color: #7ee29b; border: 1px solid #2c6b40; }
.eh-meta { margin-top: 8px; font-size: 12px; color: #9a9aa4; display: flex; gap: 10px; }
.eh-note { margin-top: 10px; padding: 8px 10px; font-size: 12px; background: #33270f; color: #e8c98a; border: 1px solid #6b572c; border-radius: 8px; }
.eh-low { background: #2a2030; color: #e6b3f0; border-color: #6b3c7a; }
.eh-guesses { margin: 8px 0 0; padding-left: 18px; }
.eh-guesses li { margin: 3px 0; color: #d6d6dd; }
.eh-error { color: #ff9b9b; }
```

- [ ] **Step 2: Create `overlay.js`** (runs in the content-script isolated world; exposes `window.ExamOverlay`)

```js
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

  // result: output of ExamMatcher.findBest; threshold from ExamMatcher.CONFIDENCE_THRESHOLD
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
```

- [ ] **Step 3: Sanity check (no automated test; verified during Task 10 E2E)**

Confirm the file has no syntax errors:
Run: `node -c overlay.js`
Expected: no output (exit 0). *(Note: `chrome`/`window` are referenced but `node -c` only parses, it does not execute.)*

- [ ] **Step 4: Commit**

```powershell
git add overlay.js ui/overlay.css; git commit -m "feat(overlay): shadow-dom corner panel with result/low-confidence/message states"
```

---

## Task 6: background.js — service worker

**Files:**
- Create: `background.js`

- [ ] **Step 1: Create `background.js`**

```js
'use strict';

// --- Offscreen document lifecycle (hosts Tesseract) ---
let creatingOffscreen = null;

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  if (has) return;
  if (creatingOffscreen) { await creatingOffscreen; return; }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run Tesseract.js OCR in a Web Worker with WebAssembly.'
  });
  await creatingOffscreen;
  creatingOffscreen = null;
}

// --- Hotkey commands: relay to the active tab's content script ---
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || !tab.id) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = active;
  }
  if (!tab || !tab.id) return;
  const type = command === 'scan-region' ? 'START_SCAN'
             : command === 'check-selection' ? 'CHECK_SELECTION' : null;
  if (!type) return;
  try { await chrome.tabs.sendMessage(tab.id, { type }); }
  catch (e) { /* content script not present on this page (e.g. chrome://) */ }
});

// --- OCR request from content script ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'RUN_OCR') {
    handleRunOcr(msg, sender).then(sendResponse).catch((e) =>
      sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true; // async response
  }
  return false;
});

async function handleRunOcr(msg, sender) {
  const windowId = sender.tab ? sender.tab.windowId : undefined;
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  } catch (e) {
    return { ok: false, error: 'Cannot capture this page (' + (e.message || e) + ')' };
  }
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({
    target: 'offscreen', type: 'OCR', dataUrl, rect: msg.rect, dpr: msg.dpr
  });
  return res || { ok: false, error: 'No OCR response' };
}
```

- [ ] **Step 2: Syntax check**

Run: `node -c background.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add background.js; git commit -m "feat(background): command relay, captureVisibleTab, offscreen OCR routing"
```

---

## Task 7: Download and bundle Tesseract.js (vendor assets)

**Files:**
- Create: `vendor/tesseract/tesseract.min.js`
- Create: `vendor/tesseract/worker.min.js`
- Create: `vendor/tesseract/core/*` (8 files)
- Create: `vendor/tesseract/lang/rus.traineddata.gz`, `vendor/tesseract/lang/kir.traineddata.gz`

- [ ] **Step 1: Create folders**

```powershell
New-Item -ItemType Directory -Force vendor\tesseract\core | Out-Null
New-Item -ItemType Directory -Force vendor\tesseract\lang | Out-Null
```

- [ ] **Step 2: Download the main lib + worker (Tesseract.js v5)**

```powershell
$base = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist"
Invoke-WebRequest "$base/tesseract.min.js" -OutFile "vendor\tesseract\tesseract.min.js"
Invoke-WebRequest "$base/worker.min.js"   -OutFile "vendor\tesseract\worker.min.js"
```

- [ ] **Step 3: Download the WASM core files (tesseract.js-core v5)**

```powershell
$core = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5"
$files = @(
  "tesseract-core.wasm","tesseract-core.wasm.js",
  "tesseract-core-simd.wasm","tesseract-core-simd.wasm.js",
  "tesseract-core-lstm.wasm","tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm","tesseract-core-simd-lstm.wasm.js"
)
foreach ($f in $files) { Invoke-WebRequest "$core/$f" -OutFile "vendor\tesseract\core\$f" }
```

- [ ] **Step 4: Download the language data (Russian + Kyrgyz)**

```powershell
$lang = "https://tessdata.projectnaptha.com/4.0.0"
Invoke-WebRequest "$lang/rus.traineddata.gz" -OutFile "vendor\tesseract\lang\rus.traineddata.gz"
Invoke-WebRequest "$lang/kir.traineddata.gz" -OutFile "vendor\tesseract\lang\kir.traineddata.gz"
```

- [ ] **Step 5: Verify all files exist and are non-trivial in size**

```powershell
Get-ChildItem -Recurse vendor\tesseract | Select-Object FullName, Length
```
Expected: `tesseract.min.js` and `worker.min.js` present; 8 files under `core\`; two `.traineddata.gz` files in `lang\`, each at least several hundred KB (rus ~ a few MB). If `kir.traineddata.gz` 404s, fall back to:
`https://cdn.jsdelivr.net/npm/@tesseract.js-data/kir@1.0.0/4.0.0_best_int/kir.traineddata.gz`
(and likewise `@tesseract.js-data/rus` for rus).

- [ ] **Step 6: Commit**

```powershell
git add vendor; git commit -m "chore(vendor): bundle Tesseract.js v5 + rus/kir language data"
```

---

## Task 8: offscreen document — crop + OCR

**Files:**
- Create: `offscreen.html`
- Create: `offscreen.js`

- [ ] **Step 1: Create `offscreen.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <script src="vendor/tesseract/tesseract.min.js"></script>
    <script src="offscreen.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `offscreen.js`**

```js
'use strict';

let workerPromise = null;

function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const worker = await Tesseract.createWorker(['rus', 'kir'], 1, {
      workerPath: chrome.runtime.getURL('vendor/tesseract/worker.min.js'),
      corePath: chrome.runtime.getURL('vendor/tesseract/core/'),
      langPath: chrome.runtime.getURL('vendor/tesseract/lang/'),
      gzip: true,
      cacheMethod: 'none'
    });
    return worker;
  })();
  return workerPromise;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
}

async function cropToCanvas(dataUrl, rect, dpr) {
  const img = await loadImage(dataUrl);
  const sx = Math.max(0, Math.round(rect.x * dpr));
  const sy = Math.max(0, Math.round(rect.y * dpr));
  const sw = Math.max(1, Math.round(rect.width * dpr));
  const sh = Math.max(1, Math.round(rect.height * dpr));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen' || msg.type !== 'OCR') return false;
  (async () => {
    try {
      const canvas = await cropToCanvas(msg.dataUrl, msg.rect, msg.dpr);
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      sendResponse({ ok: true, text: (data && data.text) || '' });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // async
});
```

- [ ] **Step 3: Syntax check**

Run: `node -c offscreen.js`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```powershell
git add offscreen.html offscreen.js; git commit -m "feat(offscreen): crop screenshot and run Tesseract OCR"
```

---

## Task 9: content.js — wiring (selection mode, message handling, OCR result)

**Files:**
- Create: `content.js`

- [ ] **Step 1: Create `content.js`**

```js
'use strict';

const FLAT_BANK = window.ExamMatcher.flattenBank(window.TESTS_DATA);
const THRESHOLD = window.ExamMatcher.CONFIDENCE_THRESHOLD;

function checkText(text) {
  if (!text || !text.trim()) {
    window.ExamOverlay.showMessage('Select the question text first, then press Alt+Shift+Q.');
    return;
  }
  const result = window.ExamMatcher.findBest(text, FLAT_BANK);
  window.ExamOverlay.showResult(result, THRESHOLD);
}

function checkSelection() {
  const sel = String(window.getSelection ? window.getSelection() : '').trim();
  checkText(sel);
}

// OCR result handler used by Task 10's region-select flow.
async function runOcr(rect, dpr) {
  window.ExamOverlay.showMessage('Reading… (OCR)');
  let res;
  try {
    res = await chrome.runtime.sendMessage({ type: 'RUN_OCR', rect, dpr });
  } catch (e) {
    window.ExamOverlay.showMessage('OCR failed: ' + (e.message || e), true);
    return;
  }
  if (!res || !res.ok) {
    window.ExamOverlay.showMessage('OCR failed: ' + ((res && res.error) || 'unknown'), true);
    return;
  }
  checkText(res.text);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === 'CHECK_SELECTION') checkSelection();
  else if (msg.type === 'START_SCAN') window.ExamRegion.start(runOcr);
});
```

- [ ] **Step 2: Syntax check**

Run: `node -c content.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add content.js; git commit -m "feat(content): selection-mode checking and message wiring"
```

---

## Task 10: Region-select crosshair (region.js)

**Files:**
- Create: `region.js`
- Modify: `manifest.json` (add `region.js` to content scripts, before `content.js`)

- [ ] **Step 1: Create `region.js`** (exposes `window.ExamRegion.start(callback)`)

```js
(function () {
  'use strict';

  function start(onComplete) {
    const layer = document.createElement('div');
    Object.assign(layer.style, {
      position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
      zIndex: 2147483646, cursor: 'crosshair', background: 'rgba(0,0,0,0.08)'
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', border: '2px solid #4da3ff',
      background: 'rgba(77,163,255,0.15)', display: 'none', zIndex: 2147483646
    });
    layer.appendChild(box);
    document.documentElement.appendChild(layer);

    let sx = 0, sy = 0, dragging = false;

    function cleanup() { layer.remove(); }

    layer.addEventListener('mousedown', (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      Object.assign(box.style, { left: sx + 'px', top: sy + 'px', width: '0px', height: '0px', display: 'block' });
      e.preventDefault();
    });
    layer.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    });
    layer.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const rect = {
        x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY),
        width: Math.abs(e.clientX - sx), height: Math.abs(e.clientY - sy)
      };
      const dpr = window.devicePixelRatio || 1;
      cleanup();
      if (rect.width < 5 || rect.height < 5) return; // ignore tiny/accidental drags
      // Wait two frames so the crosshair layer is gone before the screenshot is taken.
      requestAnimationFrame(() => requestAnimationFrame(() => onComplete(rect, dpr)));
    });
    // Esc cancels.
    window.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') { cleanup(); window.removeEventListener('keydown', onKey); }
    });
  }

  window.ExamRegion = { start };
})();
```

- [ ] **Step 2: Add `region.js` to the content scripts in `manifest.json`**

Change the content_scripts `js` array to include `region.js` before `content.js`:
```json
      "js": ["data/tests_data.js", "matcher.js", "overlay.js", "region.js", "content.js"],
```

- [ ] **Step 3: Syntax check**

Run: `node -c region.js`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```powershell
git add region.js manifest.json; git commit -m "feat(region): drag-to-select crosshair for OCR capture"
```

---

## Task 11: Manual end-to-end test + sample page

**Files:**
- Create: `test/sample.html`

- [ ] **Step 1: Create a local test page with two known questions**

Create `test/sample.html` (text copied from the bank so matching is exact):
```html
<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>Exam Helper test page</title>
<style>body{font:18px/1.6 Arial;max-width:760px;margin:40px auto;padding:0 16px}</style></head>
<body>
  <h1>Test page</h1>
  <p id="q1">На каком горном хребте расположен пик Победы?</p>
  <ol type="A"><li>Алайский</li><li>Бозкыр</li><li>Акшыйрак</li><li>Сарыжазский</li></ol>
  <hr>
  <p id="q2">В каком городе Кыргызстана расположена крупнейшая ТЭЦ?</p>
  <ol type="A"><li>Бишкек</li><li>Ош</li><li>Талас</li><li>Каракол</li></ol>
</body>
</html>
```

- [ ] **Step 2: Run the full unit-test suite one last time**

Run: `node --test`
Expected: PASS — all matcher tests green.

- [ ] **Step 3: Load the extension**

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `exam` folder.
2. Confirm no errors on the extension card. Click **service worker** to open its console; confirm no load errors.
3. Open `test/sample.html` in Chrome (drag the file into a tab).

- [ ] **Step 4: Verify selection mode**

1. Select the text of question 1 (the `<p id="q1">` sentence).
2. Press **Alt+Shift+Q**.
3. Expect the corner overlay to show the question, answer **"Сарыжазский"**, a high match %, and subject **География Кыргызстана**.

- [ ] **Step 5: Verify low-confidence mode**

1. Select an unrelated sentence (e.g. the page title "Test page").
2. Press **Alt+Shift+Q**.
3. Expect the **"No confident match… Did you mean:"** state with up to two guesses.

- [ ] **Step 6: Verify OCR region mode**

1. Press **Alt+Shift+S** (crosshair appears).
2. Drag a box tightly around question 2's sentence.
3. Wait for "Reading… (OCR)" then expect the answer **"Бишкек"** with a reasonable match %. (First OCR run is slower — the worker initializes.)

- [ ] **Step 7: Verify a verification-corrected question (optional but recommended)**

1. Find a question in `data/tests_data.js` whose object has a `verification` block with `status: "discrepancy"` (e.g. `geo_q3`).
2. Put its `question` text on a page (or add it to `test/sample.html`), select it, press **Alt+Shift+Q**.
3. Expect the overlay to show the **corrected** option and an amber note explaining the correction.

- [ ] **Step 8: Commit**

```powershell
git add test/sample.html; git commit -m "test: manual E2E sample page and checklist"
```

---

## Self-Review Notes

**Spec coverage check:**
- Works on any site → `<all_urls>` content script + host permission (Task 1). ✓
- Local offline OCR (Tesseract rus+kir) → Tasks 7, 8. ✓
- Text-selection mode + hotkey → Tasks 9, 1 (command). ✓
- OCR region mode + hotkey → Tasks 6, 8, 10. ✓
- Fuzzy matching vs 228-question bank → Tasks 2–4. ✓
- Corner overlay: matched question, correct option, confidence, subject, verification note, low-confidence top-2, error states → Task 5. ✓
- Read-only (no page modification) → overlay only; nothing clicks the page. ✓
- Shadow DOM isolation → Task 5. ✓
- Verification discrepancy → corrected answer → Task 4 `resolveAnswer`, shown in Task 5. ✓
- Hotkeys Alt+Shift+Q / Alt+Shift+S, remappable → manifest `commands` (Task 1). ✓
- Confidence threshold 0.55 → `ExamMatcher.CONFIDENCE_THRESHOLD` (Task 4). ✓

**Type/name consistency:** `flattenBank`, `findBest` (returns `{best, score, top}`), `resolveAnswer` (returns `{text,index,corrected,note}`), `CONFIDENCE_THRESHOLD`, `window.ExamMatcher`, `window.ExamOverlay.{showResult,showMessage}`, `window.ExamRegion.start(cb)`, message types `START_SCAN`/`CHECK_SELECTION`/`RUN_OCR`/`OCR` — all consistent across tasks.

**Known follow-ups (not blocking):** tune `CONFIDENCE_THRESHOLD` and the `score` weights during real OCR use; if `kir.traineddata.gz` is unavailable on the primary mirror, use the jsdelivr fallback in Task 7 Step 5.
