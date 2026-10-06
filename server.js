const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID = '1KFQDifeF2p6zLVnhsUIaSpCD9SgZKD8dDpY-lidGO04';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

async function readKPIs() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error('Kunne ikke hente Google Sheets data');
  const text = await response.text();

  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { values.push(current); current = ''; }
      else { current += char; }
    }
    values.push(current);

    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });

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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// VELKOMST-SKÆRM (helt adskilt fra dashboardet)
// ─────────────────────────────────────────────
const WELCOME_PIN = process.env.WELCOME_PIN || 'racoon';
const TAK_MINUTTER = 30;

let welcome = {
  mode: 'off',          // 'off' | 'velkommen' | 'tak'
  navn: '', firma: '', farve: '#f5c518',
  slut: '17:00', endsAt: 0,
  logo: '', logoVersion: 0,
};

function cphMinutesNow() {
  const s = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function checkAutoOff() {
  if (welcome.mode !== 'off' && welcome.endsAt && Date.now() >= welcome.endsAt) {
    welcome.mode = 'off';
    welcome.endsAt = 0;
  }
}

function publicState() {
  checkAutoOff();
  const { logo, ...rest } = welcome;
  return { ...rest, hasLogo: !!logo };
}

app.get('/gaest', (req, res) => res.sendFile(path.join(__dirname, 'gaest.html')));

app.get('/api/welcome', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(publicState());
});

app.get('/api/welcome/logo', (req, res) => {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(welcome.logo || '');
  if (!m) return res.status(404).end();
  res.set('Content-Type', m[1]);
  res.set('Cache-Control', 'no-store');
  res.send(Buffer.from(m[2], 'base64'));
});

app.post('/api/welcome', express.json({ limit: '8mb' }), (req, res) => {
  try {
    const b = req.body || {};
    if (String(b.pin || '').trim() !== WELCOME_PIN) {
      return res.status(401).json({ error: 'Forkert kode' });
    }
    const clean = (v, max) => String(v || '').trim().slice(0, max);

    if (b.navn !== undefined)  welcome.navn  = clean(b.navn, 60);
    if (b.firma !== undefined) welcome.firma = clean(b.firma, 80);
    if (b.farve !== undefined && /^#[0-9a-f]{3,8}$/i.test(b.farve)) welcome.farve = b.farve;
    if (b.slut !== undefined && /^\d{1,2}:\d{2}$/.test(b.slut)) welcome.slut = b.slut;
    if (b.logo !== undefined) {
      if (b.logo === '') { welcome.logo = ''; welcome.logoVersion++; }
      else if (/^data:image\/[a-z+.-]+;base64,/i.test(b.logo)) { welcome.logo = b.logo; welcome.logoVersion++; }
    }

    if (b.mode === 'velkommen') {
      const [h, m] = welcome.slut.split(':').map(Number);
      let diff = (h * 60 + m) - cphMinutesNow();
      if (diff <= 0) diff = 120; // sluttid allerede passeret: sluk om 2 timer
      welcome.mode = 'velkommen';
      welcome.endsAt = Date.now() + diff * 60000;
    } else if (b.mode === 'tak') {
      welcome.mode = 'tak';
      welcome.endsAt = Date.now() + TAK_MINUTTER * 60000;
    } else if (b.mode === 'off') {
      welcome.mode = 'off';
      welcome.endsAt = 0;
    }
    res.json(publicState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Noget gik galt' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Infoskærm kører på http://localhost:${PORT}`);
  console.log(`📊 Henter KPI-data fra Google Sheets`);
});
