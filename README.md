# Exam Prep Answer Checker

An **offline** Chrome extension that helps you self-check practice questions. Select a
question's text (or screenshot it when copy-paste is disabled), and the correct answer
appears in a small, translucent overlay in the corner of the page — matched against a
bundled bank of 228 questions (География / История / Кыргызский язык, in Cyrillic).

Everything runs locally: the question bank is built in, and OCR uses a bundled copy of
Tesseract.js. No internet connection, account, or API key is required.

---

## How to use it

| Shortcut (Windows) | Shortcut (macOS) | What it does |
|---|---|---|
| **Alt + Shift + Q** | **⌥ Option + Shift + Q** | Check the **currently selected text** |
| **Alt + Shift + S** | **⌥ Option + Shift + S** | **Scan a region**: drag a box around the question (OCR) |

- **Selected text** is the most accurate. Highlight the question, press the shortcut.
- **Scan a region** is for sites that block copy-paste. Press the shortcut, then drag
  from one corner of the question to the opposite corner. The selection is invisible and
  the cursor stays normal, so you drag "blind." The first scan after loading takes a few
  seconds while the OCR language data loads once; later scans are fast.
- The overlay shows just the answer, then auto-closes after a moment. Click the **×** to
  dismiss it sooner.

> The overlay only **shows** the answer — it never clicks or changes anything on the page.

---

## Installation

The extension is loaded "unpacked" (developer mode). This is the normal way to run a
local, unpublished extension and works identically in Chrome, Edge, Brave, and other
Chromium browsers.

### Requirements
- Google Chrome (or any Chromium browser: Microsoft Edge, Brave, etc.).
- The extension folder on your computer (the folder containing `manifest.json`).

### Windows

1. Put the extension folder somewhere permanent, e.g. `C:\Users\<you>\Desktop\exam`.
   (If you keep it in OneDrive, that's fine — just don't move it after loading, or
   Chrome will lose track of it.)
2. Open Chrome and go to `chrome://extensions` (type it in the address bar).
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the extension folder (the one that directly contains `manifest.json`) and click
   **Select Folder**.
6. The card **Exam Prep Answer Checker** appears. You're done — open any page and use the
   shortcuts above.

### macOS

1. Put the extension folder somewhere permanent, e.g. `/Users/<you>/exam`.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. In the file dialog, select the extension folder (the one that directly contains
   `manifest.json`) and click **Select**.
6. The card **Exam Prep Answer Checker** appears. Use **⌥ Option + Shift + Q / S**.

> On macOS, Chrome maps the extension's `Alt` shortcut to the **Option (⌥)** key.

### Verify it works
1. Open `test/sample.html` from this folder in a Chrome tab (drag the file into Chrome).
2. Highlight the first question's text and press the check-selection shortcut → you should
   see **Сарыжазский** appear in the corner.
3. Press the scan-region shortcut and drag a box around the second question → after a short
   pause you should see **Бишкек**.

---

## Customizing the shortcuts

If the default shortcuts conflict with something else, change them:

1. Go to `chrome://extensions/shortcuts`.
2. Find **Exam Prep Answer Checker** and click the pencil/box next to each command.
3. Press your preferred key combination.

---

## Updating the question bank

The questions live in `data/tests_data.js`. To refresh them from the prep site:

1. Copy the site's `tests_data.js` over `data/tests_data.js`.
2. Make sure the last two lines (the export shim) are still present:
   ```js
   if (typeof module !== 'undefined' && module.exports) { module.exports = TESTS_DATA; }
   else if (typeof globalThis !== 'undefined') { globalThis.TESTS_DATA = TESTS_DATA; }
   ```
3. Go to `chrome://extensions` and click the **reload** (↻) icon on the extension card.

---

## Troubleshooting

- **Changes don't show up.** After editing any extension file, click the **reload (↻)**
  icon on the extension's card at `chrome://extensions`.
- **Nothing happens on a shortcut.** Some pages (the `chrome://` pages, the Chrome Web
  Store, and brand-new tabs) don't allow extensions to run. Try a normal web page. Also
  confirm the shortcut isn't taken by another app at `chrome://extensions/shortcuts`.
- **OCR shows an error.** Reload the extension and try again. Make sure you're on a normal
  web page (restricted pages can't be screenshotted).
- **"No confident match."** The scanned/selected text didn't closely match any question in
  the bank. Select a tighter box around just the question, or use selected-text mode.

---

## What's inside (for the curious)

- `manifest.json` — extension configuration (Manifest V3).
- `data/tests_data.js` — the bundled 228-question bank.
- `matcher.js` — fuzzy matching of your text against the bank (with unit tests in
  `matcher.test.js`; run `node --test`).
- `content.js`, `region.js`, `overlay.js`, `ui/overlay.css` — on-page logic and the overlay.
- `background.js`, `offscreen.html`, `offscreen.js` — screenshot capture + Tesseract OCR.
- `vendor/tesseract/` — the bundled offline OCR engine and Russian/Kyrgyz language data.
