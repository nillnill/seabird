import useStore from '../store/useStore.js';

// 카테고리 탭 ↔ 에이전트 매핑 단일 소스.
// agents === null 이면 전체(모든 agent_id, MASTER_AGENT 포함).
// 새 에이전트 추가 시 여기서 해당 탭의 agents 배열에 등록한다.
export const TABS = [
  { id: 'all',       label: '전체',      icon: '📡', agents: null },
  { id: 'port',      label: '항구',      icon: '🏗️', agents: ['PORT_ANALYST'] },
  { id: 'choke',     label: '초크포인트', icon: '🚢', agents: ['CHOKEPOINT_WATCHER'] },
  { id: 'commodity', label: '원자재',    icon: '💹', agents: ['COMMODITY_ANALYST', 'FLOW_REPORTER'] },
  { id: 'weather',   label: '날씨',      icon: '🌪️', agents: ['WEATHER_AGENT'] },
  { id: 'region',    label: '지역',      icon: '🌐', agents: ['GEOPOLITICAL_LINKER'] },
  { id: 'cargo',     label: '화물',      icon: '📦', agents: ['CARGO_ESTIMATOR'] },
];

// 보고(agent_id)가 해당 탭에 속하는지 — 'all'은 항상 true.
export function reportInTab(tabId, agentId) {
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
  return tab.agents === null || tab.agents.includes(agentId);
}

export default function FeedTabs({ counts }) {
  const { feedTab, setFeedTab } = useStore();

  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-sea-border">
      {TABS.map(({ id, label, icon }) => {
        const active = feedTab === id;
        const count = counts?.[id] ?? 0;
        return (
          <button
            key={id}
            onClick={() => setFeedTab(id)}
            className={`shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${
              active
                ? 'border-blue-500/60 bg-blue-900/30 text-blue-200'
                : 'border-sea-border text-sea-muted hover:text-white'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
            {count > 0 && (
              <span
                className={`font-mono text-[9px] leading-none px-1 py-0.5 rounded ${
                  active ? 'bg-blue-500/30 text-blue-100' : 'bg-sea-bg text-sea-muted'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
