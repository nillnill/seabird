import { useEffect, useState, useRef } from 'react';
import useStore from '../store/useStore.js';
import { REGION_DATA } from '../data/regionData.js';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const TABS = [
  { id: 'stats',   label: '현황' },
  { id: 'history', label: '역사' },
  { id: 'news',    label: '뉴스' },
];

function ComparisonGauge({ label, current, baseline, unit, higherIsBad = true }) {
  const pct = baseline > 0 ? Math.round(((current - baseline) / baseline) * 100) : 0;
  const ratio = baseline > 0 ? current / baseline : 1;
  const isCritical = higherIsBad ? ratio > 1.5 : ratio < 0.5;
  const isWarning  = higherIsBad ? ratio > 1.2 : ratio < 0.75;
  const barColor   = isCritical ? 'bg-red-500/70' : isWarning ? 'bg-yellow-400/70' : 'bg-blue-400/60';
  const textColor  = isCritical ? 'text-red-400'  : isWarning ? 'text-yellow-400'  : 'text-green-400';
  const sign = pct > 0 ? '+' : '';
  // bar fills based on ratio; baseline marker at 70% of bar width
  const fillPct = Math.min(Math.max(ratio * 70, 2), 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-white/50">{label}</span>
        <span className={`text-[11px] font-mono font-bold ${textColor}`}>{sign}{pct}%</span>
      </div>
      <div className="relative h-1.5 bg-white/8 rounded overflow-hidden">
        <div className={`h-full rounded transition-all ${barColor}`} style={{ width: `${fillPct}%` }} />
        <div className="absolute top-0 bottom-0 w-px bg-white/50" style={{ left: '70%' }} />
      </div>
      <div className="flex justify-between text-[9px] text-white/30 font-mono">
        <span>현재 {current}{unit}</span>
        <span>평년 {baseline}{unit}</span>
      </div>
    </div>
  );
}

function renderHistory(text) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;
    // bold markers **...**
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i} className="text-[11px] leading-relaxed text-white/80">
        {parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p
        )}
      </p>
    );
  });
}

