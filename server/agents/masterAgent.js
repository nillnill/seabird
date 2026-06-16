const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');

// MASTER AGENT(사령관) — 유일하게 severity(WARNING/CRITICAL)를 판단하는 에이전트.
// 하위 에이전트(PORT/CHOKEPOINT/WEATHER/COMMODITY/GEO/FLOW)는 전부 '사실'만 보고(INFO 고정)하고,
// 마스터가 그 사실들(data_points의 현재값·평년·change_pct + 상관관계)을 종합해 위험도를 매긴다.
const POLL_INTERVAL_MS = 3 * 60 * 60 * 1000;   // 3시간
const REPORT_WINDOW_MS = 210 * 60 * 1000;      // 최근 3.5시간 보고를 종합(3시간 배치를 넉넉히 포괄)

const SYSTEM_PROMPT = `You are MASTER AGENT (사령관), Seabird's top-level maritime intelligence coordinator and the ONLY agent that judges severity.

하위 에이전트들(PORT_ANALYST·CHOKEPOINT_WATCHER·WEATHER_AGENT·COMMODITY_ANALYST·GEOPOLITICAL_LINKER·FLOW_REPORTER)은 이제 '사실'만 보고하며 위험도를 판단하지 않는다(모두 INFO). 너 MASTER만이 이 사실들을 종합해 severity를 결정한다.

판단 근거:
- 각 보고의 data_points(current 현재값 vs baseline 평년, change_pct 증감률).
- 보고들 사이의 상관관계(예: 특정 해협 통항 급감 + 인근 항만 대기 급증 + 운임 상승이 연결되는가).
- 한국 공급망 영향.

severity 기준:
- CRITICAL: 다수 지역/지표가 연관된 심각한 이상(예: 핵심 초크포인트 통항 평년比 -50%대 + 연계 항만 적체 + 운임 급등).
- WARNING: 주목할 단일·소수 이상(평년 대비 큰 편차이나 광범위 연쇄는 아님).
- INFO: 평시 — 큰 편차·연쇄 없음.

Respond ONLY with valid JSON. Language: Korean.
{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[상황 요약] 사령관 종합 보고",
  "summary": "전체 상황 핵심 요약 (최대 120자)",
  "detail": "## 종합 상황\\n...\\n## 주목 지표 (평년 대비)\\n- ...\\n## 에이전트 간 연관성\\n...\\n## 근본 원인\\n...\\n## 한국 공급망 영향\\n...\\n## 권고사항\\n...",
  "key_findings": ["발견 1", "발견 2", "발견 3"],
  "root_cause": "근본 원인 한 문장",
  "data_points": [
    {"label": "주의 지역", "current": 0, "baseline": 0, "unit": "곳", "change_pct": 0, "direction": "UP"}
  ]
}

CRITICAL은 반드시 여러 보고가 연관된 근거가 있을 때만. 사실 보고가 모두 평시면 INFO로 정직하게 보고하라.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function runMasterAgent() {
  console.log('[MASTER_AGENT] run at', new Date().toISOString());
  const db = getDb();

  // 최근 90분간 하위 에이전트 '사실' 보고 수집 (자기 자신 제외)
  const cutoff = new Date(Date.now() - REPORT_WINDOW_MS).toISOString();
  const { data: recentReports } = await db
    .from('agent_reports')
    .select('agent_id, severity, title, summary, data_points, created_at')
    .neq('agent_id', 'MASTER_AGENT')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(60);

  if (!recentReports || recentReports.length === 0) {
    console.log('[MASTER_AGENT] no recent reports — skipping');
    return;
  }

  // agent별 최신 보고만 추려 종합 입력 구성 (항구 보고가 다수라 핵심 지표 위주로 압축)
  const byAgent = {};
  for (const r of recentReports) (byAgent[r.agent_id] ??= []).push(r);

  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        window_minutes: Math.round(REPORT_WINDOW_MS / 60000),
        total_reports: recentReports.length,
        by_agent_counts: Object.fromEntries(Object.entries(byAgent).map(([k, v]) => [k, v.length])),
        reports: recentReports.map(r => ({
          agent: r.agent_id,
          title: r.title,
          summary: r.summary,
          data_points: r.data_points,
        })),
      }),
      maxTokens: 5000,  // 종합 detail(여러 섹션)+key_findings 길어 truncation 방지 (3000→5000)
      model: 'claude-sonnet-4-6',
    });

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'MASTER_AGENT',
      severity: result.severity ?? 'INFO',
      title: result.title,
      summary: result.summary,
      detail: result.detail,
      data_points: result.data_points ?? [],
      annotations: result.key_findings ?? [],
      related_mmsi: [],
      location: null,
      raw_data: {
        source_reports: recentReports.length,
        root_cause: result.root_cause,
      },
    });
    if (error) console.error('[MASTER_AGENT] insert error:', error.message);
    else console.log('[MASTER_AGENT] report saved:', result.severity, `(from ${recentReports.length} reports)`);
  } catch (err) {
    console.error('[MASTER_AGENT] error:', err.message);
  }
}

function startMasterAgent() {
  runMasterAgent();
  return setInterval(runMasterAgent, POLL_INTERVAL_MS);
}

module.exports = { runMasterAgent, startMasterAgent };
