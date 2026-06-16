import { useEffect, useState } from 'react';
import useStore from '../store/useStore.js';
import { fmtKstTime } from '../utils/time.js';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const SEVERITY_COLORS = {
  CRITICAL: 'text-red-400',
  WARNING: 'text-yellow-400',
  INFO: 'text-green-400',
};

const TYPE_COLORS = {
  'Container Ship': '#3B82F6',
  'Tanker':         '#EF4444',
  'Bulk Carrier':   '#EAB308',
  'LNG Carrier':    '#14B8A6',
  'Fishing':        '#22C55E',
  'Special Craft':  '#8B5CF6',
  'Other':          '#9CA3AF',
};

function ChangeBadge({ pct }) {
  if (pct == null) return null;
  const sign = pct > 0 ? '+' : '';
  const color = pct > 20 ? 'bg-red-900/40 text-red-300' : pct < -10 ? 'bg-green-900/40 text-green-300' : 'bg-white/10 text-white/60';
  return (
    <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${color}`}>
      {sign}{pct}%
    </span>
  );
}

export default function PortStatsPanel() {
  const { selectedPort, setSelectedPort } = useStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedPort) { setStats(null); return; }
    setLoading(true);
    fetch(`${PROXY_URL}/api/port-stats?portId=${selectedPort.id}`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [selectedPort?.id]);

  if (!selectedPort) return null;

  const waitChangePct = stats
    ? Math.round(((stats.waiting_ships - stats.baseline_waiting) / Math.max(stats.baseline_waiting, 1)) * 100)
    : null;

  return (
    <div className="absolute bottom-10 left-4 w-72 bg-sea-panel border border-sea-border rounded-xl shadow-2xl z-10 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-start justify-between p-3 border-b border-sea-border">
        <div>
          <p className="text-sm font-bold text-white">{selectedPort.name}</p>
          <p className="text-[10px] font-mono text-sea-muted">항만 통계</p>
        </div>
        <button onClick={() => setSelectedPort(null)} className="text-sea-muted hover:text-white text-sm ml-2">✕</button>
      </div>

      {loading && (
        <div className="p-4 text-xs text-sea-muted animate-pulse">데이터 로딩 중...</div>
      )}

      {!loading && stats && (
        <div className="divide-y divide-sea-border">
          {/* 선박 현황 */}
          <div className="grid grid-cols-2 gap-0">
            <div className="px-3 py-2 text-center border-r border-sea-border">
              <p className="text-[9px] text-sea-muted font-mono">현재 선박</p>
              <p className="text-lg font-bold text-white font-mono">{stats.total_ships}</p>
              <p className="text-[9px] text-sea-muted">척</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-[9px] text-sea-muted font-mono">대기 선박</p>
              <div className="flex items-center justify-center gap-1">
                <p className="text-lg font-bold text-white font-mono">{stats.waiting_ships}</p>
                <ChangeBadge pct={waitChangePct} />
              </div>
              <p className="text-[9px] text-sea-muted">평년 {stats.baseline_waiting}척</p>
            </div>
          </div>

          {/* 선종 분포 */}
          {stats.vessel_type_dist?.length > 0 && (
            <div className="p-3 space-y-2">
              <p className="text-[10px] text-sea-muted font-mono">선종 분포</p>
              {stats.vessel_type_dist.slice(0, 5).map(({ type, count, pct }) => (
                <div key={type} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white truncate pr-2">{type}</span>
                    <span className="text-sea-muted font-mono shrink-0">{count}척 ({pct}%)</span>
                  </div>
                  <div className="h-1 bg-sea-bg rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${pct}%`,
                        background: TYPE_COLORS[type] ?? '#9CA3AF',
                        opacity: 0.75,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 국적 분포 */}
          {stats.flag_dist?.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] text-sea-muted font-mono mb-2">국적 분포 (상위 5개)</p>
              <div className="flex flex-wrap gap-1">
                {stats.flag_dist.slice(0, 5).map(({ flag, count, pct }) => (
                  <div key={flag} className="bg-sea-bg border border-sea-border rounded px-2 py-1 text-center">
                    <p className="text-[10px] font-mono text-white">{flag}</p>
                    <p className="text-[9px] text-sea-muted">{count}척 · {pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 최근 에이전트 보고 */}
          {stats.recent_reports?.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] text-sea-muted font-mono mb-2">최근 에이전트 보고</p>
              <div className="space-y-1.5">
                {stats.recent_reports.map(r => (
                  <div key={r.id} className="bg-sea-bg rounded p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-mono font-bold ${SEVERITY_COLORS[r.severity] ?? 'text-white'}`}>
                        {r.severity}
                      </span>
                      <span className="text-[9px] text-sea-muted">
                        {fmtKstTime(r.created_at)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white leading-tight line-clamp-2">{r.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
