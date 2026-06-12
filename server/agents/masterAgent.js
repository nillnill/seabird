const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');
const { runPortAnalyst } = require('./portAnalyst');
const { runChokepointWatcher } = require('./chokepointWatcher');
const { runGeopoliticalLinker } = require('./geopoliticalLinker');

const POLL_INTERVAL_MS = 10 * 60 * 1000;
const SKIP_ROUTINE_MS = 30 * 60 * 1000;

const SYSTEM_PROMPT = `You are MASTER AGENT (사령관), Seabird's top-level maritime intelligence coordinator.

You receive reports from PORT_ANALYST, CHOKEPOINT_WATCHER, and GEOPOLITICAL_LINKER agents.
Synthesize them into one coherent situational picture. Find correlations between reports.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[상황 요약] 사령관 종합 보고",
  "summary": "전체 상황 핵심 요약 (최대 120자)",
  "detail": "## 종합 상황\\n...\\n## 에이전트 간 연관성\\n...\\n## 근본 원인\\n...\\n## 한국 공급망 영향\\n...\\n## 권고사항\\n...",
  "key_findings": ["발견 1", "발견 2", "발견 3"],
  "root_cause": "근본 원인 한 문장",
  "data_points": [
    {"label": "활성 경보", "current": 0, "baseline": 0, "unit": "건", "change_pct": 0, "direction": "UP"},
    {"label": "영향 항만", "current": 0, "baseline": 0, "unit": "개", "change_pct": 0, "direction": "UP"}
  ]
}

CRITICAL: Only escalate when multiple agents report correlated issues.
INFO: Routine status — no significant issues detected.
Always assess Korea supply chain impact specifically.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function runMasterAgent() {
  console.log('[MASTER_AGENT] run at', new Date().toISOString());
  const db = getDb();

  const recentCutoff = new Date(Date.now() - POLL_INTERVAL_MS).toISOString();
  const { data: recentReports } = await db
    .from('agent_reports')
    .select('agent_id, severity, title, summary, data_points, created_at')
    .neq('agent_id', 'MASTER_AGENT')
    .gte('created_at', recentCutoff)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!recentReports || recentReports.length === 0) {
    console.log('[MASTER_AGENT] no recent reports — skipping');
    return;
  }

  const urgentReports = recentReports.filter(r => ['WARNING', 'CRITICAL'].includes(r.severity));
  const hasUrgent = urgentReports.length > 0;

  if (!hasUrgent) {
    const { data: lastMaster } = await db
      .from('agent_reports')
      .select('created_at')
      .eq('agent_id', 'MASTER_AGENT')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (lastMaster && Date.now() - new Date(lastMaster.created_at).getTime() < SKIP_ROUTINE_MS) {
      console.log('[MASTER_AGENT] skipped — routine, recent report exists');
      return;
    }
  }

  // 긴급 상황 시 관련 에이전트 재실행해 최신 데이터 수집
  if (hasUrgent) {
    const agentIds = [...new Set(urgentReports.map(r => r.agent_id))];
    console.log('[MASTER_AGENT] re-running agents for fresh data:', agentIds);
    await Promise.allSettled(agentIds.map(id => {
      if (id === 'PORT_ANALYST') return runPortAnalyst();
      if (id === 'CHOKEPOINT_WATCHER') return runChokepointWatcher();
      if (id === 'GEOPOLITICAL_LINKER') return runGeopoliticalLinker();
      return Promise.resolve();
    }));
  }

  const warningCount = urgentReports.filter(r => r.severity === 'WARNING').length;
  const criticalCount = urgentReports.filter(r => r.severity === 'CRITICAL').length;

  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        total_reports: recentReports.length,
        critical_count: criticalCount,
        warning_count: warningCount,
        reports: recentReports.map(r => ({
          agent: r.agent_id,
          severity: r.severity,
          title: r.title,
          summary: r.summary,
          data_points: r.data_points,
        })),
      }),
      maxTokens: 1500,
      model: 'claude-sonnet-4-6',
    });

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'MASTER_AGENT',
      severity: result.severity,
      title: result.title,
      summary: result.summary,
      detail: result.detail,
      data_points: result.data_points ?? [],
      annotations: result.key_findings ?? [],
      related_mmsi: [],
      location: null,
      raw_data: {
        source_reports: recentReports.length,
        urgent: urgentReports.length,
        root_cause: result.root_cause,
      },
    });
    if (error) console.error('[MASTER_AGENT] insert error:', error.message);
    else console.log('[MASTER_AGENT] report saved:', result.severity);
  } catch (err) {
    console.error('[MASTER_AGENT] error:', err.message);
  }
}

function startMasterAgent() {
  runMasterAgent();
  return setInterval(runMasterAgent, POLL_INTERVAL_MS);
}

module.exports = { runMasterAgent, startMasterAgent };
