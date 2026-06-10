import { supabase } from '../utils/supabaseClient.js';
import { callClaude } from '../utils/claudeClient.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const NEWS_KEYWORDS = 'strait OR canal OR shipping OR sanctions OR port OR tanker OR blockade OR attack';

const SYSTEM_PROMPT = `You are GEOPOLITICAL LINKER, a maritime geopolitical intelligence agent.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[지역/이슈] 지정학적 리스크 → 해운 연관",
  "summary": "뉴스 이벤트 + 해운 데이터 상관관계 요약 (최대 80자)",
  "news_items": [
    {"headline": "기사 제목", "source": "출처", "published_at": "ISO8601", "relevance": "HIGH|MEDIUM|LOW"}
  ],
  "shipping_impact": {
    "affected_routes": ["수에즈 북행"],
    "data_correlation": "데이터 변화 수치",
    "korea_supply_chain_risk": "HIGH|MEDIUM|LOW"
  },
  "historical_pattern": "유사 과거 사례 (최대 150자)",
  "recommendation": "모니터링 권고사항 (최대 100자)",
  "data_points": [
    {"label": "관련 뉴스", "current": 0, "baseline": 0, "unit": "건", "change_pct": 0, "direction": "UP"}
  ]
}

CRITICAL rule: Only correlate news to shipping data that actually changed. Do not invent correlations.
Always assess Korea-specific supply chain impact.`;

async function fetchMaritimeNews(fromISO) {
  const res = await fetch(
    `${PROXY_URL}/api/news?from=${encodeURIComponent(fromISO)}&q=${encodeURIComponent(NEWS_KEYWORDS)}`
  );
  if (!res.ok) return [];
  return res.json();
}

async function saveReport(card) {
  const { error } = await supabase.from('agent_reports').insert(card);
  if (error) console.error('[GEOPOLITICAL_LINKER] save error:', error);
}

export async function runGeopoliticalLinker() {
  console.log('[GEOPOLITICAL_LINKER] run at', new Date().toISOString());

  const from15min = new Date(Date.now() - POLL_INTERVAL_MS).toISOString();

  const articles = await fetchMaritimeNews(from15min).catch(() => []);
  if (articles.length === 0) return;

  // 최근 15분 CHOKEPOINT_WATCHER / ANOMALY_DETECTOR 보고 확인
  const { count: anomalyCount } = await supabase
    .from('agent_reports')
    .select('*', { count: 'exact', head: true })
    .in('agent_id', ['ANOMALY_DETECTOR', 'CHOKEPOINT_WATCHER'])
    .gte('created_at', from15min);

  const hasMovementAnomaly = (anomalyCount ?? 0) > 0;
  const hasMaritimeNews = articles.length > 0;

  if (!hasMaritimeNews || !hasMovementAnomaly) return;

  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        news_articles: articles.slice(0, 5).map((a) => ({
          title: a.title,
          source: a.source?.name ?? 'Unknown',
          published_at: a.publishedAt,
          description: a.description?.substring(0, 200),
        })),
        recent_maritime_alerts: anomalyCount,
        analysis_window: '15분',
      }),
      maxTokens: 1000,
    });

    await saveReport({
      agent_id: 'GEOPOLITICAL_LINKER',
      severity: result.severity,
      title: result.title,
      summary: result.summary,
      detail: `## 관련 뉴스\n${result.news_items?.map((n) => `- **${n.headline}** (${n.source})`).join('\n')}\n\n## 해운 영향\n${result.shipping_impact?.data_correlation}\n\n## 과거 패턴\n${result.historical_pattern}\n\n## 권고사항\n${result.recommendation}`,
      data_points: result.data_points ?? [],
      annotations: [result.recommendation].filter(Boolean),
      related_mmsi: [],
      location: null,
      raw_data: { articles_count: articles.length },
    });
  } catch (err) {
    console.error('[GEOPOLITICAL_LINKER] error:', err.message);
  }
}

export function startGeopoliticalLinker() {
  runGeopoliticalLinker();
  return setInterval(runGeopoliticalLinker, POLL_INTERVAL_MS);
}
