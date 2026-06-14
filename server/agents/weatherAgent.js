const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');

const POLL_INTERVAL_MS = 60 * 60 * 1000;  // 1시간 (전 에이전트 1시간 배치로 통일)

// 감시 지점: 초크포인트 7곳 + 태풍·사이클론 다발 해역 6곳
const WEATHER_POINTS = [
  // 초크포인트
  { id: 'suez',          name: '수에즈 운하',   lat: 30.6, lng: 32.5  },
  { id: 'malacca',       name: '말라카 해협',   lat: 2.5,  lng: 103.5 },
  { id: 'hormuz',        name: '호르무즈 해협', lat: 26.5, lng: 56.5  },
  { id: 'panama',        name: '파나마 운하',   lat: 9.1,  lng: -79.9 },
  { id: 'dover',         name: '영불 해협',     lat: 51.0, lng: 1.5   },
  { id: 'korea_strait',  name: '대한해협',      lat: 34.2, lng: 129.5 },
  { id: 'bab_el_mandeb', name: '바브엘만데브',  lat: 12.5, lng: 43.5  },
  // 태풍·사이클론·허리케인 다발 해역
  { id: 'west_pacific',     name: '서태평양(태풍)',   lat: 16.0, lng: 134.0 },
  { id: 'south_china_sea',  name: '남중국해',         lat: 15.0, lng: 115.0 },
  { id: 'bay_of_bengal',    name: '벵골만(사이클론)', lat: 14.0, lng: 88.0  },
  { id: 'arabian_sea',      name: '아라비아해',       lat: 15.0, lng: 64.0  },
  { id: 'caribbean',        name: '카리브해(허리케인)', lat: 19.0, lng: -83.0 },
  { id: 'north_atlantic',   name: '북대서양',         lat: 40.0, lng: -45.0 },
];

// WMO weather code → 이모지 + 한국어 설명
function codeToWeather(code) {
  if (code === 0) return { emoji: '☀️', desc: '맑음' };
  if (code === 1) return { emoji: '🌤️', desc: '대체로 맑음' };
  if (code === 2) return { emoji: '⛅', desc: '부분 흐림' };
  if (code === 3) return { emoji: '☁️', desc: '흐림' };
  if (code === 45 || code === 48) return { emoji: '🌫️', desc: '안개' };
  if (code >= 51 && code <= 55) return { emoji: '🌦️', desc: '이슬비' };
  if (code === 56 || code === 57) return { emoji: '🌧️', desc: '어는 이슬비' };
  if (code >= 61 && code <= 65) return { emoji: '🌧️', desc: '비' };
  if (code === 66 || code === 67) return { emoji: '🌧️', desc: '어는 비' };
  if (code >= 71 && code <= 77) return { emoji: '🌨️', desc: '눈' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', desc: '소나기' };
  if (code === 85 || code === 86) return { emoji: '🌨️', desc: '눈 소나기' };
  if (code === 95) return { emoji: '⛈️', desc: '뇌우' };
  if (code === 96 || code === 99) return { emoji: '⛈️', desc: '우박 동반 뇌우' };
  return { emoji: '🌊', desc: '정보 없음' };
}

// 풍속(m/s)·날씨코드 → 심각도
function classifySeverity(code, gust) {
  const thunder = [95, 96, 99].includes(code);
  if (gust >= 28 || (thunder && gust >= 18)) return 'CRITICAL';   // 태풍·폭풍급 돌풍
  if (gust >= 17 || [65, 67, 75, 82, 86, 95, 96, 99].includes(code)) return 'WARNING'; // 강풍·악천후
  return 'INFO';
}

const SEVERITY_RANK = { INFO: 0, WARNING: 1, CRITICAL: 2 };

const SYSTEM_PROMPT = `You are WEATHER MONITOR, a maritime weather intelligence agent watching global shipping chokepoints and cyclone-prone seas.

Respond ONLY with valid JSON. Language: Korean. 개조식 마크다운.

{
  "title": "[해상 기상 현황 제목 — 악천후 있으면 해역명 포함, 최대 50자]",
  "summary": "핵심 요약 (최대 100자). 이상 없으면 '13개 감시 해역 양호' 형식.",
  "detail": "## 🌊 해상 기상 현황\\n\\n| 해역 | 날씨 | 풍속(돌풍) | 상태 |\\n|------|------|-----------|------|\\n| 서태평양 | ⛈️ 뇌우 | 22(31)m/s | 🔴 위험 |\\n\\n## ⚠️ 주의 해역\\n- **해역명** — 영향(항로 우회·지연 등)\\n\\n## 🇰🇷 해운 시사점\\n- 권고사항"
}

악천후가 없으면 detail의 주의 해역 섹션에 "- 이상 없음 — 전 해역 항행 양호" 표기. 데이터가 적어도 반드시 의견 제공.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function fetchWeather() {
  const lats = WEATHER_POINTS.map(p => p.lat).join(',');
  const lngs = WEATHER_POINTS.map(p => p.lng).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}`
    + `&current=weather_code,wind_speed_10m,wind_gusts_10m&wind_speed_unit=ms`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  // 다중 좌표면 배열, 단일이면 객체
  return Array.isArray(data) ? data : [data];
}

