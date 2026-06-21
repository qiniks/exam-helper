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
