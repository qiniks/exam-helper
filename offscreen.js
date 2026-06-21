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
