import { useMemo } from 'react';
import useStore from '../store/useStore.js';

const STATUS_CONFIG = {
  CONNECTED:    { dot: 'bg-green-400', label: 'LIVE' },
  CONNECTING:   { dot: 'bg-yellow-400 animate-pulse', label: 'CONNECTING' },
  PAUSED:       { dot: 'bg-blue-400', label: '일시중지' },
  DISCONNECTED: { dot: 'bg-gray-500', label: 'OFFLINE' },
  ERROR:        { dot: 'bg-red-500 animate-pulse', label: 'ERROR' },
};

const CP_LABEL = {
  suez: '수에즈', malacca: '말라카', hormuz: '호르무즈',
  panama: '파나마', dover: '영불해협', korea_strait: '대한해협', bab_el_mandeb: '바브만데브',
};

function CpChip({ cpId, changePct, severity }) {
  const sign = changePct > 0 ? '+' : '';
  const color = severity === 'CRITICAL' ? 'text-red-400' : severity === 'WARNING' ? 'text-yellow-400' : 'text-green-400/80';
  const arrow = changePct > 0 ? '↑' : changePct < 0 ? '↓' : '→';
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      <span className="text-white/40">{CP_LABEL[cpId] ?? cpId}</span>
      <span className={`font-mono ${color}`}>{arrow}{sign}{changePct}%</span>
    </span>
  );
}

export default function StatusBar() {
  const { wsStatus, shipCount, reports, toggleXCapital, toggleCountryLayer, showCountryLayer } = useStore();
  const { dot, label } = STATUS_CONFIG[wsStatus] ?? STATUS_CONFIG.DISCONNECTED;

  // 초크포인트별 최신 보고에서 비교 수치 추출
  const cpComparisons = useMemo(() => {
    const latest = {};
    reports.forEach(r => {
      if (r.agent_id !== 'CHOKEPOINT_WATCHER') return;
      const cpId = r.raw_data?.cp_id;
      if (!cpId || latest[cpId]) return;
      latest[cpId] = { cpId, changePct: r.raw_data.change_pct ?? 0, severity: r.severity };
    });
    return Object.values(latest).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5);
  }, [reports]);

  return (
    <header className="border-b border-sea-border bg-sea-panel shrink-0">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-sm font-semibold tracking-widest text-white shrink-0">SEABIRD</span>
          <span className="text-xs text-sea-muted hidden md:block">AI eyes on every ocean</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-4 text-xs font-mono">
          <span className="text-sea-muted shrink-0">
            <span className="text-white">{shipCount.toLocaleString()}</span><span className="hidden sm:inline"> vessels</span>
          </span>
          <button
            disabled
            aria-label="통계 (준비 중)"
            title="통계 기능 준비 중"
            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded border border-sea-border text-sea-muted/40 opacity-50 cursor-not-allowed"
          >
            <span>📊</span>
            <span className="hidden sm:inline">통계</span>
          </button>
          <button
            onClick={toggleXCapital}
            aria-label="X Capital"
            data-tour="xcapital"
            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded border border-amber-600/40 hover:border-amber-500/70 hover:bg-amber-900/20 text-amber-500/80 hover:text-amber-300 transition-colors"
          >
            <span>💼</span>
            <span className="hidden sm:inline">X Capital</span>
          </button>
          <button
            onClick={toggleCountryLayer}
            aria-label="지정학 Fulcrum"
            title="지정학 Fulcrum — 국가별 제약·공급루트"
            className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded border transition-colors ${showCountryLayer ? 'border-purple-400/70 bg-purple-900/30 text-purple-200' : 'border-purple-600/40 hover:border-purple-500/70 hover:bg-purple-900/20 text-purple-400/80 hover:text-purple-300'}`}
          >
            <span>🌐</span>
            <span className="hidden sm:inline">지정학</span>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-sea-muted hidden sm:inline">{label}</span>
          </div>
        </div>
      </div>

      {/* 초크포인트 비교 수치 라인 */}
      {cpComparisons.length > 0 && (
        <div className="flex items-center gap-3 px-2 sm:px-4 pb-1.5 text-[10px] font-mono overflow-x-auto">
          <span className="text-white/20 shrink-0">통과량</span>
          {cpComparisons.map(c => (
            <CpChip key={c.cpId} {...c} />
          ))}
        </div>
      )}
    </header>
  );
}
