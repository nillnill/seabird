import { useState } from 'react';
import useStore from '../store/useStore.js';

// 지역 캐릭터 아바타 — 이미지 실패 시 심볼/국기 이모지로 fallback
function CharAvatar({ character, dim = 'w-7 h-7' }) {
  const [err, setErr] = useState(false);
  if (err || !character.image) {
    return (
      <span className={`${dim} shrink-0 flex items-center justify-center rounded-full bg-sea-bg text-sm`}>
        {character.symbolEmoji ?? character.flagEmoji ?? '⚓'}
      </span>
    );
  }
  return (
    <img
      src={character.image}
      alt={character.name}
      onError={() => setErr(true)}
      className={`${dim} shrink-0 rounded-full object-cover bg-sea-bg`}
    />
  );
}

const SEVERITY_CONFIG = {
  CRITICAL: { badge: 'CRITICAL', bgColor: 'bg-red-900/20',    borderColor: 'border-red-500/60',    textColor: 'text-red-400' },
  WARNING:  { badge: 'WARNING',  bgColor: 'bg-yellow-900/20', borderColor: 'border-yellow-500/60', textColor: 'text-yellow-400' },
  INFO:     { badge: 'INFO',     bgColor: 'bg-green-900/10',  borderColor: 'border-green-500/40',  textColor: 'text-green-400' },
};

const AGENT_CONFIG = {
  PORT_ANALYST:        { icon: '🏗️', label: 'PORT ANALYST' },
  CHOKEPOINT_WATCHER:  { icon: '🚢', label: 'CHOKEPOINT' },
  CARGO_ESTIMATOR:     { icon: '📦', label: 'CARGO EST.' },
  GEOPOLITICAL_LINKER: { icon: '🌐', label: 'GEO LINKER' },
  WEATHER_AGENT:       { icon: '🌪️', label: 'WEATHER' },
  COMMODITY_ANALYST:   { icon: '💹', label: 'COMMODITY' },
  FLOW_REPORTER:       { icon: '🛢️', label: 'FLOW' },
  MASTER_AGENT:        { icon: '🧭', label: 'MASTER' },
};

function DataPointChip({ dp }) {
  const arrow = dp.direction === 'UP' ? '↑' : dp.direction === 'DOWN' ? '↓' : '→';
  const arrowColor = dp.direction === 'UP' ? 'text-red-400' : dp.direction === 'DOWN' ? 'text-green-400' : 'text-sea-muted';
  const sign = dp.change_pct > 0 ? '+' : '';
  return (
    <div className="flex flex-col gap-0.5 bg-sea-bg rounded px-2 py-1 min-w-0">
      <span className="text-sea-muted text-[10px] truncate">{dp.label}</span>
      <div className="flex items-baseline gap-1 font-mono">
        <span className="text-white text-xs font-semibold">{dp.current}{dp.unit}</span>
        <span className="text-sea-muted text-[10px]">/ {dp.baseline}{dp.unit}</span>
        <span className={`text-[10px] ${arrowColor}`}>{arrow}{sign}{dp.change_pct}%</span>
      </div>
    </div>
  );
}

export default function ReportCard({ report, onClick }) {
  const { focusMap } = useStore();
  const sev = SEVERITY_CONFIG[report.severity] ?? SEVERITY_CONFIG.INFO;
  const agent = AGENT_CONFIG[report.agent_id] ?? { icon: '📡', label: report.agent_id };
  const character = report.raw_data?.character;
  const borderColor = sev.borderColor;
  const bgColor = sev.bgColor;

  const kstTime = new Date(report.created_at).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dataPoints = Array.isArray(report.data_points) ? report.data_points : [];

  return (
    <div
      className={`border ${borderColor} ${bgColor} rounded-lg p-3 space-y-2 cursor-pointer hover:brightness-110 transition-all`}
      onClick={onClick}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        {character ? (
          <div className="flex items-center gap-2 min-w-0">
            <CharAvatar character={character} />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[11px] text-white font-semibold truncate">{character.name}</span>
              <span className="text-[9px] text-sea-muted truncate">{character.region ?? agent.label}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm">{agent.icon}</span>
            <span className="text-[10px] text-sea-muted font-mono tracking-wide truncate">{agent.label}</span>
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono font-semibold ${sev.textColor}`}>{sev.badge}</span>
          <span className="text-[10px] text-sea-muted font-mono">{kstTime}</span>
        </div>
      </div>

      {/* 제목 */}
      <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{report.title}</p>

      {/* DataPoint 칩 */}
      {dataPoints.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {dataPoints.slice(0, 3).map((dp, i) => (
            <DataPointChip key={i} dp={dp} />
          ))}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          className="text-[10px] px-2 py-1 rounded border border-sea-border text-sea-muted hover:text-white hover:border-white/30 transition-colors"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          상세보기
        </button>
        {report.location?.lat && (
          <button
            className="text-[10px] px-2 py-1 rounded border border-sea-border text-sea-muted hover:text-white hover:border-white/30 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              focusMap(report.location.lat, report.location.lng, report.location.zoom ?? 7);
            }}
          >
            지도에서 →
          </button>
        )}
      </div>
    </div>
  );
}
