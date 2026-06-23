// World Bank Open Data — 무키·무료. 국가×지표 최신 실측값 → 정규화 {domain,metric_key,value,unit,source,as_of}.
// countryFulcrumAgent(정치·시장·지정학·법 제약의 수치 사실) + officialIndicators(country_indicators 적재)가 사용.
const fetch = require('node-fetch');
const { WB_INDICATORS } = require('../countryData');

// 지표 1개 최신 비결측값. date 범위에서 가장 최근 non-null을 고른다(WB는 연 단위·발행 지연).
async function fetchIndicator(iso3, ind) {
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${ind.code}?format=json&per_page=10&date=2015:2026`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
  const j = await res.json();
  const arr = Array.isArray(j) ? j[1] : null;
  if (!arr || !arr.length) return null;
  const hit = arr.find(r => r.value != null); // 최신순 정렬이라 첫 non-null이 최신
  if (!hit) return null;
  return {
    domain: ind.domain, metric_key: ind.key,
    value: Math.round(parseFloat(hit.value) * 100) / 100,
    unit: ind.unit, label: ind.label,
    source: 'WorldBank', as_of: `${hit.date}-12-31`,
  };
}

// 한 국가의 전 WB 지표 (실패 지표는 skip). 동시성 제한.
async function fetchCountry(iso3) {
  const out = [];
  const CONC = 4;
  for (let i = 0; i < WB_INDICATORS.length; i += CONC) {
    const batch = WB_INDICATORS.slice(i, i + CONC);
    const res = await Promise.all(batch.map(ind => fetchIndicator(iso3, ind).catch(() => null)));
    for (const r of res) if (r) out.push(r);
  }
  return out; // [{domain,metric_key,value,unit,label,source,as_of}]
}

module.exports = { fetchCountry, fetchIndicator };
