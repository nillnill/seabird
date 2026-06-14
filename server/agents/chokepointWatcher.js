const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');
const { resolveBaseline } = require('./baselineUtils');
const { REGION_CHARACTERS } = require('../data/regionCharacters');

// 각 초크포인트의 대표 캐릭터(역사 인물)가 1시간에 한 번 자기 해협의 '현재 통항 상황'을 1인칭으로 보고.
const POLL_INTERVAL_MS = 60 * 60 * 1000;   // 1시간
const REPORT_TTL_MS = 50 * 60 * 1000;      // 50분 내 보고한 초크포인트 skip (재시작 중복 방지)
const CLAUDE_CONCURRENCY = 4;

const HARDCODED_BASELINE = {
  suez: 58, malacca: 247, hormuz: 89, panama: 35,
  dover: 312, korea_strait: 156, bab_el_mandeb: 67,
};

const CHOKEPOINTS = [
  { id: 'suez',          name: '수에즈 운하',    emoji: '🇪🇬', bbox: [[29.9, 31.8], [31.3, 33.1]],  centerLat: 30.42, centerLng: 32.36 },
  { id: 'malacca',       name: '말라카 해협',    emoji: '🇸🇬', bbox: [[1.0, 99.5],  [6.5, 104.5]], centerLat: 2.88,  centerLng: 100.98 },
  { id: 'hormuz',        name: '호르무즈 해협',  emoji: '🇮🇷', bbox: [[25.8, 55.5], [27.0, 57.5]], centerLat: 26.5, centerLng: 56.5 },
  { id: 'panama',        name: '파나마 운하',    emoji: '🇵🇦', bbox: [[8.8, -80.2], [9.5, -79.5]], centerLat: 9.1,  centerLng: -79.9 },
  { id: 'dover',         name: '영불 해협',      emoji: '🇬🇧', bbox: [[50.5, -2.0], [51.5, 2.5]],  centerLat: 51.0, centerLng: 1.5 },
  { id: 'korea_strait',  name: '대한해협',       emoji: '🇰🇷', bbox: [[33.5, 128.5],[35.0, 130.5]],centerLat: 34.2, centerLng: 129.5 },
  { id: 'bab_el_mandeb', name: '바브엘만데브',   emoji: '🇾🇪', bbox: [[11.5, 43.0], [13.0, 44.5]], centerLat: 12.5, centerLng: 43.5 },
];

const SYSTEM_PROMPT = `당신은 한 해협·운하를 대표하는 역사적 인물입니다. 당신이 지키는 해상 관문의 '지금 이 순간 통항 상황'을 1인칭으로 보고하세요.

규칙:
- 당신(캐릭터)의 말투·기개를 살리되, 보고 내용은 반드시 제공된 실시간 통계에 근거합니다.
- 역사 강의 금지. 지금 통항이 활발한지/막혀 있는지, 어떤 선종이 지나는지, 평년 대비 어떤지를 전하세요.
- 통항량이 평년보다 크게 적으면 우려를, 정상이면 안정감을 캐릭터답게 표현. 데이터가 적으면 솔직하게.

Respond ONLY with valid JSON. Language: Korean. detail은 개조식 마크다운.
{
  "title": "한 줄 상황 보고 (관문명 포함, 캐릭터 톤)",
  "summary": "1인칭 핵심 요약 (최대 70자)",
  "detail": "## 🌊 현재 통항\\n- 통과량 현황 (수치 인용)\\n\\n## 🚢 선종 동향\\n- 분포·특이사항\\n\\n## 🗣️ 한마디\\n> 캐릭터의 1인칭 코멘트",
  "ai_comment": "한국 공급망 영향/시사점 (최대 120자, 1인칭 가능)"
}`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function queryShipsInBbox(bbox) {
  const [[latMin, lngMin], [latMax, lngMax]] = bbox;
  const { data } = await getDb()
    .from('ships')
    .select('mmsi, vessel_type, speed')
    .gte('lat', latMin).lte('lat', latMax)
    .gte('lng', lngMin).lte('lng', lngMax)
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
  return data ?? [];
}

// 결정적 통계 (Claude 미사용)
async function collectStats(cp, db) {
  const ships = await queryShipsInBbox(cp.bbox);
  const typeDist = {};
  ships.forEach(s => { const t = s.vessel_type || 'Other'; typeDist[t] = (typeDist[t] || 0) + 1; });

  const baseline = await resolveBaseline(db, cp.id, 'daily_throughput', HARDCODED_BASELINE[cp.id] ?? 50);
  const changePct = baseline > 0 ? Math.round(((ships.length - baseline) / baseline) * 100) : 0;
  const severity = ships.length <= baseline * 0.5 ? 'CRITICAL'
    : ships.length <= baseline * 0.75 ? 'WARNING'
    : 'INFO';

  return { cp, ships: ships.length, typeDist, baseline, changePct, severity };
}

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

