# Exam Prep Answer Checker

An **offline** Chrome extension that helps you self-check practice questions. Select a
question's text (or screenshot it when copy-paste is disabled), and the correct answer
appears in a small, translucent overlay in the corner of the page — matched against your
uploaded question bank.

Everything runs locally in your browser: questions are stored locally in Chrome storage, and OCR uses a bundled copy of
Tesseract.js. No internet connection, account, or API key is required.

---

## How to use it

| Shortcut (Windows) | Shortcut (macOS) | What it does |
|---|---|---|
| **Alt + Shift + Q** | **⌥ Option + Shift + Q** | Check the **currently selected text** |
| **Alt + Shift + S** | **⌥ Option + Shift + S** | **Scan a region**: drag a box around the question (OCR) |

1. **Upload your questions first**: Click the extension icon in Chrome toolbar and upload your questions (JSON, CSV, TSV).
2. **Selected text** is the most accurate. Highlight the question, press the shortcut.
3. **Scan a region** is for sites that block copy-paste. Press the shortcut, then drag
   from one corner of the question to the opposite corner.
4. The overlay shows just the answer, then auto-closes after a moment. Click the **×** to
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
2. Open Chrome and go to `chrome://extensions` (type it in the address bar).
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the extension folder (the one that directly contains `manifest.json`) and click
   **Select Folder**.
6. The card **Exam Prep Answer Checker** appears. You're done.

### macOS

1. Put the extension folder somewhere permanent, e.g. `/Users/<you>/exam`.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. In the file dialog, select the extension folder (the one that directly contains
   `manifest.json`) and click **Select**.
6. The card **Exam Prep Answer Checker** appears. Use **⌥ Option + Shift + Q / S**.

---

## Uploading your questions

You can upload questions directly from the extension popup:

1. Click the **Exam Prep Answer Checker** extension icon in your Chrome toolbar.
2. In the **Questions** tab, click the upload box (or drag and drop your file).
3. The extension immediately parses and activates your questions across all open tabs!

### Supported formats:

- **Simple Q&A JSON** (flashcards / quiz lists):
  ```json
  [
    { "question": "What is the capital of Iceland?", "answer": "Reykjavik" },
    { "question": "What is the largest organ in the human body?", "answer": "Skin" }
  ]
  ```
- **Multiple-Choice JSON**:
  ```json
  [
    {
      "question": "What is the capital of France?",
      "options": ["London", "Berlin", "Paris", "Madrid"],
      "answerIndex": 2
    }
  ]
  ```
- **CSV / TSV / Semicolon-delimited files**:
  ```csv
  Question,Answer,Option1,Option2,Option3,Option4
  "What is the capital of France?","Paris","London","Berlin","Paris","Madrid"
  "Which planet is known as the Red Planet?","Mars","","","",""
  ```
- **Nested format**:
  ```json
  {
    "subjects": {
      "title": "Subject Name",
      "tests": [
        {
          "title": "Test 1",
          "questions": [
            { "question": "...", "options": ["..."], "answerIndex": 0 }
          ]
        }
      ]
    }
  }
  ```

### Features:
- **Export active bank**: Download the currently loaded bank as a JSON file.
- **Sample Templates**: Click **Sample JSON** or **Sample CSV** at the bottom of the popup to get working example files.
- **Clear question bank**: Clear all loaded questions anytime.

---

## Customizing the shortcuts

If the default shortcuts conflict with something else, change them:

1. Go to `chrome://extensions/shortcuts`.
2. Find **Exam Prep Answer Checker** and click the pencil/box next to each command.
3. Press your preferred key combination.

---

## Troubleshooting

- **"No questions loaded."** Open the extension popup from your toolbar and upload your questions file.
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
- `bank.js` — question bank parser, template generator, and normalization logic.
- `matcher.js` — fuzzy matching of your text against the bank (with unit tests in
  `matcher.test.js`; run `node --test`).
- `content.js`, `region.js`, `overlay.js`, `ui/overlay.css` — on-page logic and the overlay.
- `background.js`, `offscreen.html`, `offscreen.js` — screenshot capture + Tesseract OCR.
- `vendor/tesseract/` — the bundled offline OCR engine and Russian/Kyrgyz language data.
