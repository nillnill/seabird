// IMF DataMapper (WEO) — 무키·무료, ~190개국(비OECD 포함). 현재연도(2026) 추정치까지 → WB(2024)보다 최신.
// 거시 6지표를 {domain,metric_key,value,unit,source:'IMF',as_of} 로 정규화. 응답: { values: { CODE: { ISO3: { YEAR: v } } } }
const fetch = require('node-fetch');

const IMF_METRICS = [
  { key: 'gdp_growth',     code: 'NGDP_RPCH',  unit: '%',     domain: 'market',    label: 'GDP 성장률' },
  { key: 'inflation',      code: 'PCPIPCH',    unit: '%',     domain: 'market',    label: '소비자물가' },
  { key: 'unemployment',   code: 'LUR',        unit: '%',     domain: 'political', label: '실업률' },
  { key: 'current_account',code: 'BCA_NGDPD',  unit: '% GDP', domain: 'market',    label: '경상수지' },
  { key: 'gdp_usd',        code: 'NGDPD',      unit: 'B$',    domain: 'market',    label: 'GDP(명목)' },
  { key: 'gdp_per_capita', code: 'NGDPDPC',    unit: '$',     domain: 'market',    label: '1인당 GDP' },
];

async function fetchMetric(iso3, m, curYear) {
  const url = `https://www.imf.org/external/datamapper/api/v1/${m.code}/${iso3}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
  const j = await res.json();
  const series = j?.values?.[m.code]?.[iso3];
  if (!series) return null;
  // 현재연도(추정) 우선, 없으면 최신 가용연도(≤ 현재연도)로 폴백
  let year = null;
  if (series[curYear] != null) year = curYear;
  else {
    const years = Object.keys(series).map(Number).filter(y => series[y] != null && y <= curYear).sort((a, b) => b - a);
    if (years.length) year = years[0];
  }
  if (year == null) return null;
  return {
    domain: m.domain, metric_key: m.key, value: Math.round(parseFloat(series[year]) * 100) / 100,
    unit: m.unit, label: m.label, source: 'IMF', as_of: `${year}-12-31`,
  };
}

async function fetchCountry(iso3) {
  const curYear = new Date().getFullYear();
  const out = [];
  const CONC = 3;
  for (let i = 0; i < IMF_METRICS.length; i += CONC) {
    const batch = IMF_METRICS.slice(i, i + CONC);
    const res = await Promise.all(batch.map(m => fetchMetric(iso3, m, curYear).catch(() => null)));
    for (const r of res) if (r) out.push(r);
  }
  return out;
}

module.exports = { fetchCountry, IMF_METRICS };
