// GICOMS(해양안전종합정보시스템) 연안 AIS 통항 통계 → kor_port_monthly(category='sea_density').
// X CAPITAL 한국 항구의 "해역 통항 밀집도" 보조 신호. aisstream 무료티어가 못 잡는 국내 연안을 보완.
//
//   소스: GICOMS WFS GetFeature (GeoServer 백엔드). lage_ship_stats_view = 대해구 격자 × 일 × 시간별 AIS 수.
//   각 항구 주변 BBOX(EPSG:3857)로 격자를 좁혀 하루치 ais 합산 = 해역 밀집도.
//   ※ 데이터가 ~수개월 지연 발행(현재 최신 ~2026-01) → 과거 기준 밀집도. period_ym에 데이터 월 기록.
//   ※ domain은 키 발급 시 등록한 값(seabird.onrender.com). 쿼리 파라미터라 로컬에서도 동작.
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h (월 단위 발행이라 드물게)
const WFS = 'https://gicoms.go.kr/kodispub/openApi/wfs.do';
const DOMAIN = process.env.GICOMS_DOMAIN || 'seabird.onrender.com';
const BBOX_DEG = 0.4; // 항구 중심 ±0.4°(~40km) 해역
// ※ GICOMS 제약: ship_time은 최대 2시간 단위로만 조회 → 하루를 대표 2h 윈도우로 샘플링해 합산.
const TIME_WINDOWS = [['00', '01'], ['08', '09'], ['16', '17']]; // 야간·오전·오후

// 국내 항구 — X CAPITAL 데스크가 쓰는 곳(Taylor 철강·Wagner 정유·Axelrod 부산)
const KOR_PORTS = [
  { id: 'busan', lat: 35.1028, lng: 129.0403 },
  { id: 'incheon', lat: 37.4563, lng: 126.6078 },
  { id: 'gwangyang', lat: 34.9333, lng: 127.7167 },
  { id: 'ulsan', lat: 35.50, lng: 129.39 },
  { id: 'yeosu', lat: 34.79, lng: 127.72 },
  { id: 'pohang', lat: 36.02, lng: 129.44 },
  { id: 'dangjin', lat: 36.97, lng: 126.50 },
];

let _supabase = null, _warned = false;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// EPSG:4326 → 3857
function toMercator(lng, lat) {
  const x = lng * 20037508.34 / 180;
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  return [x, y * 20037508.34 / 180];
}

// OGC Filter: ship_dt=dt AND ship_time hLo~hHi(≤2h) AND BBOX(geom, 항구주변)
function buildFilter(dt, port, hLo, hHi) {
  const [minx, miny] = toMercator(port.lng - BBOX_DEG, port.lat - BBOX_DEG);
  const [maxx, maxy] = toMercator(port.lng + BBOX_DEG, port.lat + BBOX_DEG);
  return '<ogc:Filter><ogc:And>'
    + `<ogc:PropertyIsEqualTo><ogc:PropertyName>ship_dt</ogc:PropertyName><ogc:Literal>${dt}</ogc:Literal></ogc:PropertyIsEqualTo>`
    + `<ogc:PropertyIsBetween><ogc:PropertyName>ship_time</ogc:PropertyName><ogc:LowerBoundary><ogc:Literal>${hLo}</ogc:Literal></ogc:LowerBoundary><ogc:UpperBoundary><ogc:Literal>${hHi}</ogc:Literal></ogc:UpperBoundary></ogc:PropertyIsBetween>`
    + `<ogc:BBOX><ogc:PropertyName>geom</ogc:PropertyName><gml:Envelope xmlns:gml="http://www.opengis.net/gml" srsName="EPSG:3857"><gml:lowerCorner>${minx} ${miny}</gml:lowerCorner><gml:upperCorner>${maxx} ${maxy}</gml:upperCorner></gml:Envelope></ogc:BBOX>`
    + '</ogc:And></ogc:Filter>';
}

