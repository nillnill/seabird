const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');

const POLL_INTERVAL_MS = 60 * 60 * 1000;  // 60분 (가격은 천천히 변동)

const SYSTEM_PROMPT = `You are COMMODITY ANALYST, a maritime trade & freight market intelligence agent.

You are given the latest web-researched price text. Extract structured data and write a Korean briefing.
Respond ONLY with valid JSON. Language: Korean. 개조식 마크다운.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[원자재·운임 시황 제목, 최대 50자]",
  "summary": "핵심 요약 (최대 100자) — 가장 큰 변동 중심.",
  "detail": "## 📈 원자재·운임 시황\\n\\n| 품목 | 현재가 | 변동 | 추세 |\\n|------|--------|------|------|\\n| WTI 원유 | $72.3/bbl | -1.2% | 🔻 |\\n| 천연가스(HH) | $2.8/MMBtu | +3.1% | 🔺 |\\n| 철광석 | $105/t | +0.5% | ➡️ |\\n| BDI(건화물운임) | 1,820 | +4% | 🔺 |\\n\\n## 🚢 해운 시사점\\n- 운임·물동량 영향 해석\\n\\n## 🇰🇷 한국 영향\\n- 수입원가·공급망 영향",
  "data_points": [
    {"label": "WTI 원유", "current": 72.3, "baseline": 73.2, "unit": "$/bbl", "change_pct": -1.2, "direction": "DOWN"},
    {"label": "BDI", "current": 1820, "baseline": 1750, "unit": "", "change_pct": 4.0, "direction": "UP"}
  ]
}

data_points 규칙: change_pct는 숫자, direction은 UP|DOWN|STABLE. current/baseline은 숫자만(단위 제외).
SEVERITY: CRITICAL = 핵심 품목 ±10% 이상 급변 또는 운임 급등, WARNING = ±5% 이상, INFO = 안정.
수치가 불명확하면 합리적으로 추정하되 추정임을 detail에 명시. 절대 분석을 거부하지 말 것.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// Perplexity로 최신 원자재·운임 가격 검색 (영문)
async function fetchPricesWithPerplexity() {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a commodity and shipping market data researcher. Report the latest prices with exact numbers, units, and the recent percent change.',
        },
        {
          role: 'user',
          content: 'Give the most recent prices and daily/weekly % change for: Brent crude, WTI crude (USD/bbl); natural gas Henry Hub and TTF; iron ore 62% Fe (USD/ton); thermal coal (Newcastle); wheat, corn, soybeans (CBOT); Baltic Dry Index (BDI) and Capesize/Panamax freight rates; and Capesize bulk carrier newbuilding & secondhand prices. Be concise: one line per item with number, unit, and % change.',
        },
      ],
      search_recency_filter: 'day',
      return_citations: true,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function runCommodityAnalyst() {
  console.log('[COMMODITY_ANALYST] run at', new Date().toISOString());
  const db = getDb();

  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('[COMMODITY_ANALYST] no PERPLEXITY_API_KEY — skip');
    return;
  }

  try {
    const priceText = await fetchPricesWithPerplexity();
    if (!priceText) { console.warn('[COMMODITY_ANALYST] empty Perplexity result — skip'); return; }

    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        analysis_time: new Date().toISOString(),
        price_research: priceText,
      }),
      maxTokens: 2000,
      model: 'claude-haiku-4-5',
    });

    const severity = 'INFO'; // severity 판단은 MASTER_AGENT 전담 — 사실(가격·data_points)만 보고

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'COMMODITY_ANALYST',
      severity,
      title: (result.title ?? '원자재·운임 시황').slice(0, 60),
      summary: (result.summary ?? '주요 원자재·운임 가격 업데이트').slice(0, 120),
      detail: result.detail ?? '',
      data_points: Array.isArray(result.data_points) ? result.data_points : [],
      annotations: [],
      related_mmsi: [],
      location: null,
      raw_data: { source: 'perplexity', excerpt: priceText.slice(0, 600) },
    });
    if (error) console.error('[COMMODITY_ANALYST] insert error:', error.message);
    else console.log('[COMMODITY_ANALYST] report saved:', severity);
  } catch (err) {
    console.error('[COMMODITY_ANALYST] error:', err.message);
  }
}

function startCommodityAnalyst() {
  runCommodityAnalyst();
  return setInterval(runCommodityAnalyst, POLL_INTERVAL_MS);
}

module.exports = { runCommodityAnalyst, startCommodityAnalyst };
