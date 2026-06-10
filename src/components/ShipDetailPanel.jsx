import { useEffect, useState } from 'react';
import useStore from '../store/useStore.js';
import { runCargoEstimator } from '../agents/cargoEstimator.js';

export default function ShipDetailPanel() {
  const { selectedShip, setSelectedShip } = useStore();
  const [cargoResult, setCargoResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedShip) {
      setCargoResult(null);
      return;
    }
    setCargoResult(null);
    setError(null);
    setLoading(true);
    runCargoEstimator(selectedShip.mmsi)
      .then((r) => setCargoResult(r))
      .catch(() => setError('추정 불가 — 데이터 부족'))
      .finally(() => setLoading(false));
  }, [selectedShip?.mmsi]);

  if (!selectedShip) return null;

  return (
    <div className="absolute bottom-10 left-4 w-72 bg-sea-panel border border-sea-border rounded-xl shadow-2xl z-10 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-start justify-between p-3 border-b border-sea-border">
        <div>
          <p className="text-sm font-bold text-white">
            {selectedShip.ship_name || '선명 미상'}
          </p>
          <p className="text-[10px] font-mono text-sea-muted">
            MMSI {selectedShip.mmsi} · {selectedShip.vessel_type}
          </p>
          {selectedShip.destination && (
            <p className="text-[10px] text-sea-muted mt-0.5">→ {selectedShip.destination}</p>
          )}
        </div>
        <button
          onClick={() => setSelectedShip(null)}
          className="text-sea-muted hover:text-white text-sm ml-2"
        >
          ✕
        </button>
      </div>

      {/* 속도/위치 */}
      <div className="grid grid-cols-3 gap-0 border-b border-sea-border">
        {[
          { label: 'SPEED', value: `${selectedShip.speed ?? '-'} kn` },
          { label: 'LAT', value: selectedShip.lat?.toFixed(3) ?? '-' },
          { label: 'LNG', value: selectedShip.lng?.toFixed(3) ?? '-' },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2 text-center">
            <p className="text-[9px] text-sea-muted font-mono">{label}</p>
            <p className="text-xs font-mono text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* 화물 추정 */}
      <div className="p-3">
        <p className="text-[10px] text-sea-muted font-mono mb-2">📦 CARGO ESTIMATOR</p>
        {loading && (
          <div className="text-xs text-sea-muted animate-pulse">분석 중...</div>
        )}
        {error && (
          <div className="text-xs text-red-400">{error}</div>
        )}
        {cargoResult && (
          <div className="space-y-2">
            <p className="text-[10px] text-sea-muted">
              추정 적재: <span className="text-white font-mono">{cargoResult.estimated_load_tons?.toLocaleString()}t</span>
              {' '}({cargoResult.load_ratio_pct}%)
              {' '}· 신뢰도: <span className="text-white">{cargoResult.confidence}</span>
            </p>
            {cargoResult.cargo_distribution?.slice(0, 4).map((item, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-white truncate pr-2">{item.item}</span>
                  <span className="font-mono text-sea-muted shrink-0">{item.probability_pct}%</span>
                </div>
                <div className="h-1 bg-sea-bg rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500/60 rounded"
                    style={{ width: `${item.probability_pct}%` }}
                  />
                </div>
                {item.annotation && (
                  <p className="text-[9px] text-sea-muted leading-tight">{item.annotation}</p>
                )}
              </div>
            ))}
            {cargoResult.disclaimer && (
              <p className="text-[9px] text-sea-muted leading-tight border-t border-sea-border pt-2">
                {cargoResult.disclaimer}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
