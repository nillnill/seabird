const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');

const POLL_INTERVAL_MS = 5 * 60 * 1000;

const DEDUP_WINDOWS = {
  CRITICAL:  5 * 60 * 1000,
  WARNING:  15 * 60 * 1000,
  INFO:     30 * 60 * 1000,
};

const HARDCODED_BASELINE = {
  suez: 58, malacca: 247, hormuz: 89, panama: 35,
  dover: 312, korea_strait: 156, bab_el_mandeb: 67,
};

const CHOKEPOINTS = [
  { id: 'suez',          name: '수에즈 운하',    emoji: '🇪🇬', bbox: [[29.9, 31.8], [31.3, 33.1]],  centerLat: 30.6, centerLng: 32.5 },
  { id: 'malacca',       name: '말라카 해협',    emoji: '🇸🇬', bbox: [[1.0, 99.5],  [6.5, 104.5]], centerLat: 2.5,  centerLng: 103.5 },
  { id: 'hormuz',        name: '호르무즈 해협',  emoji: '🇮🇷', bbox: [[25.8, 55.5], [27.0, 57.5]], centerLat: 26.5, centerLng: 56.5 },
  { id: 'panama',        name: '파나마 운하',    emoji: '🇵🇦', bbox: [[8.8, -80.2], [9.5, -79.5]], centerLat: 9.1,  centerLng: -79.9 },
  { id: 'dover',         name: '영불 해협',      emoji: '🇬🇧', bbox: [[50.5, -2.0], [51.5, 2.5]],  centerLat: 51.0, centerLng: 1.5 },
  { id: 'korea_strait',  name: '대한해협',       emoji: '🇰🇷', bbox: [[33.5, 128.5],[35.0, 130.5]],centerLat: 34.2, centerLng: 129.5 },
  { id: 'bab_el_mandeb', name: '바브엘만데브',   emoji: '🇾🇪', bbox: [[11.5, 43.0], [13.0, 44.5]], centerLat: 12.5, centerLng: 43.5 },
];

const SYSTEM_PROMPT_CP = `You are CHOKEPOINT WATCHER, a maritime intelligence agent.

Respond ONLY with valid JSON. Language: Korean. 개조식 마크다운 형식 필수.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[초크포인트명] [상태 한 줄]",
  "summary": "핵심 요약 최대 80자",
  "detail": "## [이모지] [초크포인트명] — [상태]\\n\\n- **현재 통과**: N척 (평년 X척/일 대비 **±Y%**)\\n- **선종**: 컨테이너 N · 탱커 N · 기타 N\\n\\n## 📌 과거 유사 사례\\n- 관련 사례 (없으면 '특이 이력 없음')\\n\\n## 🇰🇷 공급망 영향\\n- 한국 관련 영향 및 권고",
  "ai_comment": "분석 코멘트 최대 200자",
  "data_points": [
    {"label": "현재 통과", "current": 0, "baseline": 0, "unit": "척", "change_pct": 0, "direction": "DOWN"}
  ]
}

SEVERITY: CRITICAL = 통과량 -50% 이상, WARNING = -25% 이상, INFO = 정상.
INFO일 때 detail의 과거 사례/공급망 섹션은 간략하게 '현재 정상 운영 중' 형식으로 작성.
데이터가 적어도 반드시 분석 의견 제공.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 인메모리 dedup 캐시 (서버 재시작 시 초기화 — 의도적)
const _dedupCache = {};  // { cp_id: { severity, ts } }

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

async function processChokepoint(cp, db) {
  const ships = await queryShipsInBbox(cp.bbox);

  // 선종 분포
  const typeDist = {};
  ships.forEach(s => { const t = s.vessel_type || 'Other'; typeDist[t] = (typeDist[t] || 0) + 1; });

  const { data: baselineRow } = await db
    .from('baselines')
    .select('avg_90d')
    .eq('location_id', cp.id)
    .eq('metric', 'daily_throughput')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  const baseline = baselineRow?.avg_90d ?? HARDCODED_BASELINE[cp.id] ?? 50;
  const changePct = baseline > 0 ? Math.round(((ships.length - baseline) / baseline) * 100) : 0;

  const severity = ships.length <= baseline * 0.5 ? 'CRITICAL'
    : ships.length <= baseline * 0.75 ? 'WARNING'
    : 'INFO';

  // 인메모리 dedup 확인
  const cached = _dedupCache[cp.id];
  if (cached && cached.severity === severity) {
    const age = Date.now() - cached.ts;
    const window = DEDUP_WINDOWS[severity] ?? DEDUP_WINDOWS.INFO;
    if (age < window) {
      console.log(`[CHOKEPOINT_WATCHER] ${cp.id} dedup skip — ${severity} (${Math.round(age / 60000)}min/${Math.round(window / 60000)}min)`);
      return;
    }
  }

  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT_CP,
      userMessage: JSON.stringify({
        chokepoint: { id: cp.id, name: cp.name, emoji: cp.emoji },
        current_ships: ships.length,
        vessel_type_dist: typeDist,
        baseline_daily: baseline,
        change_pct: changePct,
        severity,
      }),
      maxTokens: 1200,
      model: 'claude-haiku-4-5',
    });

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'CHOKEPOINT_WATCHER',
      severity: result.severity ?? severity,
      title: result.title,
      summary: result.summary,
      detail: result.detail,
      data_points: result.data_points ?? [],
      annotations: [result.ai_comment].filter(Boolean),
      related_mmsi: [],
      location: { lat: cp.centerLat, lng: cp.centerLng, zoom: 6, chokepoint_id: cp.id },
      raw_data: { cp_id: cp.id, cp_name: cp.name, ships: ships.length, baseline, change_pct: changePct },
    });
    if (error) {
      console.error(`[CHOKEPOINT_WATCHER] ${cp.id} insert error:`, error.message);
    } else {
      const finalSeverity = result.severity ?? severity;
      console.log(`[CHOKEPOINT_WATCHER] ${cp.id} report saved:`, finalSeverity);
      _dedupCache[cp.id] = { severity: finalSeverity, ts: Date.now() };
    }
  } catch (err) {
    console.error(`[CHOKEPOINT_WATCHER] ${cp.id} error:`, err.message);
  }
}

async function runChokepointWatcher() {
  console.log('[CHOKEPOINT_WATCHER] run at', new Date().toISOString());
  const db = getDb();

  // 순차 처리 (rate limit 방지, dedup은 인메모리 캐시 사용)
  for (const cp of CHOKEPOINTS) {
    await processChokepoint(cp, db);
  }
}

function startChokepointWatcher() {
  runChokepointWatcher();
  return setInterval(runChokepointWatcher, POLL_INTERVAL_MS);
}

module.exports = { runChokepointWatcher, startChokepointWatcher, CHOKEPOINTS };
