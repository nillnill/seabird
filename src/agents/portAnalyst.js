import { supabase } from '../utils/supabaseClient.js';
import { callClaude } from '../utils/claudeClient.js';
import { nmToDeg } from '../utils/geoUtils.js';
import { HARDCODED_BASELINE } from '../data/hardcodedBaselines.js';

const POLL_INTERVAL_MS = 10 * 60 * 1000;

const PORTS = [
  { id: 'busan',     name: '부산항',     lat: 35.1028, lng: 129.0403, radius_nm: 15 },
  { id: 'incheon',   name: '인천항',     lat: 37.4563, lng: 126.6078, radius_nm: 12 },
  { id: 'gwangyang', name: '광양항',     lat: 34.9333, lng: 127.7167, radius_nm: 10 },
  { id: 'singapore', name: '싱가포르항', lat: 1.2654,  lng: 103.8198, radius_nm: 20 },
  { id: 'shanghai',  name: '상하이항',   lat: 31.2304, lng: 121.4737, radius_nm: 25 },
  { id: 'rotterdam', name: '로테르담항', lat: 51.9225, lng: 4.4792,   radius_nm: 20 },
  { id: 'la_lb',     name: 'LA/LB항',   lat: 33.7701, lng: -118.1937,radius_nm: 20 },
  { id: 'dubai',     name: '두바이항',   lat: 25.2048, lng: 55.2708,  radius_nm: 15 },
];

const SYSTEM_PROMPT = `You are PORT ANALYST, a maritime intelligence agent specializing in port congestion analysis.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[항만명] [상황 요약]",
  "summary": "핵심 수치 포함 1-2문장 요약 (최대 80자)",
  "detail": "## 현황\\n[내용]\\n## 선종 분포\\n[내용]\\n## 원인 분석\\n[내용]",
  "ai_comment": "변화 원인 추정 및 운영 시사점 (최대 200자)",
  "data_points": [
    {"label": "대기 선박", "current": 0, "baseline": 0, "unit": "척", "change_pct": 0, "direction": "UP"},
    {"label": "추정 대기시간", "current": 0, "baseline": 0, "unit": "h", "change_pct": 0, "direction": "UP"}
  ]
}

SEVERITY: CRITICAL = 평균 +60% 이상 OR 대기 12h+, WARNING = +40% 이상 OR 6h+, INFO = 그 외.
Always cite specific numbers.`;

async function queryPortShips(port) {
  const deg = nmToDeg(port.radius_nm);
  const { data } = await supabase
    .from('ships')
    .select('mmsi, vessel_type, speed, updated_at')
    .gte('lat', port.lat - deg).lte('lat', port.lat + deg)
    .gte('lng', port.lng - deg).lte('lng', port.lng + deg)
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
  return data ?? [];
}

function estimateWaitHours(waitingShips) {
  // 대기 선박 수 × 평균 처리 시간(0.5h)으로 단순 추정
  return waitingShips.length * 0.5;
}

function checkVesselTypeDrift(ships, port) {
  const containers = ships.filter((s) => s.vessel_type === 'Container Ship').length;
  const ratio = ships.length > 0 ? (containers / ships.length) * 100 : 0;
  const baselineRatio = 50; // 단순 기준값
  return Math.abs(ratio - baselineRatio);
}

async function saveReport(card) {
  const { error } = await supabase.from('agent_reports').insert(card);
  if (error) console.error('[PORT_ANALYST] save error:', error);
}

export async function runPortAnalyst(specificPortId = null) {
  console.log('[PORT_ANALYST] run at', new Date().toISOString());

  const ports = specificPortId ? PORTS.filter((p) => p.id === specificPortId) : PORTS;

  for (const port of ports) {
    const ships = await queryPortShips(port);
    const waitingShips = ships.filter((s) => s.speed <= 2.0);
    const currentCount = waitingShips.length;

    const { data: baselineRow } = await supabase
      .from('baselines')
      .select('avg_90d')
      .eq('location_id', port.id)
      .eq('metric', 'waiting_ships')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    const avg90d = baselineRow?.avg_90d ?? HARDCODED_BASELINE.ports[port.id]?.waiting_ships ?? 10;
    const waitHours = estimateWaitHours(waitingShips);
    const changePct = avg90d > 0 ? Math.round(((currentCount - avg90d) / avg90d) * 100) : 0;

    const triggers = {
      countSurge: currentCount > avg90d * 1.4,
      longWait: waitHours > 6,
      vesselTypeSurge: checkVesselTypeDrift(ships, port) > 15,
    };

    if (!Object.values(triggers).some(Boolean)) continue;

    const vesselTypeDist = ships.reduce((acc, s) => {
      acc[s.vessel_type] = (acc[s.vessel_type] ?? 0) + 1;
      return acc;
    }, {});

    try {
      const result = await callClaude({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: JSON.stringify({
          port: port.name,
          current_waiting: currentCount,
          avg_90d: avg90d,
          change_pct: changePct,
          est_wait_hours: waitHours,
          vessel_type_dist: vesselTypeDist,
          triggers,
        }),
        maxTokens: 800,
      });

      await saveReport({
        agent_id: 'PORT_ANALYST',
        severity: result.severity,
        title: result.title,
        summary: result.summary,
        detail: result.detail,
        data_points: result.data_points ?? [],
        annotations: [result.ai_comment].filter(Boolean),
        related_mmsi: [],
        location: { lat: port.lat, lng: port.lng, zoom: 10 },
        raw_data: { port: port.id, currentCount, avg90d, waitHours },
      });
    } catch (err) {
      console.error(`[PORT_ANALYST] ${port.id} error:`, err.message);
    }
  }
}

export function startPortAnalyst() {
  runPortAnalyst();
  return setInterval(runPortAnalyst, POLL_INTERVAL_MS);
}
