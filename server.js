const express = require('express');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.xlsx');

// Servér alle filer i mappen (index.html, avatars.js osv.)
app.use(express.static(__dirname));

function readKPIs() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`data.xlsx ikke fundet i: ${DATA_FILE}`);
  }
  const workbook = xlsx.readFile(DATA_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  return rows.map(row => ({
    label:       String(row.label       ?? ''),
    value:       row.value              ?? 0,
    unit:        String(row.unit        ?? ''),
    trend:       String(row.trend       ?? ''),
    description: String(row.description ?? ''),
  }));
}

app.get('/api/kpi', (req, res) => {
  try {
    const kpis = readKPIs();
    res.json({ kpis, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Infoskærm kører på http://localhost:${PORT}`);
  console.log(`📊 Læser KPI-data fra: ${DATA_FILE}`);
});
