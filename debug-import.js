function normalizeValue(value) {
  return String(value ?? '').trim();
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

async function main() {
  const sourceUrl = 'https://docs.google.com/spreadsheets/d/1EqJpXjbig5F0USxJOgpWVfAF8s2UEQhW/edit?usp=sharing';
  const spreadsheetId = sourceUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  console.log('export url', exportUrl);
  const response = await fetch(exportUrl, { redirect: 'follow' });
  console.log('status', response.status, response.headers.get('content-type'));
  const text = await response.text();
  console.log(text.slice(0, 1000));
  const rows = parseCsvText(text);
  console.log('rows', rows.length);
  rows.slice(0, 12).forEach((row, index) => {
    console.log(index, JSON.stringify(row));
  });
  const parsedRows = rows.slice(1).filter((row) => Array.isArray(row) && row.some((value) => normalizeValue(value) !== ''));
  const parsedRecords = parsedRows
    .map((row) => ({
      runNo: normalizeValue(row[6]),
      busNo: normalizeValue(row[8])
    }))
    .filter((entry) => entry.runNo && entry.busNo);
  console.log('parsed count', parsedRecords.length);
  console.log(parsedRecords.slice(0, 10));
  console.log('target', parsedRecords.find((entry) => entry.runNo === '1503'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
