// 탱커 운임 → freight_history. X CAPITAL Wagner(에너지·정유) 데스크 운임 소스.
//
// BDTI(발틱 더티탱커)는 발틱거래소 독점 지수라 무료 소스가 없다(investing.com은 서버 Cloudflare 403).
// 대신 Yahoo Finance에서 무료·서버접근 가능한 **BWET(Breakwave Tanker Shipping ETF)** 를 쓴다 —
// 원유 탱커 운임 선물을 추종하는 ETF라 탱커 운임의 좋은 프록시. (env TANKER_SYMBOL로 심볼 교체 가능)
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const POLL_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12시간 (일간 시세)
const SYMBOL = process.env.TANKER_SYMBOL || 'BWET';
const INDEX_CODE = 'BWET';

let _supabase = null, _warned = false;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// Yahoo Finance 차트 API → [{ obs_date, value }] 일별 종가 (1년)
async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(j?.chart?.error?.description || 'no chart result');
  const ts = r.timestamp || [];
  const close = r.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const v = close[i];
    if (v == null) continue;
    const obs_date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    out.push({ obs_date, value: Math.round(v * 100) / 100 });
  }
  return out;
}

async function runTankerScraper() {
  console.log('[TANKER_SCRAPER] run at', new Date().toISOString());
  const db = getDb();
  try {
    const rows = await fetchYahoo(SYMBOL);
    if (!rows.length) {
      if (!_warned) { _warned = true; console.warn('[TANKER_SCRAPER] BWET 0행 — Yahoo 응답 확인 필요.'); }
      return 0;
    }
    const payload = rows.map(r => ({ index_code: INDEX_CODE, category: 'tanker', obs_date: r.obs_date, value: r.value, unit: '$' }));
    const { error } = await db.from('freight_history').upsert(payload, { onConflict: 'index_code,obs_date' });
    if (error) { console.error('[TANKER_SCRAPER] upsert error:', error.message); return 0; }
    console.log(`[TANKER_SCRAPER] ${SYMBOL} ${payload.length} rows upserted (Yahoo Finance)`);
    return payload.length;
  } catch (err) {
    if (!_warned) { _warned = true; console.warn(`[TANKER_SCRAPER] 실패(${err.message}).`); }
    return 0;
  }
}

function startTankerScraper() {
  runTankerScraper();
  return setInterval(runTankerScraper, POLL_INTERVAL_MS);
}

module.exports = { runTankerScraper, startTankerScraper };
