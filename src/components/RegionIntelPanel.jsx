import { useEffect, useState, useRef } from 'react';
import useStore from '../store/useStore.js';
import { REGION_DATA } from '../data/regionData.js';
import Sparkline from './Sparkline.jsx';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const TABS_BASE = [
  { id: 'stats',   label: '현황' },
  { id: 'history', label: '역사' },
  { id: 'news',    label: '뉴스' },
];
// 항만은 '선박 동향' 탭 추가 (현황 다음)
function tabsFor(type) {
  return type === 'port'
    ? [TABS_BASE[0], { id: 'traffic', label: '선박 동향' }, ...TABS_BASE.slice(1)]
    : TABS_BASE;
}

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

// z-score 배지 (평년 대비 표준편차 단위 편차 — 통계적 이상치)
function ZBadge({ z, higherIsBad }) {
  if (z == null) return null;
  const bad = higherIsBad ? z : -z; // 나쁜 방향일수록 큰 양수
  const color = bad > 2 ? 'text-red-400 bg-red-500/15'
    : bad > 1 ? 'text-yellow-400 bg-yellow-500/15'
    : 'text-white/50 bg-white/8';
  const sign = z > 0 ? '+' : '';
  return <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${color}`}>{sign}{z}σ</span>;
}

// 최근 추이 카드 — 스파크라인 + 추세 + z-score
const TREND_LABEL = { rising: '▲ 상승', falling: '▼ 하락', flat: '― 안정' };
function TrendCard({ hist, higherIsBad }) {
  if (!hist || hist.error) return null;
  const trendColor = hist.trend === 'rising'
    ? (higherIsBad ? 'text-red-400' : 'text-green-400')
    : hist.trend === 'falling'
    ? (higherIsBad ? 'text-green-400' : 'text-red-400')
    : 'text-white/50';
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">📈 최근 추이 (24h)</p>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-mono ${trendColor}`}>{TREND_LABEL[hist.trend]}</span>
          <ZBadge z={hist.z} higherIsBad={higherIsBad} />
        </div>
      </div>
      <Sparkline series={hist.series} baseline={hist.baseline} higherIsBad={higherIsBad} />
      {hist.has_dynamic === false && (
        <p className="text-[8px] text-white/25 font-mono">※ 평년 = 기준값 (이력 누적 중, {hist.n}표본)</p>
      )}
    </div>
  );
}

