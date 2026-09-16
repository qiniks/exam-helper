'use strict';

// --- Appearance Settings ---
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

function saveAppearance(s) {
  chrome.storage.sync.set(s);
  updatePreview(s);
}

answerSlider.addEventListener('input', () => {
  answerVal.textContent = answerSlider.value + 'px';
  saveAppearance(readForm());
});

baseSlider.addEventListener('input', () => {
  baseVal.textContent = baseSlider.value + 'px';
  saveAppearance(readForm());
});

fontSel.addEventListener('change', () => saveAppearance(readForm()));

resetBtn.addEventListener('click', () => {
  applyToForm(DEFAULT_SETTINGS);
  saveAppearance(DEFAULT_SETTINGS);
});

chrome.storage.sync.get(DEFAULT_SETTINGS, applyToForm);

// --- Tab Navigation ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.getAttribute('data-tab');
    const content = document.getElementById(target);
    if (content) content.classList.add('active');
  });
});

// --- Question Bank Management ---
const bankBadge = document.getElementById('bankBadge');
const bankCount = document.getElementById('bankCount');
const bankDetails = document.getElementById('bankDetails');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusMsg = document.getElementById('statusMsg');
const clearBankBtn = document.getElementById('clearBankBtn');
const exportBankBtn = document.getElementById('exportBankBtn');
const templateJsonBtn = document.getElementById('templateJsonBtn');
const templateCsvBtn = document.getElementById('templateCsvBtn');

let currentCustomBank = null;
let currentCustomMeta = null;

function showStatus(text, isError) {
  statusMsg.textContent = text;
  statusMsg.className = 'status-msg ' + (isError ? 'error' : 'success');
  statusMsg.style.display = 'block';
  clearTimeout(statusMsg._timer);
  statusMsg._timer = setTimeout(() => {
    statusMsg.style.display = 'none';
  }, 5000);
}

function updateBankUI() {
  const hasCustom = Array.isArray(currentCustomBank) && currentCustomBank.length > 0;

  if (hasCustom) {
    clearBankBtn.style.display = 'block';
    exportBankBtn.style.display = 'block';
    bankBadge.className = 'badge badge-custom';
    bankBadge.textContent = 'Active';
    bankCount.textContent = `${currentCustomBank.length} questions`;
    bankDetails.textContent = currentCustomMeta?.fileName || 'User custom bank';
  } else {
    clearBankBtn.style.display = 'none';
    exportBankBtn.style.display = 'none';
    bankBadge.className = 'badge badge-empty';
    bankBadge.textContent = 'Empty';
    bankCount.textContent = '0 questions';
    bankDetails.textContent = 'No questions loaded. Upload a file below.';
  }
}

function loadBankStorage() {
  chrome.storage.local.get(['customQuestionBank', 'customBankMeta'], (res) => {
    currentCustomBank = res.customQuestionBank || null;
    currentCustomMeta = res.customBankMeta || null;
    updateBankUI();
  });
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const candidates = window.ExamBank.parseQuestionData(text, file.name);

      if (!candidates || candidates.length === 0) {
        showStatus('No questions found in this file.', true);
        return;
      }

      currentCustomBank = candidates;
      currentCustomMeta = {
        fileName: file.name,
        count: candidates.length,
        uploadedAt: Date.now()
      };

      chrome.storage.local.set({
        customQuestionBank: currentCustomBank,
        customBankMeta: currentCustomMeta
      }, () => {
        updateBankUI();
        showStatus(`✓ Successfully loaded ${candidates.length} questions from "${file.name}"!`);
      });
    } catch (err) {
      showStatus('Error parsing file: ' + (err.message || err), true);
    }
  };

  reader.onerror = () => {
    showStatus('Failed to read file.', true);
  };

  reader.readAsText(file, 'utf-8');
}

// File drop & select interactions
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
    fileInput.value = '';
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
});

// Clear Bank
clearBankBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['customQuestionBank', 'customBankMeta'], () => {
    currentCustomBank = null;
    currentCustomMeta = null;
    updateBankUI();
    showStatus('Question bank cleared.');
  });
});

// Helper to trigger browser file download
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 100);
}

// Export Active Bank
exportBankBtn.addEventListener('click', () => {
  if (!currentCustomBank || currentCustomBank.length === 0) return;
  const jsonStr = JSON.stringify(currentCustomBank, null, 2);
  downloadBlob(jsonStr, 'exam_questions_bank.json', 'application/json');
});

// Sample Templates
templateJsonBtn.addEventListener('click', () => {
  const sample = window.ExamBank.getSampleJson();
  downloadBlob(sample, 'sample_questions.json', 'application/json');
});

templateCsvBtn.addEventListener('click', () => {
  const sample = window.ExamBank.getSampleCsv();
  downloadBlob(sample, 'sample_questions.csv', 'text/csv;charset=utf-8');
});

// Initial load
loadBankStorage();
