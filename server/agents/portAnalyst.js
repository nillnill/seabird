const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');
const { resolveBaseline } = require('./baselineUtils');
const { REGION_CHARACTERS } = require('../data/regionCharacters');

// 각 항구의 대표 캐릭터가 1시간에 한 번 자기 항구의 '현재 운영 상황'을 1인칭으로 보고한다.
// (과거: 30개 항만을 한 보고로 묶어 분석. 지금: 항구별 캐릭터 보고 = 항구별 agent_reports 행)
const POLL_INTERVAL_MS = 60 * 60 * 1000;        // 1시간
const REPORT_TTL_MS = 50 * 60 * 1000;           // 50분 내 이미 보고한 항구는 skip (재시작 중복 방지)
const CLAUDE_CONCURRENCY = 5;                    // 동시 호출 제한 (rate limit 보호)

// waiting_ships(반경 내 ≤2kn 선박 수) 평년 기준값 — 2026-06 baselines 실측 중앙값으로 재보정.
// 동적 평년(resolveBaseline, n≥48·24h)이 쌓이면 폴백으로만 쓰임.
const HARDCODED_BASELINE = {
  rotterdam: 880, antwerp: 410, singapore: 385, hamburg: 315, busan: 250,
  tanjung_pelepas: 175, jakarta: 170, hongkong: 125, la_lb: 120, shenzhen: 95,
  newyork: 85, incheon: 85, guangzhou: 46, savannah: 33, yokohama: 30,
  shanghai: 150, ningbo: 90, portklang: 90, qingdao: 70, tianjin: 60,
  kaohsiung: 50, dubai: 40, mumbai: 40, xiamen: 40, laem_chabang: 35,
  hochiminhcity: 35, colombo: 30, gwangyang: 20, kobe: 15, vladivostok: 12,
};

const PORTS = [
  { id: 'busan',       name: '부산항',           lat: 35.1028, lng: 129.0403,  radius_nm: 15 },
  { id: 'incheon',     name: '인천항',           lat: 37.4563, lng: 126.6078,  radius_nm: 12 },
  { id: 'gwangyang',   name: '광양항',           lat: 34.9333, lng: 127.7167,  radius_nm: 10 },
  { id: 'singapore',   name: '싱가포르항',       lat: 1.2654,  lng: 103.8198,  radius_nm: 20 },
  { id: 'shanghai',    name: '상하이항',         lat: 31.2304, lng: 121.4737,  radius_nm: 25 },
  { id: 'rotterdam',   name: '로테르담항',       lat: 51.9225, lng: 4.4792,    radius_nm: 20 },
  { id: 'la_lb',       name: 'LA/LB항',         lat: 33.7701, lng: -118.1937, radius_nm: 20 },
  { id: 'dubai',       name: '두바이항',         lat: 25.2048, lng: 55.2708,   radius_nm: 15 },
  { id: 'yokohama',    name: '요코하마항',       lat: 35.44,   lng: 139.64,    radius_nm: 20 },
  { id: 'kobe',        name: '고베항',           lat: 34.69,   lng: 135.19,    radius_nm: 15 },
  { id: 'ningbo',      name: '닝보·주산항',     lat: 29.87,   lng: 121.56,    radius_nm: 25 },
  { id: 'shenzhen',    name: '선전·옌톈항',     lat: 22.55,   lng: 114.28,    radius_nm: 20 },
  { id: 'hongkong',    name: '홍콩항',           lat: 22.31,   lng: 114.17,    radius_nm: 20 },
  { id: 'vladivostok', name: '블라디보스토크항', lat: 43.12,   lng: 131.89,    radius_nm: 15 },
  { id: 'portklang',   name: '포트클랑',         lat: 2.99,    lng: 101.43,    radius_nm: 20 },
  { id: 'mumbai',      name: '뭄바이항',         lat: 18.93,   lng: 72.83,     radius_nm: 20 },
  { id: 'hamburg',         name: '함부르크항',       lat: 53.55,   lng: 9.98,      radius_nm: 20 },
  { id: 'newyork',         name: '뉴욕·뉴저지항',   lat: 40.66,   lng: -74.08,    radius_nm: 25 },
  { id: 'guangzhou',       name: '광저우·난사항',   lat: 22.77,   lng: 113.58,    radius_nm: 25 },
  { id: 'qingdao',         name: '칭다오항',         lat: 36.07,   lng: 120.38,    radius_nm: 20 },
  { id: 'tianjin',         name: '톈진·신강항',     lat: 38.99,   lng: 117.72,    radius_nm: 20 },
  { id: 'antwerp',         name: '앤트워프항',       lat: 51.23,   lng: 4.40,      radius_nm: 20 },
  { id: 'tanjung_pelepas', name: '탄중펠레파스항',   lat: 1.36,    lng: 103.55,    radius_nm: 15 },
  { id: 'xiamen',          name: '샤먼항',           lat: 24.48,   lng: 118.09,    radius_nm: 15 },
  { id: 'kaohsiung',       name: '가오슝항',         lat: 22.62,   lng: 120.27,    radius_nm: 15 },
  { id: 'laem_chabang',    name: '렘차방항',         lat: 13.09,   lng: 100.89,    radius_nm: 15 },
  { id: 'jakarta',         name: '자카르타항',       lat: -6.09,   lng: 106.87,    radius_nm: 20 },
  { id: 'colombo',         name: '콜롬보항',         lat: 6.94,    lng: 79.85,     radius_nm: 20 },
  { id: 'savannah',        name: '사바나항',         lat: 32.09,   lng: -81.09,    radius_nm: 15 },
  { id: 'hochiminhcity',   name: '호치민항',         lat: 10.76,   lng: 106.70,    radius_nm: 20 },
];

