// 국가 에너지 프로파일 — 자립도·1차에너지 구조·발전 믹스·발전소 설비 구성. 무료·무키 소스.
//  - OWID(owid-energy-data.csv, 2.56MB): 1차에너지 구조(연료별 share) — 최신연도.
//  - Ember(yearly long CSV, 48.9MB): 발전 믹스(%) + 설비용량(GW) — 2024/2025.
// 배치당 1회 로드·캐시(ISO3 필터). getCountryEnergy(iso3) → country_indicators(domain='energy') 원자 rows.
const fetch = require('node-fetch');
const { COUNTRY_DATA } = require('../countryData');

const ISO_SET = new Set(Object.keys(COUNTRY_DATA));
const OWID_URL = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
const EMBER_URL = 'https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let _owid = null, _ember = null, _loadedAt = 0;

// 따옴표 인식 CSV 라인 파서
function splitCsv(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}

// OWID: 1차에너지 구조 — iso별 최신연도의 share_energy 컬럼
async function loadOWID() {
  const res = await fetch(OWID_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 });
  const text = await res.text();
  const lines = text.split('\n');
  const header = splitCsv(lines[0]);
  const idx = (name) => header.indexOf(name);
  const iIso = idx('iso_code'), iYear = idx('year');
  const cols = {
    coal: idx('coal_share_energy'), gas: idx('gas_share_energy'), oil: idx('oil_share_energy'),
    nuclear: idx('nuclear_share_energy'), hydro: idx('hydro_share_energy'), renew: idx('renewables_share_energy'),
    fossil: idx('fossil_share_energy'), lowcarbon: idx('low_carbon_share_energy'), perCapita: idx('energy_per_capita'),
  };
  const map = {};
  for (let l = 1; l < lines.length; l++) {
    if (!lines[l]) continue;
    const f = splitCsv(lines[l]);
    const iso = f[iIso];
    if (!ISO_SET.has(iso)) continue;
    const year = parseInt(f[iYear], 10);
    if (!year) continue;
    const fossil = parseFloat(f[cols.fossil]);
    if (!Number.isFinite(fossil)) continue; // 구조 데이터 있는 행만
    if (!map[iso] || year > map[iso].year) {
      map[iso] = {
        year,
        coal: parseFloat(f[cols.coal]), gas: parseFloat(f[cols.gas]), oil: parseFloat(f[cols.oil]),
        nuclear: parseFloat(f[cols.nuclear]), hydro: parseFloat(f[cols.hydro]), renew: parseFloat(f[cols.renew]),
        fossil, lowcarbon: parseFloat(f[cols.lowcarbon]), perCapita: parseFloat(f[cols.perCapita]),
      };
    }
  }
  return map;
}

// Ember: 발전 믹스(%) + 설비(GW) — iso별 최신연도. 48.9MB 스트림 필터(메모리 절약).
async function loadEmber() {
  const res = await fetch(EMBER_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 60000 });
  // 헤더: Area,ISO 3 code,Year,...,Category,Subcategory,Variable,Unit,Value,...
  const map = {}; // iso → { gen:{fuel:{year,val}}, cap:{fuel:{year,val}} }
  let buf = '', header = null, idx = {};
  const handle = (line) => {
    if (!header) {
      header = splitCsv(line);
      idx = { iso: header.indexOf('ISO 3 code'), year: header.indexOf('Year'), cat: header.indexOf('Category'), varr: header.indexOf('Variable'), unit: header.indexOf('Unit'), val: header.indexOf('Value') };
      return;
    }
    if (!line) return;
    // 빠른 사전 필터(전체 split 비용 절감)
    if (line.indexOf('Electricity generation') < 0 && line.indexOf('Capacity') < 0) return;
    const f = splitCsv(line);
    const iso = f[idx.iso];
    if (!ISO_SET.has(iso)) return;
    const cat = f[idx.cat], unit = f[idx.unit], fuel = f[idx.varr];
    const year = parseInt(f[idx.year], 10), val = parseFloat(f[idx.val]);
    if (!year || !Number.isFinite(val)) return;
    let kind = null;
    if (cat === 'Electricity generation' && unit === '%') kind = 'gen';
    else if (cat === 'Capacity' && unit === 'GW') kind = 'cap';
    else return;
    (map[iso] ??= { gen: {}, cap: {} });
    const slot = map[iso][kind];
    if (!slot[fuel] || year > slot[fuel].year) slot[fuel] = { year, val };
  };
  await new Promise((resolve, reject) => {
    res.body.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
    });
    res.body.on('end', () => { if (buf) handle(buf); resolve(); });
    res.body.on('error', reject);
  });
  return map;
}

async function ensureLoaded() {
  if (_owid && _ember && Date.now() - _loadedAt < CACHE_TTL_MS) return;
  const [owid, ember] = await Promise.all([loadOWID().catch(() => ({})), loadEmber().catch(() => ({}))]);
  _owid = owid; _ember = ember; _loadedAt = Date.now();
}

const FUELS = ['Coal', 'Gas', 'Nuclear', 'Hydro', 'Solar', 'Wind', 'Bioenergy', 'Other Fossil', 'Other Renewables'];
const FUEL_KEY = { 'Coal': 'coal', 'Gas': 'gas', 'Nuclear': 'nuclear', 'Hydro': 'hydro', 'Solar': 'solar', 'Wind': 'wind', 'Bioenergy': 'bio', 'Other Fossil': 'otherfossil', 'Other Renewables': 'otherrenew' };
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

// iso3 → 정규화 에너지 지표 rows(domain='energy')
async function getCountryEnergy(iso3) {
  await ensureLoaded();
  const rows = [];
  const ow = _owid?.[iso3];
  if (ow) {
    const asof = `${ow.year}-12-31`;
    const push = (k, v) => { if (v != null && Number.isFinite(v)) rows.push({ domain: 'energy', metric_key: k, value: r1(v), unit: '%', source: 'OWID', as_of: asof }); };
    push('primary_coal_pct', ow.coal); push('primary_gas_pct', ow.gas); push('primary_oil_pct', ow.oil);
    push('primary_nuclear_pct', ow.nuclear); push('primary_hydro_pct', ow.hydro); push('primary_renew_pct', ow.renew);
    push('primary_fossil_pct', ow.fossil); push('primary_lowcarbon_pct', ow.lowcarbon);
    if (Number.isFinite(ow.perCapita)) rows.push({ domain: 'energy', metric_key: 'energy_per_capita', value: r1(ow.perCapita), unit: 'kWh/인', source: 'OWID', as_of: asof });
  }
  const em = _ember?.[iso3];
  if (em) {
    let capTotal = 0, capYear = null;
    for (const fuel of FUELS) {
      const k = FUEL_KEY[fuel];
      const g = em.gen?.[fuel];
      if (g) rows.push({ domain: 'energy', metric_key: `elec_gen_${k}_pct`, value: r1(g.val), unit: '%', source: 'Ember', as_of: `${g.year}-12-31` });
      const c = em.cap?.[fuel];
      if (c) { rows.push({ domain: 'energy', metric_key: `capacity_${k}_gw`, value: r1(c.val), unit: 'GW', source: 'Ember', as_of: `${c.year}-12-31` }); capTotal += c.val; capYear = Math.max(capYear || 0, c.year); }
    }
    if (capYear) rows.push({ domain: 'energy', metric_key: 'capacity_total_gw', value: r1(capTotal), unit: 'GW', source: 'Ember', as_of: `${capYear}-12-31` });
  }
  return rows;
}

module.exports = { getCountryEnergy, ensureLoaded };
