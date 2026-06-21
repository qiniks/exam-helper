# Exam Prep Answer-Checker — Chrome Extension Design

**Date:** 2026-06-21
**Status:** Approved (design), pending implementation plan

## Purpose

A personal study aid for exam preparation. While practicing with demo/multiple-choice
questions on any website, the user wants to instantly check whether their chosen answer
is correct against a bundled bank of known questions — instead of manually searching a
large document every time.

The extension reads a question (either from selected text or by OCR-ing a screenshot of
a screen region) and displays the **correct answer in a corner overlay**. It is a
read-only checker: it never clicks, marks, or modifies the page.

## Scope

### In scope
- Chrome Manifest V3 extension, fully client-side and offline.
- Works on **any website** (`<all_urls>`).
- **Two lookup modes:**
  - **Text-selection mode** — select question text, press a hotkey, get an instant match.
  - **OCR mode** — press a hotkey, drag a box around the question, OCR it, get a match.
- **Local OCR** via Tesseract.js with Russian (`rus`) and Kyrgyz (`kir`) language data.
- **Fuzzy matching** of the read question against a bundled bank of 228 questions.
- **Corner overlay** showing the matched question, the correct option, confidence,
  subject, and any verification note; with a low-confidence / no-match fallback.

### Out of scope (YAGNI)
- Parsing `.docx` / PDF source files (the structured bank is already clean).
- Any cloud / network calls or API keys.
- Auto-selecting or auto-clicking answers on the host page.
- Accounts, login, sync.
- A full settings/options page (sensible hardcoded defaults; hotkeys are remappable via
  Chrome's built-in `chrome://extensions/shortcuts`).

## Data source

Bundled from the existing prep site at `C:\Users\talan\Programming\-\тест сайтик\tests_data.js`.

- 3 subjects, **228 multiple-choice questions** total (Cyrillic — Russian & Kyrgyz):
  - `geography` — География Кыргызстана — 100 questions
  - `history` — История Кыргызстана — 68 questions
  - `kyrgyz` — Кыргызский язык и литература — 60 questions
- Question shape:
  ```js
  {
    id: "geo_q3",
    question: "...",
    options: ["...", "...", "...", "..."],
    answerIndex: 2,                 // index into options of the correct answer
    verification?: {                // optional: flags a wrong key + correction
      status: "discrepancy",
      actualAnswerIndex: 1,
      source: "https://...",
      note: "...",
      proof: "..."
    }
  }
  ```
- The bank is copied into the extension at build time as `data/tests_data.js`. If the
  source data changes, re-copy the file (a small copy step, documented in the plan).

## Architecture

Chrome Manifest V3, all client-side, no network.

```
exam-helper/
├── manifest.json          MV3: commands (hotkeys), permissions, web_accessible_resources
├── background.js          service worker — captureVisibleTab on request
├── content.js             injected on <all_urls> — hotkeys, region-select UI, overlay host
├── matcher.js             text normalization + fuzzy scoring against the bank
├── ocr.js                 Tesseract worker setup + crop-and-recognize helper
├── data/tests_data.js     bundled 228-question bank (copied from the prep site)
├── vendor/tesseract/      tesseract.min.js, worker, wasm core, rus + kir traineddata
└── ui/overlay.css         corner panel styling
```

### Components & responsibilities

- **`manifest.json`** — declares MV3, the two `commands` (hotkeys), `permissions`
  (`activeTab`, `scripting`), `host_permissions` (`<all_urls>` for capture), the content
  script registration, and `web_accessible_resources` for the Tesseract assets and data.
- **`background.js` (service worker)** — single job: on message `CAPTURE_TAB`, call
  `chrome.tabs.captureVisibleTab(null, {format: "png"})` and return the data URL. (The
  content script cannot call this API directly.)
- **`content.js`** — the orchestrator on the page:
  - Listens for the two hotkey commands (relayed from the service worker via
    `chrome.commands` → message, since `chrome.commands.onCommand` lives in the worker).
  - **Selected-text path:** read `window.getSelection().toString()` → `matcher` → overlay.
  - **OCR path:** show a full-viewport crosshair layer → user drags a rectangle →
    request `CAPTURE_TAB` → crop the returned PNG to the rectangle on a `<canvas>`
    (multiplying by `window.devicePixelRatio`) → `ocr` → `matcher` → overlay.
  - Hosts the overlay inside a **Shadow DOM** so host-page CSS can't interfere.
- **`matcher.js`** — pure functions, no DOM:
  - `normalize(text)`: lowercase, trim, collapse whitespace, strip punctuation, normalize
    common Cyrillic/Latin look-alike confusions and OCR artifacts.
  - `score(a, b)`: combined similarity = weighted blend of character **trigram** overlap
    (Dice coefficient) and **token** overlap (Jaccard). Robust to a few wrong characters.
  - `findBest(query, bank)`: returns the top matches sorted by score, each with the
    question, correct option, confidence (0–1), and subject.
- **`ocr.js`** — wraps Tesseract.js: lazily create a worker with languages `rus+kir`,
  expose `recognize(canvas) -> text`. Worker is created on first use and reused.
- **`ui/overlay.css` + overlay render code** — the corner panel (see below).

### Data flow

**Selected-text mode**
```
hotkey → content.js reads selection → matcher.findBest → overlay.render
```

**OCR mode**
```
hotkey → content.js crosshair → user drags box
       → message CAPTURE_TAB → background.captureVisibleTab → PNG dataURL
       → content.js crops to box on canvas (× devicePixelRatio)
       → ocr.recognize(canvas) → text
       → matcher.findBest(text) → overlay.render
```

## Matching strategy

- Fixed bank of 228 questions; the queried text is (a possibly noisy copy of) one of them.
- Normalize both query and every candidate's `question` field, then score with the blended
  trigram + token similarity. Pick the highest.
- **Confidence threshold** (default ~0.55, tunable during testing):
  - Above threshold → show the single best answer.
  - Below threshold → show a **no-confident-match** state listing the **top 2 guesses**
    with their scores, so the user decides rather than trusting a wrong single answer.
- The correct option is `options[answerIndex]`, **unless** a `verification.status ===
  "discrepancy"` exists, in which case the overlay shows `options[actualAnswerIndex]` as
  the corrected answer and surfaces the `note`.

## Corner overlay (UI)

- Fixed position, **bottom-right** by default, draggable, with a close (×) button.
- Rendered in a **Shadow DOM** attached to a top-level element so host CSS can't affect it.
- High z-index; non-intrusive; does not steal focus from the page.
- Contents:
  - **Matched question** (truncated, full on hover) — lets the user confirm the right match.
  - **Correct answer**, visually highlighted.
  - **Confidence %** and **subject** label (География / История / Кыргызский).
  - **Verification banner** when the matched question has a discrepancy correction.
  - **Low-confidence state**: "No confident match — did you mean…" + top 2 guesses.
  - **OCR error / empty-selection state**: a short, clear message.

## Hotkeys (defaults, remappable in `chrome://extensions/shortcuts`)

- `Alt+Shift+Q` — **Check selected text**.
- `Alt+Shift+S` — **Scan region (OCR)**.

## Error handling

- **No text selected** when using selection mode → overlay shows a hint to select first.
- **captureVisibleTab fails** (e.g., restricted page like `chrome://`) → overlay shows a
  clear "can't capture this page" message.
- **OCR returns empty / garbage** → treated as a no-match; overlay shows the low-confidence
  state and invites re-scanning a tighter box.
- **Region too small / zero-area drag** → ignored, crosshair dismissed.
- **Tesseract worker fails to load** → overlay shows an error; selection mode still works.

## Testing strategy

- **`matcher.js` unit tests** (the core logic, pure functions): for a sample of real
  questions, confirm exact text matches; confirm matching survives injected noise
  (dropped/substituted characters simulating OCR errors); confirm below-threshold queries
  produce the no-match state; confirm `verification` discrepancies return the corrected
  option. Run with Node (no browser needed).
- **Manual end-to-end checks** (documented steps): load unpacked in Chrome; on a test page
  containing known questions, verify selected-text mode and OCR region mode both surface
  the correct answer in the corner; verify a non-question selection yields the no-match
  state; verify behavior on a copy-paste-disabled page (OCR path).

## Open defaults (chosen, not blocking)

- Confidence threshold starts at 0.55, adjusted during manual testing.
- Overlay corner fixed to bottom-right (draggable); not exposing a settings page yet.
- OCR languages fixed to `rus+kir`.