export default function RegionIntelPanel() {
  const { selectedRegion, setSelectedRegion } = useStore();
  const [activeTab, setActiveTab] = useState('stats');
  const [liveStats, setLiveStats] = useState(null);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const newsFetchedRef = useRef(false);

  const data = selectedRegion ? REGION_DATA[selectedRegion.id] : null;

  // 지역 변경 시 초기화
  useEffect(() => {
    setActiveTab('stats');
    setLiveStats(null);
    setNews(null);
    newsFetchedRef.current = false;

    if (!selectedRegion) return;

    if (selectedRegion.type === 'port') {
      fetch(`${PROXY_URL}/api/port-stats?portId=${selectedRegion.id}`)
        .then(r => r.json())
        .then(d => setLiveStats(d))
        .catch(() => {});
    } else if (selectedRegion.type === 'chokepoint') {
      fetch(`${PROXY_URL}/api/chokepoint-stats?cpId=${selectedRegion.id}`)
        .then(r => r.json())
        .then(d => setLiveStats(d))
        .catch(() => {});
    }
  }, [selectedRegion?.id]);

  // 뉴스 탭 클릭 시 lazy fetch
  useEffect(() => {
    if (activeTab !== 'news' || !selectedRegion || newsFetchedRef.current) return;
    newsFetchedRef.current = true;
    setNewsLoading(true);
    fetch(`${PROXY_URL}/api/region-news?id=${selectedRegion.id}&type=${selectedRegion.type}`)
      .then(r => r.json())
      .then(d => setNews(d))
      .catch(() => setNews({ error: '뉴스를 불러올 수 없습니다.' }))
      .finally(() => setNewsLoading(false));
  }, [activeTab, selectedRegion?.id]);

  if (!selectedRegion || !data) return null;

  const { character, stats, history } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setSelectedRegion(null)}
      />

      {/* 패널 */}
      <div className="relative w-full max-w-xl mx-4 max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        {/* 캐릭터 헤더 */}
        <div
          className="relative flex-shrink-0 px-6 pt-6 pb-4"
          style={{ background: `linear-gradient(135deg, ${character.bgFrom} 0%, ${character.bgTo} 100%)` }}
        >
          {/* 닫기 */}
          <button
            onClick={() => setSelectedRegion(null)}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 text-white/60 hover:text-white hover:bg-black/50 transition-colors text-sm"
          >
            ✕
          </button>

          {/* 장식 테두리 */}
          <div className="absolute inset-0 border-b border-white/10 pointer-events-none" />
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }}
          />

          {/* 캐릭터 이미지 or 국기+심볼 */}
          <div className="flex items-start gap-4">
            <div className="w-40 h-40 shrink-0 rounded-xl overflow-hidden border border-white/20 bg-black/30 flex items-center justify-center">
              {character.image ? (
                <>
                  <img
                    src={character.image}
                    alt={character.nameEn}
                    className="w-full h-full object-cover"
                    onError={e => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <span className="text-7xl hidden items-center justify-center w-full h-full">
                    {character.flagEmoji}
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-6xl">{character.flagEmoji}</span>
                  <span className="text-3xl opacity-60">{character.symbolEmoji}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2
                className="text-xl font-bold text-white tracking-widest"
                style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)', fontFamily: 'serif' }}
              >
                {character.name}
              </h2>
              <p className="text-[10px] text-white/50 font-mono mt-0.5 uppercase tracking-wider">
                {character.nameEn}
              </p>
              <p className="text-[11px] text-white/70 mt-1 leading-snug">
                {character.title}
              </p>
            </div>
          </div>

          {/* 명언 */}
          <div className="mt-3 pl-4 border-l-2 border-white/20">
            <p className="text-[11px] italic text-white/60 leading-relaxed">
              {character.quote}
            </p>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-white/10 bg-[#0C111F] shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-mono tracking-wide transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500 bg-blue-500/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto bg-[#0C111F]">

          {/* ── 현황 탭 ── */}
          {activeTab === 'stats' && (
            <div className="p-4 space-y-4">
              {/* 글로벌 통계 */}
              <div>
                <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-2">📊 글로벌 통계</p>
                <table className="w-full text-[11px]">
                  <tbody className="divide-y divide-white/5">
                    {[
                      ['세계 순위', stats.worldRank],
                      data.type === 'chokepoint'
                        ? ['일일 통과', stats.dailyShips]
                        : ['연간 처리량', stats.annualTeu],
                      data.type === 'chokepoint'
                        ? ['연간 통과', stats.annualShips]
                        : ['선석', stats.berths],
                      ['무역 비중', stats.tradeShare],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="py-1.5 pr-3 text-white/40 font-mono w-24 shrink-0">{k}</td>
                        <td className="py-1.5 text-white font-medium">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 주요 화물 */}
              <div>
                <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-2">📦 주요 화물</p>
                <div className="flex flex-wrap gap-1.5">
                  {stats.topCargoes.map(c => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/70">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* 주요 이용국 */}
              <div>
                <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-2">🌏 주요 이용국</p>
                <div className="flex flex-wrap gap-2">
                  {stats.keyUsers.map(u => (
                    <span key={u} className="text-[11px] text-white/80">{u}</span>
                  ))}
                </div>
              </div>

              {/* 실시간 현황 + 비교 수치 */}
              {liveStats && (
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">📡 실시간 현황 vs 평년</p>

                  {/* 항만: 대기 선박 비교 */}
                  {data.type === 'port' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <p className="text-[9px] text-white/40 font-mono">현재 선박</p>
                          <p className="text-2xl font-bold font-mono text-white">{liveStats.total_ships}</p>
                          <p className="text-[9px] text-white/40">척</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <p className="text-[9px] text-white/40 font-mono">대기 선박</p>
                          <p className="text-2xl font-bold font-mono text-white">{liveStats.waiting_ships}</p>
                          <p className="text-[9px] text-white/40">평년 {liveStats.baseline_waiting}척</p>
                        </div>
                      </div>
                      <ComparisonGauge
                        label="대기 선박 vs 평년"
                        current={liveStats.waiting_ships}
                        baseline={liveStats.baseline_waiting}
                        unit="척"
                        higherIsBad={true}
                      />
                    </>
                  )}

                  {/* 초크포인트: 통과량 비교 */}
                  {data.type === 'chokepoint' && (
                    <>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-[9px] text-white/40 font-mono">현재 통과 선박 (1h)</p>
                        <p className="text-3xl font-bold font-mono text-white">{liveStats.current_ships}</p>
                        <p className="text-[9px] text-white/40">척</p>
                      </div>
                      <ComparisonGauge
                        label="통과량 vs 평년"
                        current={liveStats.current_ships}
                        baseline={liveStats.baseline}
                        unit="척"
                        higherIsBad={false}
                      />
                    </>
                  )}

                  {/* 선종 분포 */}
                  {liveStats.vessel_type_dist?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">선종 분포</p>
                      {liveStats.vessel_type_dist.slice(0, 4).map(({ type, count, pct }) => (
                        <div key={type} className="space-y-0.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-white/70">{type}</span>
                            <span className="text-white/40 font-mono">{count}척 ({pct}%)</span>
                          </div>
                          <div className="h-0.5 bg-white/10 rounded overflow-hidden">
                            <div className="h-full bg-blue-500/60 rounded" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 역사 탭 ── */}
          {activeTab === 'history' && (
            <div className="p-4 space-y-1">
              {renderHistory(history)}
            </div>
          )}

          {/* ── 뉴스 탭 ── */}
          {activeTab === 'news' && (
            <div className="p-4">
              {newsLoading && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-white/40 animate-pulse">Perplexity AI 실시간 검색 중...</p>
                </div>
              )}

              {!newsLoading && news?.error && (
                <p className="text-[11px] text-red-400 py-4 text-center">{news.error}</p>
              )}

              {!newsLoading && news && !news.error && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
                      {news.source === 'perplexity' ? '⚡ Perplexity AI 실시간' : '📰 NewsAPI'}
                    </span>
                    {news.source === 'perplexity' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">LIVE</span>
                    )}
                  </div>

                  {news.source === 'perplexity' && news.content && (
                    <div className="text-[11px] text-white/80 leading-relaxed whitespace-pre-wrap space-y-1">
                      {news.content.split('\n').map((line, i) => {
                        if (!line.trim()) return <div key={i} className="h-1" />;
                        const parts = line.split(/\*\*(.*?)\*\*/g);
                        return (
                          <p key={i} className="leading-relaxed">
                            {parts.map((p, j) =>
                              j % 2 === 1
                                ? <strong key={j} className="text-white font-semibold">{p}</strong>
                                : p
                            )}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {news.source === 'newsapi' && news.items?.map((item, i) => (
                    <div key={i} className="border border-white/8 rounded-lg p-3 space-y-1 hover:border-white/15 transition-colors">
                      <p className="text-[11px] text-white font-medium leading-snug">{item.title}</p>
                      {item.description && (
                        <p className="text-[10px] text-white/50 leading-snug line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-[9px] text-white/30 font-mono">
                        {item.source} · {item.publishedAt?.slice(0, 16).replace('T', ' ')}
                      </p>
                    </div>
                  ))}

                  {news.source === 'newsapi' && (!news.items || news.items.length === 0) && (
                    <p className="text-[11px] text-white/30 py-4 text-center">최근 뉴스가 없습니다</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
