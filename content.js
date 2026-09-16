'use strict';

const THRESHOLD = window.ExamMatcher.CONFIDENCE_THRESHOLD;
let activeBank = [];

function refreshActiveBank(data) {
  const custom = data && data.customQuestionBank;
  if (Array.isArray(custom) && custom.length > 0) {
    activeBank = custom;
  } else {
    activeBank = [];
  }
}

// Initial bank load from local storage
if (chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['customQuestionBank'], refreshActiveBank);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ('customQuestionBank' in changes)) {
      chrome.storage.local.get(['customQuestionBank'], refreshActiveBank);
    }
  });
}

function checkText(text) {
  if (!text || !text.trim()) {
    window.ExamOverlay.showMessage('Select the question text first, then press Alt+Shift+Q.');
    return;
  }
  if (!activeBank || activeBank.length === 0) {
    window.ExamOverlay.showMessage('No questions loaded. Open the extension popup to upload questions.', true, 3000);
    return;
  }
  const result = window.ExamMatcher.findBest(text, activeBank);
  window.ExamOverlay.showResult(result, THRESHOLD);
}

function checkSelection() {
  const sel = String(window.getSelection ? window.getSelection() : '').trim();
  checkText(sel);
}

async function runOcr(rect, dpr) {
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
