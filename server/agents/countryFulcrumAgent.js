// COUNTRY FULCRUM (L0 공식수집 + L1 합성) — 주 1회.
// Marko Papic 'Geopolitical Alpha': 4제약(정치·시장·지정학·법) 사실을 모아 넷 어세스먼트로 fulcrum 도출.
// 점수화 금지 — '사실 나열 + 출처'. 원자(country_indicators) ↔ 합성(country_fulcrum) 분리.
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { callClaude } = require('./claudeClient');
const { resolveIndicators } = require('../data/sources/resolveIndicators');
const { getCountryEnergy } = require('../data/sources/energyProfile');
const { buildRoutes } = require('./supplyRoutes');
const { COUNTRY_DATA, MEDIA_DOMAINS } = require('../data/countryData');

const POLL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 주 1회
const CONCURRENCY = 2;                             // 국가 동시 처리(레이트 보호)

const SYSTEM_PROMPT = `You are COUNTRY FULCRUM ANALYST. 프레임워크: Marko Papic 'Geopolitical Alpha' — 정책결정자의 선호가 아니라 '제약(constraints)'이 결과를 결정한다. 4대 제약을 종합(net assessment)해 가장 구속력 있는 단 하나의 제약(fulcrum)을 찾는다.

입력으로 한 국가의 공식지표(World Bank), 구조적 사실(structural), 현지 시사(Perplexity 현지언어 검색)를 받는다.

⚠️ 원칙:
- 점수화 금지. 각 제약을 '사실(fact) 목록'으로 나열한다. 수치 사실은 value·unit·source·as_of를 채우고, 정성 사실은 fact 문장 + source.
- 4제약: political(정치·정치경제: 주요 산업·고용·실업률·여소야대 등 정치환경·정상 성향/지지율·핵심 정책), market(거시·금융시장: 성장·물가·무역의존·경상수지·원자재 노출), geopolitics(지정학: 해상 에너지·교역 의존·핵심 초크포인트·동맹/제재), legal(헌법·법률: 정부형태·법치·규제·조약).
- 각 제약은 **3~5개 핵심 사실**로 간결히(과다 나열 금지). fact 문장은 한 줄.
- energy_profile(자립도·1차에너지 화석/저탄소·발전믹스·설비·전기요금)는 market·geopolitics 제약의 **에너지 안보** 사실로 활용하라(예: "원자력 발전 30%로 에너지 충격 완충", "에너지 자립도 X%·화석 Y%로 해상 수입 의존").
- ⚠️ **최신성**: political·geopolitics의 시사 사실은 local_intel의 **최근 7~30일** 사안만 쓰고, fact 끝에 날짜를 적고 as_of에 그 날짜(YYYY-MM 또는 YYYY-MM-DD)를 넣어라. 30일보다 오래된 시사는 제외(구조적 사실·공식지표는 무관). 최신 사안이 부족하면 그 도메인 사실 수를 줄여라.
- ⚠️ **한 사실 = 한 지표(중요)**: 하나의 수치 fact는 official_indicators의 **단 하나의 지표**만 다룬다. 여러 지표(예 GDP성장 + 무역의존)를 한 문장에 합치지 마라 — 합치면 라벨이 엉뚱한 지표(WB)로 붙는다. value/unit/source/as_of는 **그 단일 지표 것 그대로**. 예: gdp_growth(source='IMF', as_of='2026-12-31')는 별도 fact로 source='IMF'·as_of='2026-12-31'; 무역의존도(WorldBank 2024)는 또 다른 fact. 임의로 'WorldBank'나 과거 연도를 붙이지 마라.
- 넷 어세스먼트: 어느 제약이 지금 가장 구속력 있는가(fulcrum_constraint) + 한 문단 근거(fulcrum_summary) + 방향(tightening|loosening|stable) + 이 fulcrum을 움직이는 라이브 데이터 스트림 목록(maritime_streams: 감시할 초크포인트·원자재가격·통항 등).
- 정성 사실은 정직하게(추정/현지보도 출처 명시). 과장 금지.

Respond ONLY with valid JSON. Language: Korean.
{
  "fulcrum_constraint": "political|market|geopolitics|legal",
  "fulcrum_summary": "넷 어세스먼트 근거 한 문단",
  "fulcrum_direction": "tightening|loosening|stable",
  "constraints": {
    "political":   [{"fact":"...","value":2.7,"unit":"%","source":"<official_indicators의 source 그대로>","as_of":"<그대로>"}],
    "market":      [{"fact":"...","source":"..."}],
    "geopolitics": [{"fact":"...","source":"..."}],
    "legal":       [{"fact":"...","source":"..."}]
  },
  "maritime_streams": [{"label":"호르무즈 통항","stream":"chokepoint:hormuz"},{"label":"WTI 원유선물","stream":"market:CL=F"}]
}`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 현지언어 시사 검색(Perplexity) — 최근 7~30일 가장 중요한 이슈 우선(정치·지지율·정책·제재·해운/에너지)
async function fetchLocalIntel(country) {
  if (!process.env.PERPLEXITY_API_KEY) return '';
  const today = new Date().toISOString().slice(0, 10);
  const domains = MEDIA_DOMAINS[country.code] || [];
  const ask = `오늘은 ${today}이다. ${country.name}의 **최근 7~30일** 가장 중요한 이슈를, **반드시 ${country.name} 자국 언론**(${domains.slice(0, 4).join(', ')} 등)에서 ${country.lang}로 조사하라. ⚠️ 한국 등 외국 매체(경향·매일경제·연합 등)는 인용 금지 — 해당국 자국 매체만. 30일 초과 사안 제외. 영역: (1) 정치 — 집권당 대 야당, 정상 지지율·성향, 핵심 정책·법안; (2) 경제 — 산업·고용·실업·성장/물가; (3) 지정학 — 동맹·제재·분쟁·해상 에너지/교역 안보; (4) 법·규제 — 해운/무역/에너지 규제. 각 항목: **한국어로 번역**한 한 줄 + 날짜(YYYY-MM[-DD]) + **자국 매체명**, 최대 8개. 날짜 없으면 제외.`;
  try {
    const body = {
      model: 'sonar',
      messages: [
        { role: 'system', content: `You are a geopolitical researcher. Today is ${today}. Search ONLY ${country.name}'s domestic ${country.lang}-language press for ${country.name}. NEVER cite foreign (e.g. Korean) media; cite only ${country.name}'s own outlets. Translate each fact into Korean but keep the original domestic outlet name as the source. Only last 7-30 days, each with date.` },
        { role: 'user', content: ask },
      ],
      search_recency_filter: 'month',
      return_citations: true,
    };
    if (domains.length) body.search_domain_filter = domains; // 검색을 자국 매체 도메인으로 제한
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return '';
    const data = await res.json();
    let txt = data.choices?.[0]?.message?.content ?? '';
    return txt.length > 1800 ? txt.slice(0, 1800) + '\n...' : txt;
  } catch { return ''; }
}

