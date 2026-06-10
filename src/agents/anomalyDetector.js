import { supabase } from '../utils/supabaseClient.js';
import { callClaude } from '../utils/claudeClient.js';
import { distanceNm, calcBearing } from '../utils/geoUtils.js';

const POLL_INTERVAL_MS = 2 * 60 * 1000;

const ANOMALY_SCORES = {
  AIS_DISAPPEAR_30MIN:   30,
  DESTINATION_DEVIATION: 25,
  CHOKEPOINT_LOITERING:  20,
  LOW_SPEED:             15,
  NIGHT_AIS_BREAK:       25,
  PRIOR_ANOMALY_HISTORY: 20,
};

const VESSEL_AVG_SPEEDS = {
  'Container Ship': 20, 'Tanker': 14, 'Bulk Carrier': 12,
  'LNG Carrier': 17, 'General Cargo': 13, 'Other': 12,
};

const SYSTEM_PROMPT = `You are ANOMALY DETECTOR, a maritime security intelligence agent.

Analyze suspicious vessel behavior based on AIS anomaly scoring data.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "WARNING|CRITICAL",
  "title": "[선명 or MMSI] 이상행동 탐지",
  "summary": "탐지된 주요 이상행동 + 리스크 점수 (최대 80자)",
  "anomaly_type": "DARK_SHIP|SPOOFING|LOITERING|SMUGGLING|PIRACY_RISK|UNKNOWN",
  "risk_score": 75,
  "score_breakdown": [
    {"flag": "AIS_DISAPPEAR_30MIN", "score": 30, "description": "30분 AIS 소실 후 재등장"}
  ],
  "possible_causes": ["제재 회피", "불법 환적 가능성", "기술적 오류"],
  "detail": "상세 분석 Markdown",
  "ai_comment": "이상행동 유형 분류 및 모니터링 권고사항 (최대 200자)",
  "data_points": [
    {"label": "위험 점수", "current": 75, "baseline": 0, "unit": "점", "change_pct": 0, "direction": "UP"}
  ]
}

SEVERITY: score 70-89 = WARNING, score 90+ = CRITICAL.
Note: AIS malfunction is always a possible cause.`;

async function saveReport(card) {
  const { error } = await supabase.from('agent_reports').insert(card);
  if (error) console.error('[ANOMALY_DETECTOR] save error:', error);
}

async function saveAnomalyHistory(mmsi, anomalyType, riskScore, flags, reportId) {
  await supabase.from('anomaly_history').insert({
    mmsi, anomaly_type: anomalyType, risk_score: riskScore, flags, report_id: reportId,
  });
}

