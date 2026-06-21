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