// 전기요금(가정용 USD/kWh) — Perplexity best-effort, 숫자 추출 실패 시 null. (무료 가격 API 부재)
async function fetchElectricityPrice(country) {
  if (!process.env.PERPLEXITY_API_KEY) return null;
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: `What is the average residential electricity price in ${country.name} in US dollars per kWh (most recent, e.g. 2025-2026)? Reply with ONLY the number in USD/kWh (e.g. 0.12).` }],
        search_recency_filter: 'year',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data.choices?.[0]?.message?.content ?? '';
    const m = txt.match(/0?\.\d{1,3}/); // 0.xx 형태
    if (!m) return null;
    const v = parseFloat(m[0]);
    if (!(v > 0 && v < 2)) return null;
    return { value: Math.round(v * 1000) / 1000, as_of: new Date().toISOString().slice(0, 10) };
  } catch { return null; }
}

// Claude 입력용 에너지 요약(자립도·1차에너지 구조·발전 믹스·설비) — 에너지 안보 근거로 사용
function summarizeEnergy(chosen, energyRows) {
  const imp = chosen.find(r => r.metric_key === 'energy_import_dep')?.value;
  const e = (k) => energyRows.find(r => r.metric_key === k)?.value;
  return {
    self_sufficiency_pct: imp != null ? Math.round((100 - imp) * 10) / 10 : null,
    primary_fossil_pct: e('primary_fossil_pct'), primary_lowcarbon_pct: e('primary_lowcarbon_pct'),
    elec_gen: { coal: e('elec_gen_coal_pct'), gas: e('elec_gen_gas_pct'), nuclear: e('elec_gen_nuclear_pct'), solar: e('elec_gen_solar_pct'), wind: e('elec_gen_wind_pct'), hydro: e('elec_gen_hydro_pct') },
    capacity_total_gw: e('capacity_total_gw'),
    electricity_price_usd_kwh: e('electricity_price_usd_kwh'),
  };
}

// 원자 지표 upsert (country_indicators) — 재사용/2·3차 가공 기반
async function saveIndicators(db, code, candidates) {
  if (!candidates?.length) return;
  // 유니크 키(country,domain,metric_key,as_of) 기준 배치 내 중복 제거(같은 키 충돌 방지) — source는 마지막 것 유지
  const dedup = {};
  for (const r of candidates) {
    dedup[`${r.domain}|${r.metric_key}|${r.as_of}`] = {
      country_code: code, domain: r.domain, metric_key: r.metric_key,
      value: r.value, unit: r.unit, source: r.source, as_of: r.as_of,
    };
  }
  await db.from('country_indicators').upsert(Object.values(dedup), { onConflict: 'country_code,domain,metric_key,as_of' }).then(({ error }) => {
    if (error) console.warn('[COUNTRY_FULCRUM] indicators upsert:', error.message);
  });
}

