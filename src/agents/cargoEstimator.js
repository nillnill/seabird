import { supabase } from '../utils/supabaseClient.js';
import { callClaude } from '../utils/claudeClient.js';
import { TRADE_PAIRS, SEASONAL_INDEX, getSeasonalCategory } from '../data/tradePairs.js';

const SYSTEM_PROMPT = `You are CARGO ESTIMATOR, a maritime cargo intelligence agent.

Given vessel AIS data and trade statistics, estimate the probable cargo composition.

Respond ONLY with valid JSON. Language: Korean.

{
  "cargo_distribution": [
    {
      "item": "품목명",
      "probability_pct": 38,
      "margin_pct": 8,
      "annotation": "[1] 근거: UN Comtrade 2023 인니→한국 수출 1위, HS Code 7502"
    }
  ],
  "estimated_load_tons": 45000,
  "load_ratio_pct": 78,
  "confidence": "HIGH|MEDIUM|LOW",
  "disclaimer": "본 추정은 공개 무역 통계와 AIS 데이터를 기반으로 한 확률적 추정이며, 실제 화물과 다를 수 있습니다.",
  "data_sources": ["UN Comtrade 2023", "AIS 흘수 데이터", "계절 인덱스"]
}

MANDATORY:
1. Every cargo item MUST have an annotation with data source and reasoning
2. Probabilities must sum to 100%
3. Include disclaimer at the bottom
4. Use seasonal index adjustments when applicable
5. If trade pair data unavailable, use vessel_type + destination region heuristics and note the reduced confidence

FORBIDDEN: Stating cargo without citing a basis. No hallucinated percentages.`;

export async function runCargoEstimator(mmsi) {
  const { data: ship } = await supabase
    .from('ships')
    .select('*')
    .eq('mmsi', mmsi)
    .single();

  if (!ship) return null;

  const origin = ship.origin_country ?? ship.flag_country;
  const dest = ship.dest_country;
  const tradePairKey = origin && dest ? `${origin}_${dest}` : null;
  const tradePair = tradePairKey ? TRADE_PAIRS[tradePairKey] ?? null : null;

  const loadRatio = ship.draught && ship.max_draught
    ? Math.min(ship.draught / ship.max_draught, 1.0)
    : 0.7; // 데이터 없으면 70% 가정

  const estimatedLoad = ship.dwt ? Math.round(ship.dwt * loadRatio) : null;
  const currentMonth = new Date().getMonth();

  // 계절 인덱스 계산
  let seasonalNote = '';
  if (tradePair?.top_cargo?.[0]) {
    const cat = getSeasonalCategory(tradePair.top_cargo[0].hs_code);
    const idx = SEASONAL_INDEX[cat]?.[currentMonth] ?? 1.0;
    if (idx !== 1.0) {
      seasonalNote = `현재 월(${currentMonth + 1}월) 계절 인덱스: ${idx} (${cat})`;
    }
  }

  const userMessage = JSON.stringify({
    vessel: {
      mmsi: ship.mmsi,
      ship_name: ship.ship_name,
      vessel_type: ship.vessel_type,
      destination: ship.destination,
      origin_country: origin,
      dest_country: dest,
      draught: ship.draught,
      max_draught: ship.max_draught,
      dwt: ship.dwt,
      flag_country: ship.flag_country,
    },
    trade_pair: tradePair ?? '데이터 없음',
    estimated_load_tons: estimatedLoad,
    load_ratio_pct: Math.round(loadRatio * 100),
    seasonal_note: seasonalNote || '없음',
    current_month: currentMonth + 1,
  });

  return callClaude({ systemPrompt: SYSTEM_PROMPT, userMessage, maxTokens: 1200 });
}
