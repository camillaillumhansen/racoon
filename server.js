const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Google Sheets ID
const SHEET_ID = '1KFQDifeF2p6zLVnhsUIaSpCD9SgZKD8dDpY-lidGO04';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;

async function readKPIs() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error('Kunne ikke hente Google Sheets data');
  const text = await response.text();
  
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || '').replace(/"/g, '').trim();
    });
    return {
      label:       row.label       || '',
      value:       parseFloat(row.value) || 0,
      unit:        row.unit        || '',
      trend:       row.trend       || '',
      description: row.description || '',
    };
  }).filter(r => r.label);
}

app.use(express.static(__dirname));

app.get('/api/kpi', async (req, res) => {
  try {
    const kpis = await readKPIs();
    res.json({ kpis, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Infoskærm kører på http://localhost:${PORT}`);
  console.log(`📊 Henter KPI-data fra Google Sheets`);
});