async function runOne(code, db) {
  const country = COUNTRY_DATA[code];
  if (!country) return false;
  // 최신성 우선 멀티소스(OECD 월별 > IMF 2026 > WB): chosen=metric별 최신, all=전 후보(원자 저장)
  const { chosen, all } = await resolveIndicators(code).catch(() => ({ chosen: [], all: [] }));
  // 에너지 프로파일(자립도·1차에너지 구조·발전믹스·설비 GW) + 전기요금(Perplexity)
  const energyRows = await getCountryEnergy(code).catch(() => []);
  const price = await fetchElectricityPrice(country).catch(() => null);
  if (price) energyRows.push({ domain: 'energy', metric_key: 'electricity_price_usd_kwh', value: price.value, unit: '$/kWh', source: 'Perplexity', as_of: price.as_of });
  await saveIndicators(db, code, [...all, ...energyRows]);
  const energySummary = summarizeEnergy(chosen, energyRows);
  const localIntel = await fetchLocalIntel(country);

  let result;
  try {
    result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        today: new Date().toISOString().slice(0, 10),
        country: country.name, code,
        structural: country.structural,
        energy_profile: energySummary,
        official_indicators: chosen.map(r => ({ domain: r.domain, key: r.metric_key, label: r.label, value: r.value, unit: r.unit, as_of: r.as_of, source: r.source })),
        local_intel: localIntel || '(현지 검색 미가용)',
      }),
      maxTokens: 5000,
      model: 'claude-sonnet-4-6',
    });
  } catch (err) {
    console.error(`[COUNTRY_FULCRUM] ${code} claude error:`, err.message);
    return false;
  }

  const { error } = await db.from('country_fulcrum').upsert({
    country_code: code, country_name: country.name,
    fulcrum_constraint: result.fulcrum_constraint ?? null,
    fulcrum_summary: result.fulcrum_summary ?? null,
    fulcrum_direction: result.fulcrum_direction ?? 'stable',
    constraints: result.constraints ?? {},
    maritime_streams: result.maritime_streams ?? [],
    sources: { official: 'WorldBank', intel: localIntel ? 'Perplexity' : null, generated_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'country_code' });
  if (error) { console.error(`[COUNTRY_FULCRUM] ${code} upsert:`, error.message); return false; }

  // 공급 루트도 함께 갱신(L0)
  await buildRoutes(code, db).catch(() => {});
  console.log(`[COUNTRY_FULCRUM] ${code} saved — fulcrum=${result.fulcrum_constraint} (${result.fulcrum_direction})`);
  return true;
}

const FRESH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6일 내 갱신된 국가는 재실행 skip(재시작 비용 방지)

async function runCountryFulcrum() {
  console.log('[COUNTRY_FULCRUM] run at', new Date().toISOString());
  const db = getDb();
  let codes = Object.keys(COUNTRY_DATA);
  // 최근 6일 내 갱신된 국가는 skip — 서버 재시작마다 12국 전체 재합성(비용↑) 방지
  const { data: recent } = await db.from('country_fulcrum').select('country_code, updated_at');
  const fresh = new Set((recent ?? [])
    .filter(r => r.updated_at && Date.now() - Date.parse(r.updated_at) < FRESH_TTL_MS)
    .map(r => r.country_code));
  const skipped = codes.filter(c => fresh.has(c)).length;
  codes = codes.filter(c => !fresh.has(c));
  if (!codes.length) { console.log(`[COUNTRY_FULCRUM] 전부 최신(skip ${skipped}) — 종료`); return; }
  console.log(`[COUNTRY_FULCRUM] 대상 ${codes.length}국 (skip ${skipped})`);
  let ok = 0;
  for (let i = 0; i < codes.length; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY);
    const res = await Promise.all(batch.map(c => runOne(c, db).catch(() => false)));
    ok += res.filter(Boolean).length;
  }
  console.log(`[COUNTRY_FULCRUM] done — ${ok}/${codes.length} countries`);
}

function startCountryFulcrum() {
  setTimeout(runCountryFulcrum, 30000); // 시작 30s 후 1회(다른 수집 뒤)
  return setInterval(runCountryFulcrum, POLL_INTERVAL_MS);
}

module.exports = { runCountryFulcrum, runOne, startCountryFulcrum };