async function runWeatherAgent() {
  console.log('[WEATHER_AGENT] run at', new Date().toISOString());
  const db = getDb();

  try {
    const forecasts = await fetchWeather();

    const points = WEATHER_POINTS.map((p, i) => {
      const cur = forecasts[i]?.current ?? {};
      const code = cur.weather_code ?? -1;
      const wind = Math.round(cur.wind_speed_10m ?? 0);
      const gust = Math.round(cur.wind_gusts_10m ?? 0);
      const { emoji, desc } = codeToWeather(code);
      const severity = classifySeverity(code, gust);
      // 폭풍급 돌풍이면 태풍 이모지로 강조
      const displayEmoji = severity === 'CRITICAL' && gust >= 28 ? '🌀' : emoji;
      return { id: p.id, name: p.name, lat: p.lat, lng: p.lng, emoji: displayEmoji, desc, wind, gust, severity };
    });

    const notable = points
      .filter(p => p.severity !== 'INFO')
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.gust - a.gust);

    const overall = notable[0]?.severity ?? 'INFO';
    const worst = notable[0] ?? null;

    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        analysis_time: new Date().toISOString(),
        overall_severity: overall,
        points: points.map(p => ({ 해역: p.name, 날씨: p.desc, 풍속: p.wind, 돌풍: p.gust, 상태: p.severity })),
        notable_count: notable.length,
      }),
      maxTokens: 1400,
      model: 'claude-haiku-4-5',
    });

    const data_points = notable.slice(0, 5).map(p => ({
      label: p.name,
      current: p.gust,
      baseline: p.wind,
      unit: 'm/s',
      change_pct: p.wind > 0 ? Math.round(((p.gust - p.wind) / p.wind) * 100) : 0,
      direction: 'UP',
    }));

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'WEATHER_AGENT',
      severity: 'INFO', // 보고 severity는 MASTER_AGENT 전담. 단, raw_data.points의 기상 등급(돌풍·🌀)은 마커용 사실 데이터라 유지

      title: (result.title ?? '해상 기상 현황').slice(0, 60),
      summary: (result.summary ?? `13개 감시 해역 — 주의 ${notable.length}곳`).slice(0, 120),
      detail: result.detail ?? '',
      data_points,
      annotations: [],
      related_mmsi: [],
      location: worst ? { lat: worst.lat, lng: worst.lng, zoom: 5 } : null,
      raw_data: { source: 'open-meteo', points },   // points → 프론트 지도 이모지 마커
    });
    if (error) console.error('[WEATHER_AGENT] insert error:', error.message);
    else console.log(`[WEATHER_AGENT] report saved: ${overall} (주의 ${notable.length}곳)`);
  } catch (err) {
    console.error('[WEATHER_AGENT] error:', err.message);
  }
}

function startWeatherAgent() {
  runWeatherAgent();
  return setInterval(runWeatherAgent, POLL_INTERVAL_MS);
}

module.exports = { runWeatherAgent, startWeatherAgent, WEATHER_POINTS };
