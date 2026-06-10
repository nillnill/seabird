import { callClaude } from '../utils/claudeClient.js';
import { runPortAnalyst } from './portAnalyst.js';
import { runCargoEstimator } from './cargoEstimator.js';
import { runAnomalyDetector } from './anomalyDetector.js';
import { runChokepointWatcher } from './chokepointWatcher.js';
import { runGeopoliticalLinker } from './geopoliticalLinker.js';

const SYSTEM_PROMPT = `You are the Seabird Orchestrator.
Parse user natural language queries and route them to the correct agents.

Respond ONLY with valid JSON:
{
  "agents": ["PORT_ANALYST"],
  "params": {
    "port_id": "busan",
    "mmsi": null
  },
  "user_message": "처리 중입니다..."
}

ROUTING RULES:
- 항만/항구/port/congestion/혼잡 → PORT_ANALYST
- MMSI/선박명/vessel/ship + 화물/cargo/적재 → CARGO_ESTIMATOR
- MMSI/선박명/vessel/ship + 위험/리스크/이상/anomaly → ANOMALY_DETECTOR
- 초크포인트/해협/canal/strait → CHOKEPOINT_WATCHER
- 뉴스/제재/지정학/geopolitical → GEOPOLITICAL_LINKER
- 복합 질문 → 여러 에이전트 동시

Port ID mappings (port_id):
부산=busan, 인천=incheon, 광양=gwangyang, 싱가포르=singapore,
상하이=shanghai, 로테르담=rotterdam, LA=la_lb, 두바이=dubai

If no port or MMSI is identifiable, set to null.`;

const AGENT_RUNNERS = {
  PORT_ANALYST:        (params) => runPortAnalyst(params?.port_id ?? null),
  CARGO_ESTIMATOR:     (params) => params?.mmsi ? runCargoEstimator(params.mmsi) : Promise.resolve(null),
  ANOMALY_DETECTOR:    (params) => runAnomalyDetector(params?.mmsi ?? null),
  CHOKEPOINT_WATCHER:  () => runChokepointWatcher(),
  GEOPOLITICAL_LINKER: () => runGeopoliticalLinker(),
};

export async function routeCommand(userText) {
  const routing = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userText,
    maxTokens: 300,
  });

  const agentIds = routing.agents ?? [];
  if (agentIds.length === 0) return;

  await Promise.all(
    agentIds.map((id) => {
      const runner = AGENT_RUNNERS[id];
      if (!runner) return Promise.resolve();
      return runner(routing.params).catch((err) =>
        console.error(`[ORCHESTRATOR] ${id} error:`, err.message)
      );
    })
  );

  return routing;
}
