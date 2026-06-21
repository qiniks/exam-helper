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

async function runOcr(rect, dpr) {
  window.ExamOverlay.showMessage('…', false, 0);
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
