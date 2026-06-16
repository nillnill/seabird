const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { callClaude } = require('./claudeClient');

const POLL_INTERVAL_MS = 3 * 60 * 60 * 1000;  // 3시간 (전 에이전트 3시간 배치로 통일)
const NEWS_KEYWORDS = 'strait OR canal OR shipping OR sanctions OR port OR tanker OR blockade OR attack';

const SYSTEM_PROMPT = `You are GEOPOLITICAL LINKER, a maritime geopolitical intelligence agent.

CRITICAL: Return RAW JSON ONLY. No markdown fences, no explanation, no preamble. Start your response with { and end with }.

Language: Korean. 개조식 마크다운 형식 필수.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[지역/이슈] 지정학적 리스크 → 해운 연관",
  "summary": "뉴스 이벤트 + 해운 데이터 상관관계 요약 (최대 80자)",
  "detail": "## 📰 주요 뉴스\\n- **[뉴스 제목]** — 출처 · 시간\\n- **[뉴스 제목]** — 출처 · 시간\\n\\n## 🔗 해운 데이터 상관관계\\n- 수치 변화 ↔ 뉴스 이벤트 연관성\\n\\n## 📍 영향 경로 및 리스크\\n- 경로명: **HIGH|MEDIUM|LOW**\\n\\n## 🇰🇷 권고\\n- 한국 공급망 대응 권고사항",
  "shipping_impact": {
    "affected_routes": ["경로명"],
    "korea_supply_chain_risk": "HIGH|MEDIUM|LOW"
  },
  "data_points": [
    {"label": "관련 뉴스", "current": 0, "baseline": 0, "unit": "건", "change_pct": 0, "direction": "UP"}
  ]
}

CRITICAL rule: Only correlate news to shipping data that actually changed. Do not invent correlations.
Always assess Korea-specific supply chain impact.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function fetchWithPerplexity() {
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
          content: 'You are a maritime intelligence researcher. Find the latest news about global shipping disruptions, port congestion, maritime sanctions, and geopolitical events affecting sea trade.',
        },
        {
          role: 'user',
          content: 'Find the most important maritime shipping news from the past 2 hours. Focus on: Suez Canal, Strait of Hormuz, Malacca Strait, Panama Canal, Red Sea, shipping sanctions, port blockades, tanker attacks. List up to 5 key news items with source, headline, and brief summary.',
        },
      ],
      search_recency_filter: 'hour',
      return_citations: true,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity API error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function fetchWithNewsAPI(fromISO) {
  const params = new URLSearchParams({
    q: NEWS_KEYWORDS,
    language: 'en',
    sortBy: 'publishedAt',
    from: fromISO,
    apiKey: process.env.NEWSAPI_KEY,
  });
  const res = await fetch(`https://newsapi.org/v2/everything?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.articles ?? [];
}

async function runGeopoliticalLinker() {
  console.log('[GEOPOLITICAL_LINKER] run at', new Date().toISOString());
  const db = getDb();

  const from15min = new Date(Date.now() - POLL_INTERVAL_MS).toISOString();
  let newsContext = '';
  let articleCount = 0;

  if (process.env.PERPLEXITY_API_KEY) {
    try {
      newsContext = await fetchWithPerplexity();
      // Claude 입력 과부하 방지: 최대 800자로 제한
      if (newsContext.length > 800) newsContext = newsContext.slice(0, 800) + '\n...';
      articleCount = (newsContext.match(/\n-/g) || []).length || 1;
      console.log('[GEOPOLITICAL_LINKER] using Perplexity sonar');
    } catch (err) {
      console.warn('[GEOPOLITICAL_LINKER] Perplexity failed, falling back to NewsAPI:', err.message);
    }
  }

  if (!newsContext) {
    const articles = await fetchWithNewsAPI(from15min).catch(() => []);
    if (articles.length === 0) {
      console.log('[GEOPOLITICAL_LINKER] no news articles — skipping');
      return;
    }
    articleCount = articles.length;
    newsContext = articles.slice(0, 5).map(a =>
      `- ${a.title} (${a.source?.name ?? 'Unknown'}, ${a.publishedAt?.slice(0, 16)}): ${a.description?.substring(0, 150) ?? ''}`
    ).join('\n');
  }

  // 최근 초크포인트/항만 보고 컨텍스트
  const { data: recentAlerts } = await db
    .from('agent_reports')
    .select('agent_id, severity, summary')
    .in('agent_id', ['CHOKEPOINT_WATCHER', 'PORT_ANALYST'])
    .gte('created_at', from15min);

  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        news_context: newsContext,
        recent_maritime_alerts: (recentAlerts ?? []).slice(0, 3),
        article_count: articleCount,
        analysis_window: '15분',
      }),
      maxTokens: 2000,
      model: 'claude-sonnet-4-6',
    });

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'GEOPOLITICAL_LINKER',
      severity: 'INFO', // severity 판단은 MASTER_AGENT 전담 — 사실만 보고

      title: result.title,
      summary: result.summary,
      detail: result.detail,
      data_points: result.data_points ?? [],
      annotations: [result.shipping_impact?.korea_supply_chain_risk
        ? `한국 공급망 리스크: ${result.shipping_impact.korea_supply_chain_risk}`
        : null].filter(Boolean),
      related_mmsi: [],
      location: null,
      raw_data: { articles_count: articleCount, source: process.env.PERPLEXITY_API_KEY ? 'perplexity' : 'newsapi' },
    });
    if (error) console.error('[GEOPOLITICAL_LINKER] insert error:', error.message);
    else console.log('[GEOPOLITICAL_LINKER] report saved:', result.severity);
  } catch (err) {
    console.error('[GEOPOLITICAL_LINKER] error:', err.message);
  }
}

function startGeopoliticalLinker() {
  runGeopoliticalLinker();
  return setInterval(runGeopoliticalLinker, POLL_INTERVAL_MS);
}

module.exports = { runGeopoliticalLinker, startGeopoliticalLinker };