// 원자재 유입 추정 카드 (입항 선박 기준, 만재 가정)
function CommodityInflow({ ci }) {
  if (!ci) return null;
  const totalEst = (ci.est_liquid_dwt || 0) + (ci.est_dry_bulk_dwt || 0) + (ci.est_container_teu || 0) + (ci.est_lng_dwt || 0);
  if (totalEst <= 0) return null;
  const tons = (dwt) => (dwt >= 10000 ? `${(dwt / 10000).toFixed(1)}만 t` : `${(dwt || 0).toLocaleString()} t`);
  const cards = [
    { show: ci.tanker_ships > 0,    emoji: '🛢️', label: '원유·석유제품',        ships: ci.tanker_ships,    val: tons(ci.est_liquid_dwt) },
    { show: ci.bulk_ships > 0,      emoji: '⛏️', label: '건화물(광석·석탄·곡물)', ships: ci.bulk_ships,      val: tons(ci.est_dry_bulk_dwt) },
    { show: ci.container_ships > 0, emoji: '📦', label: '컨테이너',              ships: ci.container_ships, val: `${(ci.est_container_teu || 0).toLocaleString()} TEU` },
    { show: ci.lng_ships > 0,       emoji: '🔥', label: 'LNG',                  ships: ci.lng_ships,       val: tons(ci.est_lng_dwt) },
  ].filter(c => c.show);
  return (
    <div className="space-y-2">
      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">🛢️ 원자재 유입 추정 (입항 만재 가정)</p>
      <div className="grid grid-cols-2 gap-2">
        {cards.map(c => (
          <div key={c.label} className="bg-white/5 border border-white/10 rounded-lg p-2.5">
            <p className="text-[10px] text-white/60 leading-tight">{c.emoji} {c.label}</p>
            <p className="text-lg font-bold font-mono text-white leading-tight mt-0.5">{c.val}</p>
            <p className="text-[9px] text-white/35 font-mono">입항 {c.ships}척 추정</p>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-white/25 leading-snug">
        ※ 입항 선박 × 클래스 평균 DWT × 적재율 0.85의 거친 추정. 절대값보다 추세(🛢️ FLOW 리포트)에 의미.
      </p>
    </div>
  );
}

// 상태 세분화 가로 막대 (정박/대기/기동/항행)
const STATUS_COLOR = {
  berthed: 'bg-slate-400/70',
  waiting: 'bg-amber-400/70',
  maneuvering: 'bg-sky-400/70',
  transit: 'bg-emerald-400/70',
};
function StatusBreakdown({ items, total }) {
  const max = Math.max(1, ...items.map(i => i.count));
  return (
    <div className="space-y-1.5">
      {/* 누적 비율 바 */}
      <div className="flex h-2 rounded overflow-hidden bg-white/8">
        {items.map(i => i.count > 0 && (
          <div
            key={i.key}
            className={STATUS_COLOR[i.key] ?? 'bg-white/40'}
            style={{ width: `${total ? (i.count / total) * 100 : 0}%` }}
            title={`${i.label} ${i.count}척`}
          />
        ))}
      </div>
      {items.map(i => (
        <div key={i.key} className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-sm shrink-0 ${STATUS_COLOR[i.key] ?? 'bg-white/40'}`} />
          <span className="text-[10px] text-white/70 w-20 shrink-0">{i.label}</span>
          <div className="flex-1 h-1 bg-white/8 rounded overflow-hidden">
            <div className={`h-full rounded ${STATUS_COLOR[i.key] ?? 'bg-white/40'}`} style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-white/50 w-10 text-right">{i.count}척</span>
        </div>
      ))}
    </div>
  );
}

// 범용 분포 막대 (선종/기국/속력)
function DistBars({ rows, color = 'bg-blue-500/60' }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-white/70">{r.label}</span>
            <span className="text-white/40 font-mono">{r.count}척{r.pct != null ? ` (${r.pct}%)` : ''}</span>
          </div>
          <div className="h-1 bg-white/10 rounded overflow-hidden">
            <div className={`h-full rounded ${color}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
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
  const [hist, setHist] = useState(null);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const newsFetchedRef = useRef(false);

  const data = selectedRegion ? REGION_DATA[selectedRegion.id] : null;

  // 지역 변경 시 초기화
  useEffect(() => {
    setActiveTab('stats');
    setLiveStats(null);
    setHist(null);
    setNews(null);
    newsFetchedRef.current = false;

    if (!selectedRegion) return;

    const metric = selectedRegion.type === 'port' ? 'waiting_ships' : 'daily_throughput';
    const statsPath = selectedRegion.type === 'port'
      ? `port-stats?portId=${selectedRegion.id}`
      : `chokepoint-stats?cpId=${selectedRegion.id}`;

    fetch(`${PROXY_URL}/api/${statsPath}`)
      .then(r => r.json())
      .then(d => setLiveStats(d))
      .catch(() => {});

    fetch(`${PROXY_URL}/api/baseline-history?locationId=${selectedRegion.id}&metric=${metric}&hours=24`)
      .then(r => r.json())
      .then(d => setHist(d))
      .catch(() => {});
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
    <div className="absolute top-3 left-3 bottom-3 z-40 w-[26rem] max-w-[calc(100%-1.5rem)] flex flex-col pointer-events-none">
      {/* 패널 — 선박 상세와 동일한 좌측 떠 있는 카드 */}
      <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 pointer-events-auto">

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
            <div className="w-40 h-40 shrink-0 flex items-center justify-center">
              {character.image ? (
                <>
                  <img
                    src={character.image}
                    alt={character.nameEn}
                    className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
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
              {/* 명언 — 이미지 오른쪽 컬럼으로 이동 (선박 패널과 동일 구조) */}
              <div className="mt-2 pl-3 border-l-2 border-white/20">
                <p className="text-[11px] italic text-white/60 leading-relaxed">
                  {character.quote}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-white/10 bg-[#0C111F] shrink-0">
          {tabsFor(data.type).map(tab => (
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

                  {/* 항만: 대기 선박 비교 + 상태 세분화 */}
                  {data.type === 'port' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <p className="text-[9px] text-white/40 font-mono">현재 선박</p>
                          <p className="text-2xl font-bold font-mono text-white">{liveStats.total_ships}</p>
                          <p className="text-[9px] text-white/40">척</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <p className="text-[9px] text-white/40 font-mono">대기(정박+정박지)</p>
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
                      {liveStats.status_breakdown?.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">상태 세분화</p>
                          <StatusBreakdown items={liveStats.status_breakdown} total={liveStats.total_ships} />
                        </div>
                      )}
                      <TrendCard hist={hist} higherIsBad={true} />
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
                      <TrendCard hist={hist} higherIsBad={false} />
                    </>
                  )}

                  {/* 선종 분포 (초크포인트 — 항만은 '선박 동향' 탭으로 이동) */}
                  {data.type === 'chokepoint' && liveStats.vessel_type_dist?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">선종 분포</p>
                      <DistBars rows={liveStats.vessel_type_dist.slice(0, 4).map(v => ({ label: v.type, count: v.count, pct: v.pct }))} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 선박 동향 탭 (항만 전용) ── */}
          {activeTab === 'traffic' && (
            <div className="p-4 space-y-5">
              {!liveStats ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-white/40">실시간 집계 중...</p>
                </div>
              ) : (
                <>
                  {/* 입출항 추정 */}
                  <div className="space-y-2">
                    <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">🚢 입출항 추정 (항행 중 {liveStats.traffic?.moving ?? 0}척)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                        <p className="text-[9px] text-emerald-300/80 font-mono">⚓ 입항</p>
                        <p className="text-2xl font-bold font-mono text-emerald-300">{liveStats.traffic?.inbound ?? 0}</p>
                      </div>
                      <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3 text-center">
                        <p className="text-[9px] text-sky-300/80 font-mono">⬆ 출항</p>
                        <p className="text-2xl font-bold font-mono text-sky-300">{liveStats.traffic?.outbound ?? 0}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                        <p className="text-[9px] text-white/40 font-mono">↔ 통과</p>
                        <p className="text-2xl font-bold font-mono text-white/70">{liveStats.traffic?.passing ?? 0}</p>
                      </div>
                    </div>
                    <p className="text-[9px] text-white/25 leading-snug">
                      ※ AIS 항행상태·목적지 미수신 → 진행방향(COG)이 항구를 향하면 입항, 반대면 출항으로 추정. 정박·저속 선박 제외.
                    </p>
                  </div>

                  {/* 원자재 유입 추정 (입항 선박 기준) */}
                  {liveStats.commodity_inflow && <CommodityInflow ci={liveStats.commodity_inflow} />}

                  {/* 목적지 국가 분포 (destination 정규화) */}
                  {liveStats.dest_country_dist?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">목적지 국가 (표본 {liveStats.dest_samples}척)</p>
                      <DistBars rows={liveStats.dest_country_dist.map(d => ({ label: d.country, count: d.count, pct: d.pct }))} color="bg-emerald-500/60" />
                    </div>
                  )}

                  {/* 선종 분포 */}
                  {liveStats.vessel_type_dist?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">선종 분포</p>
                      <DistBars rows={liveStats.vessel_type_dist.slice(0, 6).map(v => ({ label: v.type, count: v.count, pct: v.pct }))} />
                    </div>
                  )}

                  {/* 기국 Top */}
                  {liveStats.flag_dist?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">기국 Top</p>
                      <DistBars rows={liveStats.flag_dist.slice(0, 6).map(f => ({ label: f.flag, count: f.count, pct: f.pct }))} color="bg-violet-500/60" />
                    </div>
                  )}

                  {/* 속력 분포 */}
                  {liveStats.speed_hist?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">속력 분포</p>
                      <DistBars rows={liveStats.speed_hist.map(s => ({ label: s.label, count: s.count }))} color="bg-cyan-500/60" />
                    </div>
                  )}

                  {/* 평균 흘수 */}
                  {liveStats.avg_draught != null && (
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-white/50 font-mono">평균 흘수</span>
                      <span className="text-[11px] text-white/80 font-mono">{liveStats.avg_draught}m <span className="text-white/30">({liveStats.draught_samples}척 표본)</span></span>
                    </div>
                  )}
                </>
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
