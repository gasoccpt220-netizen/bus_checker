const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

let records = [];

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function normalizeRunNo(value) {
  return normalizeValue(value).replace(/^0+/, '');
}

function findRecord(runNo) {
  const normalizedRunNo = normalizeRunNo(runNo);
  return records.find((entry) => normalizeRunNo(entry.runNo) === normalizedRunNo) || null;
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function getGoogleSheetsCsvUrl(sourceUrl) {
  const match = sourceUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return null;
  }

  const spreadsheetId = match[1];
  const params = new URL(sourceUrl).searchParams;
  const gid = params.get('gid') || '';
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

async function fetchGoogleSheetsCsv(sourceUrl) {
  const googleCsvUrl = getGoogleSheetsCsvUrl(sourceUrl);
  if (!googleCsvUrl) {
    throw new Error('Not a Google Sheets URL');
  }

  const response = await fetch(googleCsvUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Unable to download spreadsheet (${response.status}).`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return { text: await response.text(), contentType };
  }

  const html = await response.text();
  const exportMatch = html.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^"']+\/export\?format=csv[^"']*/);
  if (exportMatch) {
    const exportResponse = await fetch(exportMatch[0], { redirect: 'follow' });
    if (!exportResponse.ok) {
      throw new Error(`Unable to download spreadsheet (${exportResponse.status}).`);
    }
    return { text: await exportResponse.text(), contentType: exportResponse.headers.get('content-type') || 'text/csv' };
  }

  return { text: html, contentType };
}

async function importFromUrl(sourceUrl) {
  if (!sourceUrl) {
    throw new Error('No spreadsheet URL provided');
  }

  let text = '';
  let contentType = '';

  if (sourceUrl.includes('docs.google.com/spreadsheets')) {
    const googleSheetData = await fetchGoogleSheetsCsv(sourceUrl);
    text = googleSheetData.text;
    contentType = googleSheetData.contentType;
  } else {
    const response = await fetch(sourceUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Unable to download spreadsheet (${response.status}).`);
    }

    contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    text = buffer.toString('utf8');
  }

  let rows = [];

  if (contentType.includes('application/json')) {
    const data = JSON.parse(text);
    rows = Array.isArray(data) ? data : data.rows || [];
  } else if (contentType.includes('text/csv') || sourceUrl.toLowerCase().endsWith('.csv') || sourceUrl.includes('export?format=csv') || text.includes('No,Svc,Type')) {
    rows = parseCsvText(text);
  } else if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || contentType.includes('application/octet-stream') || sourceUrl.toLowerCase().includes('sharepoint') || sourceUrl.toLowerCase().includes('xlsx')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  } else {
    rows = parseCsvText(text);
  }

  const parsedRows = rows.filter((row) => Array.isArray(row) && row.some((value) => normalizeValue(value) !== ''));
  const dataRows = parsedRows.filter((row) => {
    const firstCell = normalizeValue(row[0]);
    return firstCell !== 'No' && firstCell !== 'Run' && firstCell !== 'No.' && firstCell !== 'Vehicle No.';
  });

  const parsedRecords = dataRows
    .map((row) => {
      const runNo = normalizeValue(row[6] ?? row[5] ?? row[7]);
      const busNo = normalizeValue(row[8] ?? row[9] ?? row[7]);
      return {
        runNo,
        busNo: busNo.replace(/\s+/g, '').toUpperCase()
      };
    })
    .filter((entry) => entry.runNo && entry.busNo);

  records = parsedRecords;
  return parsedRecords;
}

app.get('/api/record', (req, res) => {
  res.json({ count: records.length, sample: records[0] || null });
});

app.post('/api/import', async (req, res) => {
  try {
    const { sourceUrl } = req.body || {};
    const imported = await importFromUrl(sourceUrl);
    res.json({ success: true, count: imported.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/lookup', (req, res) => {
  const { runNo } = req.body || {};
  const normalizedRunNo = normalizeValue(runNo);

  if (!normalizedRunNo) {
    return res.status(400).json({ success: false, error: 'Run number is required' });
  }

  const match = findRecord(normalizedRunNo);
  if (!match) {
    return res.json({ success: false, found: false, runNo: normalizedRunNo });
  }

  return res.json({ success: true, found: true, runNo: match.runNo, busNo: match.busNo });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
