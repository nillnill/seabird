// BDTI(발틱 더티탱커 운임지수) → freight_history 적재. X CAPITAL Wagner(에너지·정유) 데스크 운임 소스.
//
// ⚠️ investing.com(kr.investing.com/indices/baltic-dirty-tanker)은 데이터센터 IP에서 Cloudflare가
//    HTML·차트 데이터 엔드포인트를 403으로 차단한다(서버 직접 스크랩 불가). 따라서:
//    1) env `BDTI_FETCH_URL`가 있으면 그 JSON(`[{date|obs_date, value|v}]`)을 우선 사용한다
//       (프록시·스크래핑 API·자체 수집 엔드포인트를 꽂는 용도).
//    2) 없으면 investing.com을 best-effort로 시도하고, CF 차단/파싱 실패 시 1회 경고 후 skip(데모 모드).
//    데이터가 없으면 Wagner 운임은 '축적 중'으로 표시되며 나머지(탱커 입항·유입·체류·혼잡)는 정상.
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const POLL_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12시간 (운임지수 일간)
const INVESTING_URL = 'https://kr.investing.com/indices/baltic-dirty-tanker';

let _supabase = null, _warned = false;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

function toNum(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

// env BDTI_FETCH_URL: 프록시/대체 소스가 [{date|obs_date, value|v}] JSON을 반환한다고 가정.
async function fetchFromProxy(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 20000 });
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const j = await res.json();
  const list = Array.isArray(j) ? j : (j.data || j.rows || j.series || []);
  const out = [];
  for (const r of list) {
    const date = (r.obs_date || r.date || '').toString().match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const value = toNum(r.value ?? r.v ?? r.close ?? r.last);
    if (date && value != null) out.push({ index_code: 'BDTI', category: 'tanker', obs_date: date, value, unit: 'pt' });
  }
  return out;
}

// investing.com best-effort(대개 CF 403 → 빈 배열).
async function fetchFromInvesting() {
  const res = await fetch(INVESTING_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', Accept: 'text/html' },
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`investing HTTP ${res.status}`);
  const body = await res.text();
  if (/cloudflare|Just a moment|captcha/i.test(body)) throw new Error('cloudflare blocked');
  // 페이지가 통과한 경우에만: 현재가 1점이라도 오늘 날짜로 적재(시계열은 프록시 권장).
  const pm = body.match(/instrument-price-last[^>]*>([\d,\.]+)/i) || body.match(/"last"\s*:\s*"?([\d,\.]+)/i);
  const v = pm && toNum(pm[1]);
  if (v == null) return [];
  const today = new Date().toISOString().slice(0, 10);
  return [{ index_code: 'BDTI', category: 'tanker', obs_date: today, value: v, unit: 'pt' }];
}

async function runTankerScraper() {
  console.log('[TANKER_SCRAPER] run at', new Date().toISOString());
  const db = getDb();
  try {
    const proxyUrl = process.env.BDTI_FETCH_URL;
    const payload = proxyUrl ? await fetchFromProxy(proxyUrl) : await fetchFromInvesting();
    if (!payload.length) {
      if (!_warned) { _warned = true; console.warn('[TANKER_SCRAPER] BDTI 0행 — investing.com이 차단됐을 수 있음. BDTI_FETCH_URL(프록시/대체 JSON)을 설정하면 라이브 전환. 그 전까지 Wagner 운임은 데모.'); }
      return 0;
    }
    const { error } = await db.from('freight_history').upsert(payload, { onConflict: 'index_code,obs_date' });
    if (error) { console.error('[TANKER_SCRAPER] upsert error:', error.message); return 0; }
    console.log(`[TANKER_SCRAPER] BDTI ${payload.length} rows upserted`);
    return payload.length;
  } catch (err) {
    if (!_warned) { _warned = true; console.warn(`[TANKER_SCRAPER] BDTI 수급 실패(${err.message}). BDTI_FETCH_URL 설정 시 라이브. 그 전까지 Wagner 운임은 데모.`); }
    return 0;
  }
}

function startTankerScraper() {
  runTankerScraper();
  return setInterval(runTankerScraper, POLL_INTERVAL_MS);
}

module.exports = { runTankerScraper, startTankerScraper };
