// OECD SDMX (sdmx.oecd.org, 무키) — 회원국 월별 최신 지표(IMF 연간보다 신선). 비회원국은 [] 반환(IMF/WB가 커버).
// 현재 확정: 월별 CPI YoY(인플레). source='OECD', as_of=최신월. (실업률 OECD dataflow는 키 불안정 → IMF 폴백.)
const fetch = require('node-fetch');

const OECD_MEMBERS = new Set(['KOR', 'JPN', 'USA', 'DEU', 'AUS']); // 우리 12국 중 OECD 회원

// SDMX-JSON 2.0에서 단일 시리즈의 최신(period,value) 추출
function latestObs(j) {
  const ds = j?.data?.dataSets?.[0];
  const series = ds?.series && Object.values(ds.series)[0];
  if (!series?.observations) return null;
  // 시간 차원 값은 data.structures[0](배열) 또는 구버전 data.structure 아래
  const st = j?.data?.structures?.[0] || j?.data?.structure;
  const obsDim = (st?.dimensions?.observation || [])[0];
  const times = (obsDim?.values || []).map(v => v.id); // index → 'YYYY-MM'
  let best = null;
  for (const [idx, arr] of Object.entries(series.observations)) {
    const period = times[Number(idx)];
    const value = Array.isArray(arr) ? arr[0] : null;
    if (period == null || value == null) continue;
    if (!best || period > best.period) best = { period, value: parseFloat(value) };
  }
  return best;
}

async function fetchCpiYoY(iso3) {
  const start = `${new Date().getFullYear() - 1}-01`;
  const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/${iso3}.M.N.CPI.PA._T.N.GY?startPeriod=${start}&format=jsondata`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.sdmx.data+json' }, timeout: 20000 });
  if (!res.ok) return null;
  const j = await res.json();
  const o = latestObs(j);
  if (!o) return null;
  return {
    domain: 'market', metric_key: 'inflation', value: Math.round(o.value * 100) / 100,
    unit: '%', label: '소비자물가(월)', source: 'OECD', as_of: `${o.period}-01`,
  };
}

async function fetchCountry(iso3) {
  if (!OECD_MEMBERS.has(iso3)) return [];
  const out = [];
  const cpi = await fetchCpiYoY(iso3).catch(() => null);
  if (cpi) out.push(cpi);
  return out;
}

module.exports = { fetchCountry, OECD_MEMBERS };
