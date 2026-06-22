'use strict';

const DEFAULT_SETTINGS = { answerFontSize: 11, baseFontSize: 14, fontFamily: 'system' };

const FONT_FAMILIES = {
  system: '-apple-system, Segoe UI, Roboto, Arial, sans-serif',
  mono: "'Courier New', Courier, monospace",
  serif: "Georgia, 'Times New Roman', serif"
};

const answerSlider = document.getElementById('answerFontSize');
const answerVal    = document.getElementById('answerFontSizeVal');
const baseSlider   = document.getElementById('baseFontSize');
const baseVal      = document.getElementById('baseFontSizeVal');
const fontSel      = document.getElementById('fontFamily');
const resetBtn     = document.getElementById('reset');
const preview      = document.getElementById('preview');
const previewAnswer = document.getElementById('previewAnswer');

function updatePreview(s) {
  const ff = FONT_FAMILIES[s.fontFamily] || FONT_FAMILIES.system;
  preview.style.fontFamily = ff;
  preview.style.fontSize   = s.baseFontSize + 'px';
  previewAnswer.style.fontSize = s.answerFontSize + 'px';
}

function readForm() {
  return {
    answerFontSize: parseInt(answerSlider.value, 10),
    baseFontSize:   parseInt(baseSlider.value, 10),
    fontFamily:     fontSel.value
  };
}

function applyToForm(s) {
  answerSlider.value      = s.answerFontSize;
  answerVal.textContent   = s.answerFontSize + 'px';
  baseSlider.value        = s.baseFontSize;
  baseVal.textContent     = s.baseFontSize + 'px';
  fontSel.value           = s.fontFamily;
  updatePreview(s);
}

function save(s) {
  chrome.storage.sync.set(s);
  updatePreview(s);
}

answerSlider.addEventListener('input', () => {
  answerVal.textContent = answerSlider.value + 'px';
  save(readForm());
});

baseSlider.addEventListener('input', () => {
  baseVal.textContent = baseSlider.value + 'px';
  save(readForm());
});

fontSel.addEventListener('change', () => save(readForm()));

resetBtn.addEventListener('click', () => {
  applyToForm(DEFAULT_SETTINGS);
  save(DEFAULT_SETTINGS);
});

chrome.storage.sync.get(DEFAULT_SETTINGS, applyToForm);
