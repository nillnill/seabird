// REGION NEWS COLLECTOR — 일 1회 배치. 37개 항만·초크포인트의 최근 1주 뉴스를 Perplexity로 수집,
// Claude Haiku로 한국어 번역 → region_news 테이블에 저장(지역당 1행 upsert). 패널은 저장본을 즉시 표시.
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { callClaude } = require('./claudeClient');
const { NEWS_QUERIES, regionType } = require('../data/newsQueries');

const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 매일
const CONCURRENCY = 3;                         // Perplexity/Claude rate 보호

let _supabase = null, _warned = false;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 한 지역: Perplexity(최근 1주 영어) → Claude 한국어 번역 → { content } 또는 null
async function fetchRegionNews(query) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'You are a maritime news analyst. Find the most recent and relevant news about the given shipping location or route. Return up to 5 key news items in English. Format each as: "- **[Headline]**: [2-3 sentence summary]. (Source: [name], [date])"' },
        { role: 'user', content: `Find the latest news (past 7 days) about: ${query}. Focus on: shipping disruptions, port congestion, geopolitical tensions, sanctions, attacks, weather impacts, and trade volume changes. Return only factual recent news with dates.` },
      ],
      search_recency_filter: 'week',
      return_citations: false,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  const english = data.choices?.[0]?.message?.content ?? '';
  if (!english) return null;
  const content = await callClaude({
    systemPrompt: '해운 뉴스 번역가입니다. 영어 뉴스를 자연스러운 한국어로 번역하세요. 형식(-, **, 출처, 날짜 표기)은 그대로 유지하세요. 번역 외 다른 말은 추가하지 마세요.',
    userMessage: english,
    maxTokens: 1200,
    model: 'claude-haiku-4-5',
    rawText: true,
  });
  return content || null;
}

async function mapLimit(items, limit, fn) {
  for (let i = 0; i < items.length; i += limit) await Promise.all(items.slice(i, i + limit).map(fn));
}

async function runRegionNewsCollector() {
  console.log('[REGION_NEWS] run at', new Date().toISOString());
  if (!process.env.PERPLEXITY_API_KEY) {
    if (!_warned) { _warned = true; console.warn('[REGION_NEWS] PERPLEXITY_API_KEY 미설정 — skip.'); }
    return 0;
  }
  const db = getDb();
  const ids = Object.keys(NEWS_QUERIES);
  let ok = 0;
  await mapLimit(ids, CONCURRENCY, async (id) => {
    try {
      const content = await fetchRegionNews(NEWS_QUERIES[id]);
      if (!content) return;
      const { error } = await db.from('region_news').upsert({
        region_id: id, region_type: regionType(id), content, source: 'perplexity', fetched_at: new Date().toISOString(),
      }, { onConflict: 'region_id' });
      if (!error) ok++;
      else if (!_warned) { _warned = true; console.warn('[REGION_NEWS] upsert 실패(테이블 미생성?):', error.message); }
    } catch (e) { /* 개별 지역 실패 무시 */ }
  });
  console.log(`[REGION_NEWS] done — ${ok}/${ids.length} regions stored`);
  return ok;
}

function startRegionNewsCollector() {
  setTimeout(runRegionNewsCollector, 15000); // 시작 15s 후 1회
  return setInterval(runRegionNewsCollector, POLL_INTERVAL_MS);
}

module.exports = { runRegionNewsCollector, startRegionNewsCollector };
