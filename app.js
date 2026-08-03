const lookupForm = document.getElementById('tracker-form');
const importForm = document.getElementById('import-form');
const runInput = document.getElementById('run-no');
const statusEl = document.getElementById('status');
const clearBtn = document.getElementById('clear-btn');
const viewRun = document.getElementById('view-run');
const viewBus = document.getElementById('view-bus');
const sheetUrlInput = document.getElementById('sheet-url');
const displayBox = document.querySelector('.display-box');

function updateStatus(message) {
  const normalizedMessage = String(message ?? '').trim();

  if (normalizedMessage === 'Please contact OCC') {
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

async function loadRecord() {
  try {
    const response = await fetch('/api/record');
    const data = await response.json();

    if (data.count) {
      updateStatus(`Loaded ${data.count} run/bus entries from spreadsheet data.`);
    } else {
      updateStatus('No spreadsheet data has been imported yet.');
    }
  } catch (error) {
    updateStatus('Unable to load record summary.');
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
    updateStatus('Please provide a spreadsheet link.');
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
      throw new Error(data.error || 'Failed to import data');
    }

    updateStatus('');
  } catch (error) {
    updateStatus('');
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

async function lookupRun(event) {
  event.preventDefault();

  const runNo = runInput.value.trim();
  if (!runNo) {
    updateStatus('Please enter a run number.');
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
      viewBus.textContent = 'Not found';
      setResultState(false);
      updateStatus('Please contact OCC');
    }
  } catch (error) {
    updateStatus(error.message || 'Unable to look up bus number.');
    console.error(error);
  }
}

lookupForm.addEventListener('submit', lookupRun);
importForm.addEventListener('submit', importSheetData);
clearBtn.addEventListener('click', () => {
  clearValues();
  setResultState(false);
});

window.addEventListener('DOMContentLoaded', () => {
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