async function fetchWindow(port, dt, hLo, hHi) {
  const yr = dt.slice(0, 4);
  const url = `${WFS}?service=WFS&request=GetFeature&TYPENAME=lage_ship_stats_view&domain=${DOMAIN}&key=${process.env.GICOMS_API_KEY}&offeryear=${yr}&Filter=${encodeURIComponent(buildFilter(dt, port, hLo, hHi))}`;
  const res = await fetch(url, { timeout: 30000 });
  const t = await res.text();
  if (t.includes('Exception')) throw new Error((t.match(/code="([^"]+)"/) || [])[1] || 'WFS exception');
  const cells = (t.match(/<gml:featureMember>/g) || []).length;
  const aisSum = [...t.matchAll(/<kodis:ais>([\d.]+)<\/kodis:ais>/g)].map(m => parseFloat(m[1])).reduce((a, b) => a + b, 0);
  return { cells, aisSum };
}

// 하루 밀집도 — 2h 윈도우 여러 개를 합산(API 2시간 제약 준수)
async function fetchPortDensity(port, dt) {
  let aisSum = 0, cells = 0;
  for (const [lo, hi] of TIME_WINDOWS) {
    const w = await fetchWindow(port, dt, lo, hi);
    aisSum += w.aisSum; cells += w.cells;
  }
  return { cells, aisSum: Math.round(aisSum), windows: TIME_WINDOWS.length };
}

const BACKFILL_MONTHS = 14; // 시계열용 — 최근 N개월(발행된 달만 적재)

// 해당 월(YYYYMM)에 데이터가 있는 대표일 탐색(부산 단일 2h 윈도우로 확인). 없으면 null(미발행).
async function findDayInMonth(ym) {
  for (const day of ['15', '02', '20', '10']) {
    const dt = ym + day;
    try {
      const r = await fetchWindow(KOR_PORTS[0], dt, '08', '09');
      if (r.cells > 0) return dt;
    } catch { /* 계속 */ }
  }
  return null;
}

async function runGicomsStats() {
  console.log('[GICOMS_STATS] run at', new Date().toISOString());
  if (!process.env.GICOMS_API_KEY) {
    if (!_warned) { _warned = true; console.warn('[GICOMS_STATS] GICOMS_API_KEY 미설정 — 해역 밀집도 skip.'); }
    return 0;
  }
  const db = getDb();
  // 이미 적재된 월은 skip(요청 절약). 첫 실행은 백필, 이후엔 신규 월만.
  const { data: existing } = await db.from('kor_port_monthly').select('period_ym').eq('category', 'sea_density');
  const haveYm = new Set((existing ?? []).map(r => r.period_ym));

  const now = new Date();
  let totalRows = 0, monthsFilled = 0;
  for (let i = 0; i < BACKFILL_MONTHS; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (haveYm.has(ym)) continue; // 이미 있음
    try {
      const dt = await findDayInMonth(ym);
      if (!dt) continue; // 미발행 월
      const rows = [];
      for (const port of KOR_PORTS) {
        try { const { aisSum } = await fetchPortDensity(port, dt); rows.push({ port_id: port.id, category: 'sea_density', item: 'all', period_ym: ym, value: aisSum, unit: 'AIS통항' }); }
        catch { /* 개별 항구 실패 무시 */ }
      }
      if (rows.length) {
        const { error } = await db.from('kor_port_monthly').upsert(rows, { onConflict: 'port_id,category,item,period_ym' });
        if (!error) { totalRows += rows.length; monthsFilled++; console.log(`[GICOMS_STATS] ${ym}: ${rows.length} ports (date ${dt})`); }
      }
    } catch { /* 월 단위 실패 무시 */ }
  }
  if (!monthsFilled && !haveYm.size && !_warned) { _warned = true; console.warn('[GICOMS_STATS] 가용 데이터 없음(발행 지연/키 확인).'); }
  console.log(`[GICOMS_STATS] done — ${monthsFilled} new months, ${totalRows} rows (기존 ${haveYm.size}개월)`);
  return totalRows;
}

function startGicomsStats() {
  runGicomsStats();
  return setInterval(runGicomsStats, POLL_INTERVAL_MS);
}

module.exports = { runGicomsStats, startGicomsStats, KOR_PORTS };