export async function runAnomalyDetector(specificMmsi = null) {
  console.log('[ANOMALY_DETECTOR] run at', new Date().toISOString());

  let query = supabase.from('ships').select('*')
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
  if (specificMmsi) query = query.eq('mmsi', specificMmsi);
  const { data: ships } = await query;
  if (!ships?.length) return;

  const suspects = [];

  for (const ship of ships) {
    let score = 0;
    const flags = [];

    // ship_positions 이력 조회 (2시간)
    const { data: positions } = await supabase
      .from('ship_positions')
      .select('lat, lng, speed, recorded_at')
      .eq('mmsi', ship.mmsi)
      .gte('recorded_at', new Date(Date.now() - 7200000).toISOString())
      .order('recorded_at', { ascending: true });

    // 1. AIS 소실 (30분+ 공백)
    if (positions?.length >= 2) {
      for (let i = 1; i < positions.length; i++) {
        const gap = new Date(positions[i].recorded_at) - new Date(positions[i - 1].recorded_at);
        if (gap > 30 * 60 * 1000) {
          score += ANOMALY_SCORES.AIS_DISAPPEAR_30MIN;
          flags.push({ flag: 'AIS_DISAPPEAR_30MIN', score: 30, detail: `${Math.round(gap / 60000)}분 공백` });
          break;
        }
      }
    }

    // 2. 저속
    const avgSpeed = VESSEL_AVG_SPEEDS[ship.vessel_type] ?? 12;
    if (ship.speed !== null && ship.speed < avgSpeed * 0.4 && ship.speed > 0) {
      score += ANOMALY_SCORES.LOW_SPEED;
      flags.push({
        flag: 'LOW_SPEED', score: 15,
        detail: `${ship.speed}kn (평균 ${avgSpeed}kn의 ${Math.round(ship.speed / avgSpeed * 100)}%)`,
      });
    }

    // 3. 배회 (2h 동안 반경 5nm 내)
    if (positions?.length >= 4) {
      const maxDisp = Math.max(...positions.map((p) =>
        distanceNm(positions[0].lat, positions[0].lng, p.lat, p.lng)
      ));
      const durationH = (new Date(positions.at(-1).recorded_at) - new Date(positions[0].recorded_at)) / 3600000;
      if (maxDisp < 5 && durationH >= 2) {
        score += ANOMALY_SCORES.CHOKEPOINT_LOITERING;
        flags.push({
          flag: 'CHOKEPOINT_LOITERING', score: 20,
          detail: `${durationH.toFixed(1)}h 반경 ${maxDisp.toFixed(1)}nm 이내`,
        });
      }
    }

    // 4. 야간 AIS 단절 (UTC 22-06h 구간)
    if (positions?.length >= 2) {
      let nightBreaks = 0;
      for (let i = 1; i < positions.length; i++) {
        const gap = new Date(positions[i].recorded_at) - new Date(positions[i - 1].recorded_at);
        const hour = new Date(positions[i - 1].recorded_at).getUTCHours();
        if (gap > 20 * 60 * 1000 && (hour >= 22 || hour < 6)) nightBreaks++;
      }
      if (nightBreaks >= 2) {
        score += ANOMALY_SCORES.NIGHT_AIS_BREAK;
        flags.push({ flag: 'NIGHT_AIS_BREAK', score: 25, detail: `${nightBreaks}회 야간 단절` });
      }
    }

    // 5. 과거 이력
    const { count: historyCount } = await supabase
      .from('anomaly_history')
      .select('*', { count: 'exact', head: true })
      .eq('mmsi', ship.mmsi);
    if (historyCount > 0) {
      score += ANOMALY_SCORES.PRIOR_ANOMALY_HISTORY;
      flags.push({ flag: 'PRIOR_ANOMALY_HISTORY', score: 20, detail: `${historyCount}건 이력` });
    }

    if (score >= 70) {
      suspects.push({ ship, score, flags });
    }
  }

  for (const { ship, score, flags } of suspects) {
    try {
      const result = await callClaude({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: JSON.stringify({
          mmsi: ship.mmsi,
          ship_name: ship.ship_name ?? '선명 미상',
          vessel_type: ship.vessel_type,
          flag_country: ship.flag_country,
          last_position: { lat: ship.lat, lng: ship.lng },
          speed: ship.speed,
          destination: ship.destination,
          total_score: score,
          flags,
        }),
        maxTokens: 800,
      });

      const { data: inserted } = await supabase.from('agent_reports').insert({
        agent_id: 'ANOMALY_DETECTOR',
        severity: result.severity,
        title: result.title,
        summary: result.summary,
        detail: result.detail,
        data_points: result.data_points ?? [{ label: '위험 점수', current: score, baseline: 0, unit: '점', change_pct: 0, direction: 'UP' }],
        annotations: [result.ai_comment, ...(result.possible_causes ?? [])].filter(Boolean),
        related_mmsi: [ship.mmsi],
        location: { lat: ship.lat, lng: ship.lng, zoom: 8 },
        raw_data: { mmsi: ship.mmsi, score, flags },
      }).select('id').single();

      await saveAnomalyHistory(ship.mmsi, result.anomaly_type ?? 'UNKNOWN', score, flags, inserted?.id);
    } catch (err) {
      console.error(`[ANOMALY_DETECTOR] ${ship.mmsi} error:`, err.message);
    }
  }
}

export function startAnomalyDetector() {
  runAnomalyDetector();
  return setInterval(runAnomalyDetector, POLL_INTERVAL_MS);
}