const SYSTEM_PROMPT = `당신은 한 항구를 대표하는 역사적 인물입니다. 당신의 항구의 '지금 이 순간 운영 상황'을 1인칭으로 보고하세요.

규칙:
- 당신(캐릭터)의 말투·기개·정체성을 살리되, 보고 내용은 반드시 제공된 실시간 통계에 근거합니다.
- 역사 강의·과거 회상 금지. 지금 항구가 붐비는지/한산한지, 어떤 선종이 드나드는지, 평년 대비 어떤지를 전하세요.
- 수치를 자연스럽게 인용하되 과장하지 마세요. 데이터가 적으면 "오늘은 관측이 한산하다"처럼 솔직하게.
- ⚠️ slow_ships는 항만권 내 저속(≤2kn) 선박 수로 정박·계류 선박까지 포함하는 '현재 머무는 선박' 수치이지 순수 대기열이 아닙니다. "며칠을 기다린다", "예상 대기 N시간" 같은 단정은 금지하고, 평년 대비 붐비는 정도로만 표현하세요.

Respond ONLY with valid JSON. Language: Korean. detail은 개조식 마크다운.
{
  "title": "한 줄 상황 보고 (항구명 포함, 캐릭터 톤). 예: '부산항, 새벽부터 분주하다 — 평년보다 붐벼'",
  "summary": "1인칭 핵심 요약 (최대 70자)",
  "detail": "## ⚓ 현재 상황\\n- 대기·혼잡 현황 (수치 인용)\\n\\n## 🚢 입출항 동향\\n- 선종 분포·특이사항\\n\\n## 🗣️ 한마디\\n> 캐릭터의 1인칭 코멘트",
  "ai_comment": "운영/공급망 시사점 (최대 120자, 1인칭 가능)"
}`;

function nmToDeg(nm) { return nm / 60; }

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function queryPortShips(port) {
  const deg = nmToDeg(port.radius_nm);
  const { data } = await getDb()
    .from('ships')
    .select('mmsi, vessel_type, flag_country, speed, updated_at')
    .gte('lat', port.lat - deg).lte('lat', port.lat + deg)
    .gte('lng', port.lng - deg).lte('lng', port.lng + deg)
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
  return data ?? [];
}

// 항구별 결정적 통계 (Claude 미사용)
// ※ waiting = 항만권 내 저속(≤2kn) 선박 수로 정박·계류 포함(순수 대기열 아님). 평년(avg90d)도 같은
//   모집단이라, severity는 절대 수가 아니라 '평년 대비 편차'로만 판단한다(대형항 상시 CRITICAL 방지).
async function collectPortStats(port, db) {
  const ships = await queryPortShips(port);
  const waiting = ships.filter(s => (s.speed ?? 0) <= 2.0).length;
  const avg90d = await resolveBaseline(db, port.id, 'waiting_ships', HARDCODED_BASELINE[port.id] ?? 10);
  const changePct = avg90d > 0 ? Math.round(((waiting - avg90d) / avg90d) * 100) : 0;

  const typeDist = {};
  ships.forEach(s => { const t = s.vessel_type || 'Other'; typeDist[t] = (typeDist[t] || 0) + 1; });

  const severity = changePct >= 60 ? 'CRITICAL' : changePct >= 30 ? 'WARNING' : 'INFO';

  return { port, total: ships.length, waiting, avg90d, changePct, typeDist, severity };
}

