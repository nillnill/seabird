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

// 평년(baseline) 산출 정책: 충분한 실측 이력이 쌓이기 전엔 하드코딩 기준값을 쓰고,
// 그 이후부터 동적 평년(박스 내 선박 수의 평균)으로 전환한다.
// 30분 간격 스냅샷 기준 — 48표본 ≈ 24h. 0 스냅샷(데이터 미수집 구간)은 평균에서 제외.
const MIN_BASELINE_SAMPLES = 48;
const MIN_BASELINE_SPAN_MS = 24 * 3600000;

async function resolveBaseline(db, cpId) {
  const hardcoded = HARDCODED_BASELINE[cpId] ?? 50;
  try {
    const cutoff90 = new Date(Date.now() - 90 * 24 * 3600000).toISOString();
    const { data: rows } = await db
      .from('baselines')
      .select('current_value, snapshot_at')
      .eq('location_id', cpId)
      .eq('metric', 'daily_throughput')
      .gte('snapshot_at', cutoff90)
      .order('snapshot_at', { ascending: true });

    // 0 = 수집 공백(예: nav_status 마이그레이션 이전, AIS 단절)으로 보고 제외
    const samples = (rows ?? [])
      .map(r => ({ v: parseFloat(r.current_value), t: Date.parse(r.snapshot_at) }))
      .filter(s => s.v > 0 && Number.isFinite(s.t));

    if (samples.length < MIN_BASELINE_SAMPLES) return hardcoded;
    const span = samples[samples.length - 1].t - samples[0].t;
    if (span < MIN_BASELINE_SPAN_MS) return hardcoded;

    const avg = samples.reduce((s, x) => s + x.v, 0) / samples.length;
    return avg > 0 ? Math.round(avg * 10) / 10 : hardcoded;
  } catch {
    return hardcoded;
  }
}

const CHOKEPOINTS = [
  { id: 'suez',          name: '수에즈 운하',    emoji: '🇪🇬', bbox: [[29.9, 31.8], [31.3, 33.1]],  centerLat: 30.6, centerLng: 32.5 },
  { id: 'malacca',       name: '말라카 해협',    emoji: '🇸🇬', bbox: [[1.0, 99.5],  [6.5, 104.5]], centerLat: 2.5,  centerLng: 103.5 },
  { id: 'hormuz',        name: '호르무즈 해협',  emoji: '🇮🇷', bbox: [[25.8, 55.5], [27.0, 57.5]], centerLat: 26.5, centerLng: 56.5 },
  { id: 'panama',        name: '파나마 운하',    emoji: '🇵🇦', bbox: [[8.8, -80.2], [9.5, -79.5]], centerLat: 9.1,  centerLng: -79.9 },
  { id: 'dover',         name: '영불 해협',      emoji: '🇬🇧', bbox: [[50.5, -2.0], [51.5, 2.5]],  centerLat: 51.0, centerLng: 1.5 },
  { id: 'korea_strait',  name: '대한해협',       emoji: '🇰🇷', bbox: [[33.5, 128.5],[35.0, 130.5]],centerLat: 34.2, centerLng: 129.5 },
  { id: 'bab_el_mandeb', name: '바브엘만데브',   emoji: '🇾🇪', bbox: [[11.5, 43.0], [13.0, 44.5]], centerLat: 12.5, centerLng: 43.5 },
];

