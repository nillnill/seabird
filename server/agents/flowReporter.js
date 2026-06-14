const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');
const { PORTS } = require('./portAnalyst');

// FLOW REPORTER — traffic_snapshots 이력에서 항만별 원자재 유입 '강도' 추세를 산출.
// 유입 강도 = 입항(inbound) 선박의 추정 적재 톤수(스냅샷 순간값). 24h 평균을 직전 24h와 비교(DoD).
// ※ 절대 톤수는 추정치(클래스 평균 DWT × 만재 가정)이므로 '추세·증감'에 의미를 둔다.
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1시간 (전 에이전트 1시간 배치로 통일)

const PORT_NAME = Object.fromEntries(PORTS.map(p => [p.id, p.name]));

const SYSTEM_PROMPT = `You are FLOW REPORTER, a maritime trade-flow intelligence agent.
You receive computed estimates of inbound cargo "intensity" per port — average laden tonnage of vessels currently inbound,
broken down by commodity class (liquid bulk = crude/products via tankers, dry bulk = ore/coal/grain via bulkers,
containers via container ships), with day-over-day % change. Write a concise Korean briefing.

Respond ONLY with valid JSON. Language: Korean. 개조식 마크다운.
{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[원자재 유입 동향 제목, 최대 50자]",
  "summary": "핵심 요약 (최대 100자) — 가장 큰 증감 중심.",
  "detail": "## 🛢️ 원자재 유입 동향 (추정)\\n\\n| 품목 | 추정 유입강도 | 전일比 | 추세 |\\n|------|------|------|------|\\n| 원유·석유제품 | ~340천 DWT | +12% | 🔺 |\\n| 건화물(철광석·석탄·곡물) | ~210천 DWT | -4% | 🔻 |\\n| 컨테이너 | ~52천 TEU | +3% | ➡️ |\\n\\n## 🚢 항만별 주목\\n- 부산: 원유 입항 +N% ...\\n\\n## 💡 해석\\n- 증감 원인 추정(계절·지정학·운임 등). 추정 데이터임을 명시.",
  "data_points": [
    {"label": "원유·석유제품 유입", "current": 340, "baseline": 304, "unit": "천 DWT", "change_pct": 12, "direction": "UP"},
    {"label": "건화물 유입", "current": 210, "baseline": 219, "unit": "천 DWT", "change_pct": -4, "direction": "DOWN"}
  ]
}
data_points: change_pct·current·baseline은 숫자만. direction은 UP|DOWN|STABLE.
SEVERITY: CRITICAL = 핵심 품목 ±25% 급변, WARNING = ±10%, INFO = 안정.
반드시 '추정치'임을 detail에 명시. 분석을 거부하지 말 것.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const pct = (cur, base) => (base > 0 ? Math.round(((cur - base) / base) * 100) : null);
const dir = (p) => (p == null ? 'STABLE' : p > 3 ? 'UP' : p < -3 ? 'DOWN' : 'STABLE');

// traffic_snapshots에서 항만 유입 강도 24h(recent) vs 직전 24h(prior) 산출
async function computeFlow(db) {
  const since = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: rows, error } = await db
    .from('traffic_snapshots')
    .select('location_id, location_type, commodity_inflow, snapshot_at')
    .eq('location_type', 'port')
    .gte('snapshot_at', since)
    .order('snapshot_at', { ascending: true });

  if (error) return { ok: false, reason: error.message };
  if (!rows?.length) return { ok: false, reason: 'no_data' };

  const recentStart = Date.now() - 24 * 3600000;
  const priorStart = Date.now() - 48 * 3600000;
  const ports = {}; // id -> { recent:{l,d,c}, prior:{l,d,c} }

  rows.forEach(s => {
    const t = Date.parse(s.snapshot_at);
    const win = t >= recentStart ? 'recent' : (t >= priorStart ? 'prior' : null);
    if (!win) return;
    const ci = s.commodity_inflow || {};
    const p = (ports[s.location_id] ??= { recent: { l: [], d: [], c: [] }, prior: { l: [], d: [], c: [] } });
    p[win].l.push(ci.est_liquid_dwt || 0);
    p[win].d.push(ci.est_dry_bulk_dwt || 0);
    p[win].c.push(ci.est_container_teu || 0);
  });

  // 항만별 평균 + 전역 합산
  const perPort = [];
  const glob = { liquid: { r: 0, p: 0 }, dry: { r: 0, p: 0 }, teu: { r: 0, p: 0 } };
  for (const [id, w] of Object.entries(ports)) {
    const rL = mean(w.recent.l), pL = mean(w.prior.l);
    const rD = mean(w.recent.d), pD = mean(w.prior.d);
    const rC = mean(w.recent.c), pC = mean(w.prior.c);
    glob.liquid.r += rL; glob.liquid.p += pL;
    glob.dry.r += rD; glob.dry.p += pD;
    glob.teu.r += rC; glob.teu.p += pC;
    perPort.push({
      id, name: PORT_NAME[id] ?? id,
      liquid_dwt: Math.round(rL), liquid_chg: pct(rL, pL),
      dry_dwt: Math.round(rD), dry_chg: pct(rD, pD),
      teu: Math.round(rC), teu_chg: pct(rC, pC),
    });
  }

  // 천 단위로 정리
  const k = (v) => Math.round(v / 1000);
  const summary = {
    liquid: { current: k(glob.liquid.r), baseline: k(glob.liquid.p), change_pct: pct(glob.liquid.r, glob.liquid.p) },
    dry:    { current: k(glob.dry.r),    baseline: k(glob.dry.p),    change_pct: pct(glob.dry.r, glob.dry.p) },
    teu:    { current: k(glob.teu.r),    baseline: k(glob.teu.p),    change_pct: pct(glob.teu.r, glob.teu.p) },
  };

  // 항만별 주목(원유·건화물 변화 큰 순)
  const movers = perPort
    .filter(p => p.liquid_dwt > 0 || p.dry_dwt > 0)
    .sort((a, b) => (Math.abs(b.liquid_chg ?? 0) + Math.abs(b.dry_chg ?? 0)) - (Math.abs(a.liquid_chg ?? 0) + Math.abs(a.dry_chg ?? 0)))
    .slice(0, 6);

  return { ok: true, summary, movers, hasPrior: rows.some(s => Date.parse(s.snapshot_at) < recentStart) };
}

async function runFlowReporter() {
  console.log('[FLOW_REPORTER] run at', new Date().toISOString());
  const db = getDb();

  try {
    const flow = await computeFlow(db);
    if (!flow.ok) {
      console.warn(`[FLOW_REPORTER] skip — ${flow.reason}` + (flow.reason === 'no_data' ? ' (traffic_snapshots 누적 대기)' : ''));
      return;
    }

    const s = flow.summary;
    const data_points = [
      { label: '원유·석유제품 유입', current: s.liquid.current, baseline: s.liquid.baseline, unit: '천 DWT', change_pct: s.liquid.change_pct ?? 0, direction: dir(s.liquid.change_pct) },
      { label: '건화물 유입',        current: s.dry.current,    baseline: s.dry.baseline,    unit: '천 DWT', change_pct: s.dry.change_pct ?? 0,    direction: dir(s.dry.change_pct) },
      { label: '컨테이너 유입',      current: s.teu.current,    baseline: s.teu.baseline,    unit: '천 TEU', change_pct: s.teu.change_pct ?? 0,    direction: dir(s.teu.change_pct) },
    ];

    let result;
    try {
      result = await callClaude({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: JSON.stringify({
          analysis_time: new Date().toISOString(),
          has_prior_window: flow.hasPrior,
          global_inflow: s,
          notable_ports: flow.movers,
          note: '값은 입항 선박의 추정 적재 톤수(클래스 평균 DWT×만재). 추세 중심으로 해석.',
        }),
        maxTokens: 2000,
        model: 'claude-haiku-4-5',
      });
    } catch (e) {
      console.warn('[FLOW_REPORTER] Claude 실패 — 결정론 데이터로 폴백:', e.message);
      result = null;
    }

    const severity = 'INFO'; // severity 판단은 MASTER_AGENT 전담 — 사실(유입 추정·data_points)만 보고

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'FLOW_REPORTER',
      severity,
      title: (result?.title ?? '원자재 유입 동향 (추정)').slice(0, 60),
      summary: (result?.summary ?? `원유 ${s.liquid.current}천DWT·건화물 ${s.dry.current}천DWT·컨테이너 ${s.teu.current}천TEU (입항 추정)`).slice(0, 120),
      detail: result?.detail ?? '',
      data_points: Array.isArray(result?.data_points) ? result.data_points : data_points,
      annotations: [],
      related_mmsi: [],
      location: null,
      raw_data: { source: 'traffic_snapshots', summary: s, movers: flow.movers, has_prior: flow.hasPrior },
    });
    if (error) console.error('[FLOW_REPORTER] insert error:', error.message);
    else console.log('[FLOW_REPORTER] report saved:', severity);
  } catch (err) {
    console.error('[FLOW_REPORTER] error:', err.message);
  }
}

function startFlowReporter() {
  // 시작 직후 1회 + 주기 실행 (이력 없으면 자동 skip)
  setTimeout(runFlowReporter, 20000);
  return setInterval(runFlowReporter, POLL_INTERVAL_MS);
}

module.exports = { runFlowReporter, startFlowReporter };
