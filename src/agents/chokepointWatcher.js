import { supabase } from '../utils/supabaseClient.js';
import { callClaude } from '../utils/claudeClient.js';
import { nmToDeg } from '../utils/geoUtils.js';
import { HARDCODED_BASELINE } from '../data/hardcodedBaselines.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export const CHOKEPOINTS = [
  { id: 'suez',          name: '수에즈 운하',    bbox: [[29.9, 31.8], [31.3, 33.1]], daily_avg: 58 },
  { id: 'malacca',       name: '말라카 해협',    bbox: [[1.0, 99.5],  [6.5, 104.5]], daily_avg: 247 },
  { id: 'hormuz',        name: '호르무즈 해협',  bbox: [[25.8, 55.5], [27.0, 57.5]], daily_avg: 89 },
  { id: 'panama',        name: '파나마 운하',    bbox: [[8.8, -80.2], [9.5, -79.5]], daily_avg: 35 },
  { id: 'dover',         name: '영불 해협',      bbox: [[50.5, -2.0], [51.5, 2.5]],  daily_avg: 312 },
  { id: 'korea_strait',  name: '대한해협',       bbox: [[33.5, 128.5],[35.0, 130.5]],daily_avg: 156 },
  { id: 'bab_el_mandeb', name: '바브엘만데브',   bbox: [[11.5, 43.0], [13.0, 44.5]], daily_avg: 67 },
];

const SYSTEM_PROMPT = `You are CHOKEPOINT WATCHER, a maritime intelligence agent monitoring critical global shipping chokepoints.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "WARNING|CRITICAL",
  "title": "[초크포인트명] 통과량 이상 감지",
  "summary": "통과량 수치 포함 핵심 요약 (최대 80자)",
  "detail": "## 현황\\n[내용]\\n## 원인 분석\\n[내용]\\n## 공급망 리스크\\n[내용]",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "ai_comment": "과거 유사 패턴과 비교 및 권고사항 (최대 250자)",
  "data_points": [
    {"label": "현재 통과량", "current": 0, "baseline": 0, "unit": "척/일", "change_pct": 0, "direction": "DOWN"}
  ]
}

ALWAYS include specific numbers. Cite past similar cases (2021 Suez blockage, 2023 Panama drought, 2024 Red Sea attacks).`;

async function queryShipsInBbox(bbox) {
  const [[latMin, lngMin], [latMax, lngMax]] = bbox;
  const { data } = await supabase
    .from('ships')
    .select('mmsi, vessel_type, speed')
    .gte('lat', latMin).lte('lat', latMax)
    .gte('lng', lngMin).lte('lng', lngMax)
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
  return data ?? [];
}

async function getPrevBaseline(locationId, metric) {
  const { data } = await supabase
    .from('baselines')
    .select('current_value, avg_90d')
    .eq('location_id', locationId)
    .eq('metric', metric)
    .order('snapshot_at', { ascending: false })
    .limit(2);
  return data?.[1] ?? null; // 가장 최근 이전 스냅샷
}

async function saveReport(card) {
  const { error } = await supabase.from('agent_reports').insert(card);
  if (error) console.error('[CHOKEPOINT_WATCHER] save error:', error);
}

export async function runChokepointWatcher() {
  console.log('[CHOKEPOINT_WATCHER] run at', new Date().toISOString());

  for (const cp of CHOKEPOINTS) {
    const shipsNow = await queryShipsInBbox(cp.bbox);
    const hourlyRate = shipsNow.length;
    const dailyEstimate = hourlyRate * 24;

    const { data: baselineRow } = await supabase
      .from('baselines')
      .select('avg_90d')
      .eq('location_id', cp.id)
      .eq('metric', 'daily_throughput')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    const avg90d = baselineRow?.avg_90d ?? HARDCODED_BASELINE.chokepoints[cp.id]?.daily_throughput ?? cp.daily_avg;
    const prevSnap = await getPrevBaseline(cp.id, 'daily_throughput');
    const prevHourlyRate = prevSnap?.current_value ? prevSnap.current_value / 24 : hourlyRate;

    const changePct = Math.round(((dailyEstimate - avg90d) / avg90d) * 100);

    const triggers = {
      dailyDrop: dailyEstimate < avg90d * 0.75,
      suddenDrop: prevHourlyRate > 0 && hourlyRate / prevHourlyRate < 0.5,
    };

    if (!Object.values(triggers).some(Boolean)) continue;

    const severity = triggers.dailyDrop && triggers.suddenDrop ? 'CRITICAL' : 'WARNING';

    try {
      const result = await callClaude({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: JSON.stringify({
          chokepoint: cp.name,
          current_hourly: hourlyRate,
          daily_estimate: dailyEstimate,
          avg_90d: avg90d,
          change_pct: changePct,
          triggers,
          vessel_types: shipsNow.reduce((acc, s) => {
            acc[s.vessel_type] = (acc[s.vessel_type] ?? 0) + 1;
            return acc;
          }, {}),
        }),
        maxTokens: 800,
      });

      await saveReport({
        agent_id: 'CHOKEPOINT_WATCHER',
        severity: result.severity ?? severity,
        title: result.title,
        summary: result.summary,
        detail: result.detail,
        data_points: result.data_points ?? [],
        annotations: [result.ai_comment].filter(Boolean),
        related_mmsi: [],
        location: {
          lat: (cp.bbox[0][0] + cp.bbox[1][0]) / 2,
          lng: (cp.bbox[0][1] + cp.bbox[1][1]) / 2,
          zoom: 6,
          chokepoint_id: cp.id,
        },
        raw_data: { cp, hourlyRate, dailyEstimate, avg90d },
      });
    } catch (err) {
      console.error(`[CHOKEPOINT_WATCHER] ${cp.id} error:`, err.message);
    }
  }
}

export function startChokepointWatcher() {
  runChokepointWatcher();
  return setInterval(runChokepointWatcher, POLL_INTERVAL_MS);
}
