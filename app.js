const lookupForm = document.getElementById('tracker-form');
const importForm = document.getElementById('import-form');
const runInput = document.getElementById('run-no');
const statusEl = document.getElementById('status');
const clearBtn = document.getElementById('clear-btn');
const viewRun = document.getElementById('view-run');
const viewBus = document.getElementById('view-bus');
const sheetUrlInput = document.getElementById('sheet-url');
const displayBox = document.querySelector('.display-box');
const languageSelect = document.getElementById('language-select');

const translations = {
  en: {
    title: 'Run & Bus Tracker',
    subtitle: 'Enter a run number to check the current bus number.',
    runNoLabel: 'Run No.',
    runNoLabelInline: 'Run No.:',
    vehicleNoLabelInline: 'Vehicle No.:',
    checkButton: 'Check',
    clearButton: 'Clear',
    sheetUrlLabel: 'Spreadsheet link',
    sheetHint: 'The app reads Column G as Run No. and Column I as Vehicle No. from the live Google Sheets source.',
    importButton: 'Import data',
    vehicleNumberTitle: 'Vehicle Number',
    statusPleaseContactOCC: 'Please contact OCC',
    statusInvalidRun: 'Please enter a 4-digit run number between 0000 and 9999.',
    statusNotFound: 'Not found',
    statusLoadSuccess: 'Loaded {count} run/bus entries from spreadsheet data.',
    statusEmpty: 'No spreadsheet data has been imported yet.',
    statusLoadError: 'Unable to load record summary.',
    statusProvideSheet: 'Please provide a spreadsheet link.',
    statusImportFailed: 'Unable to import spreadsheet data.',
    statusLookupError: 'Unable to look up bus number.'
  },
  zh: {
    title: '运行与车牌查询',
    subtitle: '输入段号以查询当前车牌。',
    runNoLabel: '段号',
    runNoLabelInline: '段号：',
    vehicleNoLabelInline: '车牌：',
    checkButton: '查询',
    clearButton: '清除',
    sheetUrlLabel: '表格链接',
    sheetHint: '应用会从实时 Google 表中读取 G 列作为段号，I 列作为车牌。',
    importButton: '导入数据',
    vehicleNumberTitle: '车牌',
    statusPleaseContactOCC: '请联系 OCC',
    statusInvalidRun: '请输入 0000 到 9999 之间的 4 位数字段号。',
    statusNotFound: '未找到',
    statusLoadSuccess: '已从表格数据加载 {count} 条段号/车牌记录。',
    statusEmpty: '尚未导入表格数据。',
    statusLoadError: '无法加载记录摘要。',
    statusProvideSheet: '请输入表格链接。',
    statusImportFailed: '无法导入表格数据。',
    statusLookupError: '无法查询车牌。'
  }
};

let currentLanguage = 'en';

function t(key, replacements = {}) {
  const dictionary = translations[currentLanguage] || translations.en;
  let text = dictionary[key] || translations.en[key] || key;

  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(`{${placeholder}}`, String(value));
  });

  return text;
}

function applyLanguage() {
  const nodes = document.querySelectorAll('[data-i18n]');
  nodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key) {
      node.textContent = t(key);
    }
  });

  runInput.placeholder = '0000';
  runInput.title = t('statusInvalidRun');
  sheetUrlInput.placeholder = currentLanguage === 'zh' ? '粘贴表格链接' : 'Paste spreadsheet link';

  if (viewRun.textContent === 'Not found' || viewRun.textContent === '未找到' || viewRun.textContent === '—') {
    viewRun.textContent = viewRun.dataset.lastValue || '—';
  }

  if (viewBus.textContent === 'Not found' || viewBus.textContent === '未找到' || viewBus.textContent === '—') {
    viewBus.textContent = viewBus.dataset.lastValue || '—';
  }

  if (statusEl.textContent === 'Please contact OCC' || statusEl.textContent === '请联系 OCC') {
    updateStatus(t('statusPleaseContactOCC'));
  }
}

function updateStatus(message) {
  const normalizedMessage = String(message ?? '').trim();

  if (normalizedMessage === t('statusPleaseContactOCC')) {
    statusEl.textContent = normalizedMessage;
    statusEl.classList.remove('hidden');
  } else if (normalizedMessage === 'Please contact OCC' || normalizedMessage === '请联系 OCC') {
    statusEl.textContent = normalizedMessage;
    statusEl.classList.remove('hidden');
  } else {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }
}