// 7개 초크포인트를 한 번의 호출로 묶어서 분석 — reports 배열로 응답 (입력 id별 1건)
const SYSTEM_PROMPT_CP = `You are CHOKEPOINT WATCHER, a maritime intelligence agent.

You receive an ARRAY of chokepoints with current traffic statistics. Analyze EACH one and return one report per chokepoint.

Respond ONLY with valid JSON. Language: Korean. 개조식 마크다운 형식 필수.

{
  "reports": [
    {
      "id": "입력 chokepoint의 id를 그대로 복사",
      "severity": "INFO|WARNING|CRITICAL",
      "title": "[초크포인트명] [상태 한 줄]",
      "summary": "핵심 요약 최대 80자",
      "detail": "## [이모지] [초크포인트명] — [상태]\\n\\n- **현재 통과**: N척 (평년 X척/일 대비 **±Y%**)\\n- **선종**: 컨테이너 N · 탱커 N · 기타 N\\n\\n## 📌 과거 유사 사례\\n- 관련 사례 (없으면 '특이 이력 없음')\\n\\n## 🇰🇷 공급망 영향\\n- 한국 관련 영향 및 권고",
      "ai_comment": "분석 코멘트 최대 200자",
      "data_points": [
        {"label": "현재 통과", "current": 0, "baseline": 0, "unit": "척", "change_pct": 0, "direction": "DOWN"}
      ]
    }
  ]
}

reports 배열은 입력 chokepoints와 동일한 개수로, 각 항목에 입력 id를 반드시 포함하라.
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

// 초크포인트 통계 수집 (결정적 — Claude 미사용)
async function collectStats(cp, db) {
  const ships = await queryShipsInBbox(cp.bbox);

  const typeDist = {};
  ships.forEach(s => { const t = s.vessel_type || 'Other'; typeDist[t] = (typeDist[t] || 0) + 1; });

  const baseline = await resolveBaseline(db, cp.id);
  const changePct = baseline > 0 ? Math.round(((ships.length - baseline) / baseline) * 100) : 0;
  const severity = ships.length <= baseline * 0.5 ? 'CRITICAL'
    : ships.length <= baseline * 0.75 ? 'WARNING'
    : 'INFO';

  return { cp, ships: ships.length, typeDist, baseline, changePct, severity };
}

function isDeduped(stat) {
  const cached = _dedupCache[stat.cp.id];
  if (cached && cached.severity === stat.severity) {
    const age = Date.now() - cached.ts;
    const window = DEDUP_WINDOWS[stat.severity] ?? DEDUP_WINDOWS.INFO;
    if (age < window) {
      console.log(`[CHOKEPOINT_WATCHER] ${stat.cp.id} dedup skip — ${stat.severity} (${Math.round(age / 60000)}min/${Math.round(window / 60000)}min)`);
      return true;
    }
  }
  return false;
}

async function runChokepointWatcher() {
  console.log('[CHOKEPOINT_WATCHER] run at', new Date().toISOString());
  const db = getDb();

  // 1) 모든 초크포인트 통계 수집 (결정적 계산)
  const stats = [];
  for (const cp of CHOKEPOINTS) {
    stats.push(await collectStats(cp, db));
  }

  // 2) dedup 통과한 초크포인트만 분석 대상으로 (변화 없으면 제외)
  const toAnalyze = stats.filter(s => !isDeduped(s));
  if (toAnalyze.length === 0) {
    console.log('[CHOKEPOINT_WATCHER] 전부 dedup — Claude 호출 생략');
    return;
  }

  // 3) 단일 Claude 호출로 대상 초크포인트 묶음 분석 (7회 → 1회)
  let reportsById = {};
  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT_CP,
      userMessage: JSON.stringify({
        chokepoints: toAnalyze.map(s => ({
          id: s.cp.id, name: s.cp.name, emoji: s.cp.emoji,
          current_ships: s.ships,
          vessel_type_dist: s.typeDist,
          baseline_daily: s.baseline,
          change_pct: s.changePct,
          severity: s.severity,
        })),
      }),
      maxTokens: 4000,  // 최대 7개 보고를 한 응답에 담음
      model: 'claude-haiku-4-5',
    });
    for (const r of result.reports ?? []) {
      if (r.id) reportsById[r.id] = r;
    }
  } catch (err) {
    console.error('[CHOKEPOINT_WATCHER] claude error:', err.message);
    return;  // 분석 실패 시 이번 사이클 건너뜀
  }

  // 4) 초크포인트별 보고 행 저장 (프론트 마커가 per-chokepoint 행을 소비하므로 유지)
  for (const s of toAnalyze) {
    const r = reportsById[s.cp.id];
    if (!r) {
      console.warn(`[CHOKEPOINT_WATCHER] ${s.cp.id} — Claude 응답 누락, 스킵`);
      continue;
    }
    const finalSeverity = r.severity ?? s.severity;
    const { error } = await db.from('agent_reports').insert({
      agent_id: 'CHOKEPOINT_WATCHER',
      severity: finalSeverity,
      title: r.title,
      summary: r.summary,
      detail: r.detail,
      data_points: r.data_points ?? [],
      annotations: [r.ai_comment].filter(Boolean),
      related_mmsi: [],
      location: { lat: s.cp.centerLat, lng: s.cp.centerLng, zoom: 6, chokepoint_id: s.cp.id },
      raw_data: { cp_id: s.cp.id, cp_name: s.cp.name, ships: s.ships, baseline: s.baseline, change_pct: s.changePct },
    });
    if (error) {
      console.error(`[CHOKEPOINT_WATCHER] ${s.cp.id} insert error:`, error.message);
    } else {
      console.log(`[CHOKEPOINT_WATCHER] ${s.cp.id} report saved:`, finalSeverity);
      _dedupCache[s.cp.id] = { severity: finalSeverity, ts: Date.now() };
    }
  }
}

function startChokepointWatcher() {
  runChokepointWatcher();
  return setInterval(runChokepointWatcher, POLL_INTERVAL_MS);
}

module.exports = { runChokepointWatcher, startChokepointWatcher, CHOKEPOINTS, resolveBaseline };
