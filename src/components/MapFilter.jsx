import { useState } from 'react';
import useStore from '../store/useStore.js';

const VESSEL_TYPE_CONFIG = [
  { id: 'Container Ship', label: '컨테이너선', color: '#3B82F6' },
  { id: 'Tanker',         label: '탱커',       color: '#EF4444' },
  { id: 'Bulk Carrier',   label: '벌크선',     color: '#EAB308' },
  { id: 'LNG Carrier',    label: 'LNG선',      color: '#14B8A6' },
  { id: 'Passenger',      label: '여객선',     color: '#F97316' },
  { id: 'Fishing',        label: '어선',       color: '#22C55E' },
  { id: 'Special Craft',  label: '특수선',     color: '#8B5CF6' },
  { id: 'Other',          label: '기타',       color: '#9CA3AF' },
];

const ALL_VESSEL_TYPES = VESSEL_TYPE_CONFIG.map(v => v.id);

const FLAG_OPTIONS = [
  { code: 'KOR', label: '🇰🇷 KOR' },
  { code: 'CHN', label: '🇨🇳 CHN' },
  { code: 'JPN', label: '🇯🇵 JPN' },
  { code: 'USA', label: '🇺🇸 USA' },
  { code: 'SGP', label: '🇸🇬 SGP' },
  { code: 'GBR', label: '🇬🇧 GBR' },
  { code: 'DEU', label: '🇩🇪 DEU' },
  { code: 'NLD', label: '🇳🇱 NLD' },
  { code: 'LBR', label: '🇱🇷 LBR' },
  { code: 'PAN', label: '🇵🇦 PAN' },
  { code: 'RUS', label: '🇷🇺 RUS' },
  { code: 'ITA', label: '🇮🇹 ITA' },
  { code: 'FRA', label: '🇫🇷 FRA' },
  { code: 'AUS', label: '🇦🇺 AUS' },
  { code: 'IND', label: '🇮🇳 IND' },
  { code: 'ARE', label: '🇦🇪 ARE' },
];

export { VESSEL_TYPE_CONFIG, ALL_VESSEL_TYPES };

export default function MapFilter() {
  const { mapFilters, setMapFilter } = useStore();
  const [open, setOpen] = useState(false);

  function toggleVesselType(id) {
    const cur = mapFilters.vesselTypes;
    setMapFilter('vesselTypes', cur.includes(id) ? cur.filter(v => v !== id) : [...cur, id]);
  }

  function toggleFlag(code) {
    const cur = mapFilters.flagCountries;
    setMapFilter('flagCountries', cur.includes(code) ? cur.filter(f => f !== code) : [...cur, code]);
  }

  const activeFilters =
    (mapFilters.vesselTypes.length < ALL_VESSEL_TYPES.length ? 1 : 0) +
    (mapFilters.flagCountries.length > 0 ? 1 : 0) +
    (mapFilters.speedMax < 30 ? 1 : 0);

  return (
    <div className="absolute bottom-16 right-3 z-10">
      {/* 토글 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors flex items-center gap-1.5 ${
          open
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-black/70 border-white/20 text-white/80 hover:border-white/40'
        }`}
      >
        필터
        {activeFilters > 0 && (
          <span className="bg-blue-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {activeFilters}
          </span>
        )}
      </button>

      {/* 패널 */}
      {open && (
        <div className="absolute bottom-9 right-0 w-64 max-w-[calc(100vw-1.5rem)] bg-black/90 border border-white/20 rounded-xl p-3 space-y-3 shadow-2xl backdrop-blur-sm">
          {/* 선종 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-sea-muted font-mono uppercase tracking-wide">선박 유형</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMapFilter('vesselTypes', ALL_VESSEL_TYPES)}
                  className="text-[9px] text-blue-400 hover:text-blue-300"
                >전체</button>
                <span className="text-sea-muted text-[9px]">|</span>
                <button
                  onClick={() => setMapFilter('vesselTypes', [])}
                  className="text-[9px] text-sea-muted hover:text-white"
                >해제</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {VESSEL_TYPE_CONFIG.map(({ id, label, color }) => (
                <label key={id} className="flex items-center gap-1.5 cursor-pointer group">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity"
                    style={{
                      background: color,
                      opacity: mapFilters.vesselTypes.includes(id) ? 1 : 0.25,
                    }}
                  />
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={mapFilters.vesselTypes.includes(id)}
                    onChange={() => toggleVesselType(id)}
                  />
                  <span className={`text-[10px] truncate transition-colors ${
                    mapFilters.vesselTypes.includes(id) ? 'text-white' : 'text-sea-muted'
                  }`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 속도 필터 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-sea-muted font-mono uppercase tracking-wide">최대 속도</span>
              <span className="text-[10px] text-white font-mono">
                {mapFilters.speedMax >= 30 ? '전체' : `≤ ${mapFilters.speedMax}kt`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={mapFilters.speedMax}
              onChange={e => setMapFilter('speedMax', Number(e.target.value))}
              className="w-full h-1 accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-sea-muted mt-0.5">
              <span>정박</span>
              <span>30kt+</span>
            </div>
          </div>

          {/* 국기 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-sea-muted font-mono uppercase tracking-wide">국적</span>
              {mapFilters.flagCountries.length > 0 && (
                <button
                  onClick={() => setMapFilter('flagCountries', [])}
                  className="text-[9px] text-sea-muted hover:text-white"
                >전체 표시</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {FLAG_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => toggleFlag(code)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    mapFilters.flagCountries.includes(code)
                      ? 'border-blue-500/70 bg-blue-900/30 text-white'
                      : 'border-white/10 text-sea-muted hover:border-white/30 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
