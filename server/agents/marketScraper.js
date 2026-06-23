// 원자재·광물 상장 가격(선물·ETF·주식) → freight_history(category='market'). (사용자 요청)
// tankerScraper.fetchYahoo 패턴 일반화 — commodityInstruments의 전 심볼 일별 종가 수집.
// 원자 레이어(재사용): index_code=심볼로 freight_history에 적재 → 시장 제약(②)·공급루트 가격·X CAPITAL 공용.
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { COMMODITY_INSTRUMENTS } = require('../data/commodityInstruments');

const POLL_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h (일간 시세)

let _supabase = null, _warned = false;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// Yahoo Finance 차트 API → [{ obs_date, value }] 일별 종가(6개월). (tankerScraper와 동일 패턴)
async function fetchYahoo(symbol, range = '6mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
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
    out.push({ obs_date: new Date(ts[i] * 1000).toISOString().slice(0, 10), value: Math.round(v * 100) / 100 });
  }
  return out;
}

// 전 품목·심볼 수집 (실패 심볼은 skip). 동시성 제한으로 Yahoo rate limit 회피.
async function runMarketScraper() {
  console.log('[MARKET_SCRAPER] run at', new Date().toISOString());
  const db = getDb();
  const jobs = [];
  for (const [commodity, instruments] of Object.entries(COMMODITY_INSTRUMENTS)) {
    for (const inst of instruments) jobs.push({ commodity, ...inst });
  }
  let symbolsOk = 0, rowsTotal = 0;
  const CONC = 4;
  for (let i = 0; i < jobs.length; i += CONC) {
    const batch = jobs.slice(i, i + CONC);
    await Promise.all(batch.map(async (job) => {
      try {
        const rows = await fetchYahoo(job.symbol);
        if (!rows.length) return;
        // index_code=심볼, category='market', unit=품목|종류 메타 (kind 보존)
        // unit은 VARCHAR(16) — kind만 저장(commodity는 commodityInstruments에서 심볼로 역참조). category='market'.
        const payload = rows.map(r => ({
          index_code: job.symbol, category: 'market', obs_date: r.obs_date, value: r.value, unit: job.kind,
        }));
        const { error } = await db.from('freight_history').upsert(payload, { onConflict: 'index_code,obs_date' });
        if (!error) { symbolsOk++; rowsTotal += payload.length; }
        else if (!_warned) { _warned = true; console.warn('[MARKET_SCRAPER] upsert 실패(freight_history 미생성?):', error.message); }
      } catch (e) { /* 개별 심볼 실패 무시 */ }
    }));
  }
  console.log(`[MARKET_SCRAPER] done — ${symbolsOk}/${jobs.length} symbols, ${rowsTotal} rows`);
  return rowsTotal;
}

function startMarketScraper() {
  runMarketScraper();
  return setInterval(runMarketScraper, POLL_INTERVAL_MS);
}

module.exports = { runMarketScraper, startMarketScraper, fetchYahoo };
