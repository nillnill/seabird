// 해양수산부 공공데이터(data.go.kr) 월별 공식 통계 → kor_port_monthly 적재.
// AIS 사각지대인 국내 철강·정유 항만(광양·포항·당진·울산·여수)을 공식 수치로 보완. X CAPITAL 소스.
//
//   - SsopVsslEtryndHarbor2/YM : 항만별 선박입출항실적(월) — per-port. item='in'/'out'(척수)
//   - SsopCargFrghtPrdlst2/YM  : 품목별 화물처리실적(월)   — 전국(port_id='KR'). item=품목코드(total R/T)
//
// 인증키: env DATA_GO_KR_KEY. 키 없음/오류/0행 → 1회 경고 후 skip(demo). 서버 무중단.
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const POLL_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12시간 (월 데이터)
const BACKFILL_MONTHS = 13;
const BASE = 'https://apis.data.go.kr/1192000';

let _supabase = null, _warned = false;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 응답 항만명(prtAgNm) → 우리 port id. (당진은 '평택.당진'으로 표기됨)
const KOR_PORT_NAME_TO_ID = {
  '광양': 'gwangyang', '포항': 'pohang', '평택.당진': 'dangjin',
  '울산': 'ulsan', '여수': 'yeosu', '부산': 'busan', '인천': 'incheon',
};

function ymMinus(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function num(s) { const n = parseFloat(String(s ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : 0; }
function tag(xml, name) { const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`)); return m ? m[1] : null; }

// 한 엔드포인트를 페이지네이션으로 전부 가져와 item XML 배열 반환.
async function fetchItems(path, sym, eym) {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error('DATA_GO_KR_KEY 미설정');
  const items = [];
  let pageNo = 1; const numOfRows = 500;
  for (;;) {
    const url = `${BASE}/${path}?serviceKey=${key}&sym=${sym}&eym=${eym}&numOfRows=${numOfRows}&pageNo=${pageNo}`;
    const res = await fetch(url, { timeout: 25000 });
    const body = await res.text();
    const msg = tag(body, 'resultMsg');
    if (msg && msg !== 'NORMAL_SERVICE') throw new Error(`${path}: ${msg}`);
    const page = [...body.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
    items.push(...page);
    const total = num(tag(body, 'totalCount'));
    if (items.length >= total || page.length === 0) break;
    pageNo++;
    if (pageNo > 20) break; // 안전 상한
  }
  return items;
}

// 항만별 입출항(per-port) → [{port_id, category:'vessel', item:'in'|'out', period_ym, value, unit}]
async function fetchVessel(sym, eym) {
  const items = await fetchItems('SsopVsslEtryndHarbor2/YM', sym, eym);
  const out = [];
  for (const it of items) {
    const portId = KOR_PORT_NAME_TO_ID[(tag(it, 'prtAgNm') || '').trim()];
    if (!portId) continue; // 대상 항만만
    const ym = (tag(it, 'useYm') || '').trim();
    if (!/^\d{6}$/.test(ym)) continue;
    // 국적선/외국선/연안선 detail 합산
    let inN = 0, outN = 0;
    for (const d of [...it.matchAll(/<detail>([\s\S]*?)<\/detail>/g)].map(m => m[1])) {
      inN += num(tag(d, 'etrVsslCo')); outN += num(tag(d, 'satVsslCo'));
    }
    out.push({ port_id: portId, category: 'vessel', item: 'in',  period_ym: ym, value: inN,  unit: '척' });
    out.push({ port_id: portId, category: 'vessel', item: 'out', period_ym: ym, value: outN, unit: '척' });
  }
  return out;
}

// 전국 품목별 처리량 → [{port_id:'KR', category:'cargo', item:품목코드, period_ym, value:total, unit:'R/T'}]
async function fetchCargo(sym, eym) {
  const items = await fetchItems('SsopCargFrghtPrdlst2/YM', sym, eym);
  const out = [];
  for (const it of items) {
    const ym = (tag(it, 'useYm') || '').trim();
    const cd = (tag(it, 'frghtPrdlstCd') || '').trim();
    if (!/^\d{6}$/.test(ym) || !cd) continue;
    out.push({ port_id: 'KR', category: 'cargo', item: cd, period_ym: ym, value: num(tag(it, 'total')), unit: 'R/T' });
  }
  return out;
}

async function runKorPortStats() {
  console.log('[KOR_PORT_STATS] run at', new Date().toISOString());
  const db = getDb();
  const sym = ymMinus(BACKFILL_MONTHS), eym = ymMinus(0);
  try {
    const [vessel, cargo] = await Promise.all([fetchVessel(sym, eym), fetchCargo(sym, eym)]);
    const payload = [...vessel, ...cargo];
    if (!payload.length) {
      if (!_warned) { _warned = true; console.warn('[KOR_PORT_STATS] 0행 — DATA_GO_KR_KEY 확인 필요. 그 전까지 국내 공식 통계는 데모.'); }
      return 0;
    }
    // 유니크 충돌은 갱신. 큰 배열은 청크로.
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await db.from('kor_port_monthly').upsert(payload.slice(i, i + 500), { onConflict: 'port_id,category,item,period_ym' });
      if (error) { console.error('[KOR_PORT_STATS] upsert error:', error.message); return 0; }
    }
    console.log(`[KOR_PORT_STATS] ${vessel.length} vessel + ${cargo.length} cargo rows upserted (${sym}~${eym})`);
    return payload.length;
  } catch (err) {
    if (!_warned) { _warned = true; console.warn(`[KOR_PORT_STATS] 수급 실패(${err.message}). DATA_GO_KR_KEY 설정 시 라이브.`); }
    return 0;
  }
}

function startKorPortStats() {
  runKorPortStats();
  return setInterval(runKorPortStats, POLL_INTERVAL_MS);
}

module.exports = { runKorPortStats, startKorPortStats, KOR_PORT_NAME_TO_ID };