function showAdminView() {
  importForm.classList.remove('hidden');
}

function showUserView() {
  importForm.classList.add('hidden');
}

function setResultState(found) {
  displayBox.classList.remove('result-found', 'result-missing');
  const runValue = document.getElementById('view-run');
  const busValue = document.getElementById('view-bus');

  runValue.classList.remove('result-found', 'result-missing');
  busValue.classList.remove('result-found', 'result-missing');

  if (found === true) {
    displayBox.classList.add('result-found');
    runValue.classList.add('result-found');
    busValue.classList.add('result-found');
  } else if (found === false) {
    displayBox.classList.add('result-missing');
    runValue.classList.add('result-missing');
    busValue.classList.add('result-missing');
  }
}

function sanitizeRunInput(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 4);
}

function validateRunNo(runNo) {
  if (!/^\d{4}$/.test(runNo)) {
    return false;
  }

  const numericValue = Number(runNo);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 9999;
}

async function loadRecord() {
  try {
    const response = await fetch('/api/record');
    const data = await response.json();

    if (data.count) {
      updateStatus(t('statusLoadSuccess', { count: data.count }));
    } else {
      updateStatus(t('statusEmpty'));
    }
  } catch (error) {
    updateStatus(t('statusLoadError'));
    console.error(error);
  }
}

async function autoImportSheetData() {
  const sourceUrl = sheetUrlInput.value.trim();
  if (!sourceUrl) {
    return;
  }

  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      updateStatus('');
    } else {
      updateStatus('');
    }
  } catch (error) {
    console.error('Automatic import failed', error);
  }
}

async function importSheetData(event) {
  event.preventDefault();

  const sourceUrl = sheetUrlInput.value.trim();
  if (!sourceUrl) {
    updateStatus(t('statusProvideSheet'));
    return;
  }

  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || t('statusImportFailed'));
    }

    updateStatus('');
  } catch (error) {
    updateStatus(t('statusImportFailed'));
    console.error(error);
  }
}

function clearValues() {
  runInput.value = '';
  viewRun.textContent = '—';
  viewBus.textContent = '—';
  setResultState(null);
  updateStatus('');
}

runInput.addEventListener('input', () => {
  runInput.value = sanitizeRunInput(runInput.value);
});

async function lookupRun(event) {
  event.preventDefault();

  const runNo = runInput.value.trim();
  if (!validateRunNo(runNo)) {
    updateStatus(t('statusInvalidRun'));
    return;
  }

  try {
    const response = await fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runNo })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(text || 'Invalid server response');
    }

    if (data.found) {
      viewRun.textContent = data.runNo || '—';
      viewBus.textContent = data.busNo || '—';
      setResultState(true);
      updateStatus('');
    } else {
      viewRun.textContent = runNo;
      viewBus.textContent = t('statusNotFound');
      setResultState(false);
      updateStatus(t('statusPleaseContactOCC'));
    }
  } catch (error) {
    updateStatus(t('statusLookupError'));
    console.error(error);
  }
}

languageSelect.addEventListener('change', (event) => {
  currentLanguage = event.target.value;
  applyLanguage();
});

lookupForm.addEventListener('submit', lookupRun);
importForm.addEventListener('submit', importSheetData);
clearBtn.addEventListener('click', () => {
  clearValues();
  setResultState(false);
});

window.addEventListener('DOMContentLoaded', () => {
  languageSelect.value = currentLanguage;
  applyLanguage();
  showUserView();
  setResultState(null);
  statusEl.textContent = '';
  statusEl.classList.add('hidden');
  loadRecord();
  autoImportSheetData();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('Service worker registration failed');
    });
  });
}

const appVersion = `${Date.now()}`;
const cacheBuster = new URLSearchParams(window.location.search);
if (!cacheBuster.has('v')) {
  window.history.replaceState({}, '', `${window.location.pathname}?v=${appVersion}${window.location.hash || ''}`);
}

window.addEventListener('focus', () => {
  const currentVersion = new URLSearchParams(window.location.search).get('v');
  if (!currentVersion || currentVersion !== appVersion) {
    window.location.reload();
  }
});