// 동시성 제한 map
async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

// 한 항구의 캐릭터 보고 생성 + 저장
async function reportPort(stat, db) {
  const { port } = stat;
  const char = REGION_CHARACTERS[port.id];
  const dir = stat.changePct > 5 ? 'UP' : stat.changePct < -5 ? 'DOWN' : 'STABLE';

  let result;
  try {
    result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        character: char
          ? { name: char.name, title: char.title, quote: char.quote, role: char.role, top_cargoes: char.topCargoes }
          : { name: `${port.name} 항만관제`, title: '항만 운영', role: '' },
        port: port.name,
        live: {
          ships_in_area: stat.total,
          slow_ships: stat.waiting,                 // ≤2kn — 정박·계류 포함, 순수 대기열 아님
          baseline_slow_ships: stat.avg90d,
          change_pct_vs_baseline: stat.changePct,
          vessel_type_dist: stat.typeDist,
        },
        expected_severity: stat.severity,
      }),
      maxTokens: 1400,
      model: 'claude-haiku-4-5',
    });
  } catch (err) {
    console.error(`[PORT_ANALYST] ${port.id} claude error:`, err.message);
    return false;
  }

  const dataPoints = [
    { label: port.name, current: stat.waiting, baseline: stat.avg90d, unit: '척', change_pct: stat.changePct, direction: dir },
  ];

  const { error } = await db.from('agent_reports').insert({
    agent_id: 'PORT_ANALYST',
    severity: stat.severity,
    title: result.title,
    summary: result.summary,
    detail: result.detail,
    data_points: dataPoints,
    annotations: [result.ai_comment].filter(Boolean),
    related_mmsi: [],
    location: { lat: port.lat, lng: port.lng, zoom: 8 },
    raw_data: {
      port_id: port.id,
      port_name: port.name,
      waiting: stat.waiting,
      baseline: stat.avg90d,
      change_pct: stat.changePct,
      character: char
        ? { name: char.name, title: char.title, image: char.image, symbolEmoji: char.symbolEmoji, flagEmoji: char.flagEmoji, region: port.name }
        : null,
    },
  });
  if (error) {
    console.error(`[PORT_ANALYST] ${port.id} insert error:`, error.message);
    return false;
  }
  console.log(`[PORT_ANALYST] ${port.id} (${char?.name ?? '?'}) report saved:`, stat.severity);
  return true;
}

async function runPortAnalyst() {
  console.log('[PORT_ANALYST] run at', new Date().toISOString());
  const db = getDb();

  // 1) 항구별 통계 수집
  const stats = await mapLimit(PORTS, 8, (port) => collectPortStats(port, db));

  // 2) 실시간 데이터 있는 항구만 보고 (커버리지 공백 0척은 거짓 보고 방지 위해 skip)
  let targets = stats.filter(s => s.total > 0);

  // 3) 재시작 중복 방지 — 최근 50분 내 보고한 항구 제외
  const since = new Date(Date.now() - REPORT_TTL_MS).toISOString();
  const { data: recent } = await db
    .from('agent_reports')
    .select('raw_data, created_at')
    .eq('agent_id', 'PORT_ANALYST')
    .gte('created_at', since);
  const recentIds = new Set((recent ?? []).map(r => r.raw_data?.port_id).filter(Boolean));
  const skipped = targets.filter(s => recentIds.has(s.port.id)).length;
  targets = targets.filter(s => !recentIds.has(s.port.id));

  if (targets.length === 0) {
    console.log(`[PORT_ANALYST] 보고 대상 없음 (데이터 0척 또는 최근 보고 ${skipped}건)`);
    return;
  }
  console.log(`[PORT_ANALYST] 보고 대상 ${targets.length}개 항구 (skip ${skipped})`);

  // 4) 항구별 캐릭터 보고 (동시성 제한)
  const results = await mapLimit(targets, CLAUDE_CONCURRENCY, (s) => reportPort(s, db));
  console.log(`[PORT_ANALYST] 완료 — ${results.filter(Boolean).length}/${targets.length} 저장`);
}

function startPortAnalyst() {
  runPortAnalyst();
  return setInterval(runPortAnalyst, POLL_INTERVAL_MS);
}

module.exports = { runPortAnalyst, startPortAnalyst, PORTS, HARDCODED_BASELINE, getDb, collectPortStats, reportPort };