// 한 초크포인트의 캐릭터 보고 생성 + 저장
async function reportChokepoint(stat, db) {
  const { cp } = stat;
  const char = REGION_CHARACTERS[cp.id];
  const dir = stat.changePct > 5 ? 'UP' : stat.changePct < -5 ? 'DOWN' : 'STABLE';

  let result;
  try {
    result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        character: char
          ? { name: char.name, title: char.title, quote: char.quote, role: char.role, top_cargoes: char.topCargoes }
          : { name: `${cp.name} 관제`, title: '해상 관문', role: '' },
        chokepoint: cp.name,
        live: {
          current_ships: stat.ships,
          baseline_daily: stat.baseline,
          change_pct_vs_baseline: stat.changePct,
          vessel_type_dist: stat.typeDist,
        },
        expected_severity: stat.severity,
      }),
      maxTokens: 1400,
      model: 'claude-haiku-4-5',
    });
  } catch (err) {
    console.error(`[CHOKEPOINT_WATCHER] ${cp.id} claude error:`, err.message);
    return false;
  }

  const { error } = await db.from('agent_reports').insert({
    agent_id: 'CHOKEPOINT_WATCHER',
    severity: stat.severity,
    title: result.title,
    summary: result.summary,
    detail: result.detail,
    data_points: [
      { label: '현재 통과', current: stat.ships, baseline: stat.baseline, unit: '척', change_pct: stat.changePct, direction: dir },
    ],
    annotations: [result.ai_comment].filter(Boolean),
    related_mmsi: [],
    // location.chokepoint_id, raw_data.cp_id/change_pct는 프론트(마커·StatusBar 칩)가 소비 — 반드시 유지
    location: { lat: cp.centerLat, lng: cp.centerLng, zoom: 6, chokepoint_id: cp.id },
    raw_data: {
      cp_id: cp.id,
      cp_name: cp.name,
      ships: stat.ships,
      baseline: stat.baseline,
      change_pct: stat.changePct,
      character: char
        ? { name: char.name, title: char.title, image: char.image, symbolEmoji: char.symbolEmoji, flagEmoji: char.flagEmoji, region: cp.name }
        : null,
    },
  });
  if (error) {
    console.error(`[CHOKEPOINT_WATCHER] ${cp.id} insert error:`, error.message);
    return false;
  }
  console.log(`[CHOKEPOINT_WATCHER] ${cp.id} (${char?.name ?? '?'}) report saved:`, stat.severity);
  return true;
}

async function runChokepointWatcher() {
  console.log('[CHOKEPOINT_WATCHER] run at', new Date().toISOString());
  const db = getDb();

  // 1) 통계 수집
  const stats = await mapLimit(CHOKEPOINTS, 7, (cp) => collectStats(cp, db));

  // 2) 데이터 있는 곳만 (호르무즈 등 커버리지 공백 0척은 거짓 CRITICAL 방지 위해 skip)
  let targets = stats.filter(s => s.ships > 0);

  // 3) 재시작 중복 방지
  const since = new Date(Date.now() - REPORT_TTL_MS).toISOString();
  const { data: recent } = await db
    .from('agent_reports')
    .select('raw_data, created_at')
    .eq('agent_id', 'CHOKEPOINT_WATCHER')
    .gte('created_at', since);
  const recentIds = new Set((recent ?? []).map(r => r.raw_data?.cp_id).filter(Boolean));
  const skipped = targets.filter(s => recentIds.has(s.cp.id)).length;
  targets = targets.filter(s => !recentIds.has(s.cp.id));

  if (targets.length === 0) {
    console.log(`[CHOKEPOINT_WATCHER] 보고 대상 없음 (0척 또는 최근 보고 ${skipped}건)`);
    return;
  }

  // 4) 초크포인트별 캐릭터 보고
  const results = await mapLimit(targets, CLAUDE_CONCURRENCY, (s) => reportChokepoint(s, db));
  console.log(`[CHOKEPOINT_WATCHER] 완료 — ${results.filter(Boolean).length}/${targets.length} 저장`);
}

function startChokepointWatcher() {
  runChokepointWatcher();
  return setInterval(runChokepointWatcher, POLL_INTERVAL_MS);
}

module.exports = { runChokepointWatcher, startChokepointWatcher, CHOKEPOINTS, HARDCODED_BASELINE };
