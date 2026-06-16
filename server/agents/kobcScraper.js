// KOBC(한국해양진흥공사) 운임·선가 지수 스크래퍼 → freight_history 적재.
// X CAPITAL(투자 인텔리전스)의 운임 시계열 소스.
//
// 소스: https://www.kobc.or.kr/ebz/shippinginfo/
//   - kdci/gridList.do : 건화물선운임지수 (KDCI·CAPE·PANAMAX·SUPRAMAX·HANDY, 단위 pt·$/DAY)
//                        + 컨테이너선운임지수 + 닝보 NCFI + KOBC 항만·물류지표 (카테고리 파라미터)
//   - sln/gridList.do  : 신조선가 (CAPE180K·KAMSARMAX82K·ULTRAMAX64K·HANDY33K, 단위 $M)
//
// gridList.do는 날짜 범위(시작일~종료일)를 받아 그리드 데이터를 반환한다. 응답이 JSON일 수도,
// HTML <table>일 수도 있어 두 경우를 모두 처리한다(파서가 실패해도 서버는 죽지 않음 — 데모 모드 폴백).
// ※ 실제 요청 파라미터 키(startDt/endDt 등)·카테고리 코드는 네트워크 탭으로 확인해 보정할 수 있다.
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const POLL_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12시간 (운임지수는 일간 — 하루 1~2회면 충분)
const BASE = 'https://www.kobc.or.kr/ebz/shippinginfo';

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 백필 범위 — sDay/eDay 파라미터로 과거 시계열을 한 번에 가져온다(확인됨: 1년 ≈ 246행).
const BACKFILL_DAYS = 400;
function dateRangeQs() {
  const e = new Date();
  const s = new Date(e.getTime() - BACKFILL_DAYS * 86400000);
  const f = (d) => d.toISOString().slice(0, 10);
  return `&sDay=${f(s)}&eDay=${f(e)}`;
}

// 그리드 소스 정의. cols[i]는 행의 (날짜 다음) i번째 숫자 컬럼 → index_code 매핑.
const SOURCES = [
  {
    name: 'drybulk',
    category: 'drybulk',
    url: `${BASE}/kdci/gridList.do?mId=0301000000`,
    cols: [
      { code: 'KDCI',     unit: 'pt' },
      { code: 'CAPE',     unit: '$/DAY' },
      { code: 'PANAMAX',  unit: '$/DAY' },
      { code: 'SUPRAMAX', unit: '$/DAY' },
      { code: 'HANDY',    unit: '$/DAY' },
    ],
  },
  {
    // 컨테이너선운임지수 시계열(주간). 날짜 다음 첫 숫자 = KCCI 종합지수.
    name: 'container',
    category: 'container',
    url: `${BASE}/timeseries/gridList.do?mId=0304000000`,
    cols: [
      { code: 'KCCI', unit: 'pt' },
    ],
  },
  {
    name: 'shipprice',
    category: 'shipprice',
    url: `${BASE}/sln/gridList.do?mId=0401000000`,
    cols: [
      { code: 'NEWBUILD_CAPE',      unit: '$M' },
      { code: 'NEWBUILD_KAMSARMAX', unit: '$M' },
      { code: 'NEWBUILD_ULTRAMAX',  unit: '$M' },
      { code: 'NEWBUILD_HANDY',     unit: '$M' },
    ],
  },
];

// "25,899" / "39,851" / "72.26" → 숫자. 콤마·공백 제거.
function toNum(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

// 응답에서 [{date:'YYYY-MM-DD', nums:[..]}] 추출. JSON 배열·HTML 테이블 모두 처리.
function parseRows(body) {
  const rows = [];
  // 1) JSON 시도 (gridList.do가 JSON 배열/객체를 반환하는 경우)
  try {
    const j = JSON.parse(body);
    const list = Array.isArray(j) ? j : (j.list || j.data || j.rows || j.result || []);
    if (Array.isArray(list) && list.length) {
      for (const r of list) {
        const vals = Object.values(r);
        const dateStr = vals.map(String).find(v => /\d{4}-\d{2}-\d{2}/.test(v));
        const m = dateStr && dateStr.match(/(\d{4}-\d{2}-\d{2})/);
        if (!m) continue;
        const nums = vals.map(toNum).filter(n => n != null);
        rows.push({ date: m[1], nums });
      }
      if (rows.length) return rows;
    }
  } catch { /* JSON 아님 → HTML 파싱 */ }

  // 2) HTML <tr> 파싱 — 날짜를 포함한 행에서 셀 텍스트 추출
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(body)) !== null) {
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let td;
    while ((td = tdRe.exec(tr[1])) !== null) {
      cells.push(td[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    const dateCell = cells.find(c => /^\d{4}-\d{2}-\d{2}$/.test(c));
    if (!dateCell) continue;
    const nums = cells.filter(c => c !== dateCell).map(toNum).filter(n => n != null);
    if (nums.length) rows.push({ date: dateCell, nums });
  }
  return rows;
}

async function fetchSource(src) {
  const res = await fetch(src.url + dateRangeQs(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Seabird XCapital freight fetcher)', 'Accept': 'application/json, text/html' },
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`${src.name} HTTP ${res.status}`);
  const body = await res.text();
  const rows = parseRows(body);
  // 행 → freight_history upsert 페이로드
  const out = [];
  for (const { date, nums } of rows) {
    src.cols.forEach((col, i) => {
      const value = nums[i];
      if (value == null) return;
      out.push({ index_code: col.code, category: src.category, obs_date: date, value, unit: col.unit });
    });
  }
  return out;
}

async function runKobcScraper() {
  console.log('[KOBC_SCRAPER] run at', new Date().toISOString());
  const db = getDb();
  let totalRows = 0;
  for (const src of SOURCES) {
    try {
      const payload = await fetchSource(src);
      if (!payload.length) { console.warn(`[KOBC_SCRAPER] ${src.name}: 0 rows parsed (포맷 확인 필요)`); continue; }
      // (index_code, obs_date) 유니크 — 중복은 갱신
      const { error } = await db.from('freight_history').upsert(payload, { onConflict: 'index_code,obs_date' });
      if (error) { console.error(`[KOBC_SCRAPER] ${src.name} upsert error:`, error.message); continue; }
      totalRows += payload.length;
      console.log(`[KOBC_SCRAPER] ${src.name}: ${payload.length} rows upserted`);
    } catch (err) {
      console.error(`[KOBC_SCRAPER] ${src.name} error:`, err.message);
    }
  }
  console.log(`[KOBC_SCRAPER] done — ${totalRows} rows total`);
  return totalRows;
}

function startKobcScraper() {
  runKobcScraper();
  return setInterval(runKobcScraper, POLL_INTERVAL_MS);
}

module.exports = { runKobcScraper, startKobcScraper, SOURCES };
