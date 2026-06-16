import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import useStore from '../store/useStore.js';
import { INVESTMENT_PERSONAS, PERSONA_ORDER } from '../data/investmentCharacters.js';
import { SERIES_META, SERIES_ORDER } from '../data/xcapGlossary.js';
import DeskDetailsModal from './DeskDetailsModal.jsx';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const SIGNAL_CONFIG = {
  LONG:  { label: '🟢 LONG',  cls: 'text-green-400 border-green-500/50 bg-green-900/20' },
  SHORT: { label: '🔴 SHORT', cls: 'text-red-400 border-red-500/50 bg-red-900/20' },
  HOLD:  { label: '⚪ HOLD',  cls: 'text-slate-300 border-slate-500/40 bg-slate-700/20' },
};

// 지표 신뢰도 배지 — live(실측)·estimate(기준추정)·demo(축적 중). DeskDetailsModal도 재사용.
export function ModeBadge({ mode }) {
  const cfg = {
    live:     { t: '실시간',   c: 'text-green-400 bg-green-900/30 border-green-500/40' },
    estimate: { t: '기준추정', c: 'text-blue-300 bg-blue-900/30 border-blue-500/40' },
    demo:     { t: '축적 중',  c: 'text-amber-300 bg-amber-900/30 border-amber-500/40' },
  }[mode] ?? { t: mode, c: 'text-sea-muted bg-sea-bg border-sea-border' };
  return <span className={`text-[8px] font-mono px-1 py-0.5 rounded border ${cfg.c}`}>{cfg.t}</span>;
}

function CharImg({ persona, className }) {
  const [err, setErr] = useState(false);
  if (err) {
    return <span className={`${className} flex items-center justify-center text-3xl bg-black/30`}>{persona.symbolEmoji}</span>;
  }
  return <img src={persona.image} alt={persona.name} onError={() => setErr(true)} className={`${className} object-cover`} />;
}

function StatChip({ label, value, mode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-black/30 rounded px-2 py-1.5 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] text-white/45 truncate">{label}</span>
        {mode && <ModeBadge mode={mode} />}
      </div>
      <span className="text-white text-xs font-mono font-semibold truncate">{value}</span>
    </div>
  );
}

function PersonaCard({ deskKey, quant, narrative, selected, onSelect, onDetails }) {
  const p = INVESTMENT_PERSONAS[deskKey];
  if (!p) return null;
  const sig = SIGNAL_CONFIG[narrative?.signal] ?? SIGNAL_CONFIG.HOLD;
  const cong = quant?.congestion ?? {};
  const inflow = quant?.inflow ?? {};
  const freight = quant?.freight ?? {};
  const dwell = quant?.dwell ?? {};
  const kor = quant?.korStats ?? null;
  const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString());
  const momTxt = (v) => (v == null ? '' : ` ${v > 0 ? '▲' : v < 0 ? '▼' : ''}${Math.abs(v)}%`);
  const korYm = kor?.latest_ym ? `${kor.latest_ym.slice(0, 4)}.${kor.latest_ym.slice(4)}` : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(deskKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(deskKey); } }}
      className={`text-left rounded-xl overflow-hidden border transition-all cursor-pointer ${
        selected ? 'border-amber-400/70 ring-1 ring-amber-400/40' : 'border-white/10 hover:border-white/30'
      }`}
    >
      {/* 캐릭터 헤더 */}
      <div className="flex items-stretch gap-3 p-3" style={{ background: `linear-gradient(135deg, ${p.bgFrom} 0%, ${p.bgTo} 100%)` }}>
        <CharImg persona={p} className="w-20 h-20 shrink-0 rounded-lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-white truncate">{p.name}</span>
            <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${sig.cls}`}>{sig.label}</span>
          </div>
          <p className="text-[10px] text-white/55">{p.title}</p>
          <p className="text-[10px] italic text-white/45 mt-1 border-l-2 border-white/15 pl-2 line-clamp-2">{p.quote}</p>
        </div>
      </div>

      <div className="p-3 space-y-2 bg-black/40">
        {/* thesis + 판단 근거 — 길어지면 카드 내부에서만 스크롤(전체 카드 높이 고정) */}
        <div className="max-h-[6rem] overflow-y-auto pr-1 space-y-1.5 [scrollbar-width:thin]">
          <p className="text-[11px] text-white/80 leading-snug">
            {narrative?.thesis ?? p.blurb}
            {narrative?.conviction && <span className="text-white/40 font-mono"> · 확신 {narrative.conviction}</span>}
          </p>
          {narrative?.drivers?.length > 0 && (
            <ul className="space-y-0.5">
              {narrative.drivers.map((x, i) => (
                <li key={i} className="text-[10px] text-white/55 flex gap-1 leading-snug">
                  <span className="text-white/30 shrink-0">·</span><span>{x}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {narrative?.drivers?.length > 0 && (
          <p className="text-[9px] text-white/30 -mt-1">↕ 근거 스크롤 · 전체 전략은 "자세히"</p>
        )}

        {/* 정량 지표 칩 (2×2) */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatChip label="혼잡지수(평년100)" value={cong.index ?? '–'} mode={cong.mode} />
          <StatChip label={inflow.label ?? '유입'} value={`${fmt(inflow.value)} ${inflow.unit ?? ''}`} mode={inflow.mode} />
          <StatChip
            label="평균 체류시간"
            value={dwell.avg_hours != null ? `${fmt(dwell.avg_hours)}h · 회전 ${dwell.turnover_per_day ?? '–'}/일` : '–'}
            mode={dwell.mode}
          />
          <StatChip label={freight.label ?? '운임'} value={freight.current != null ? `${fmt(freight.current)} ${freight.unit ?? ''}` : '–'} mode={freight.mode} />
        </div>

        {/* 해양수산부 월별 공식 통계 (AIS 사각지대 국내항 보완) */}
        {kor && (kor.vessel_calls != null || kor.cargo != null) && (
          <div className="flex items-center justify-between gap-2 bg-cyan-950/30 border border-cyan-500/20 rounded px-2 py-1.5">
            <span className="text-[9px] text-cyan-300/80 shrink-0">🇰🇷 해수부 공식{korYm ? ` ${korYm}` : ''}</span>
            <span className="text-[10px] font-mono text-white/85 truncate text-right">
              {kor.vessel_calls != null && <>입항 {fmt(kor.vessel_calls)}척{momTxt(kor.vessel_mom)}</>}
              {kor.cargo != null && <span className="text-white/55"> · {kor.cargo_label} {fmt(Math.round(kor.cargo / 10000))}만{momTxt(kor.cargo_mom)}</span>}
              {kor.sea_density != null && <span className="text-cyan-200/70"> · 해역밀집 {fmt(kor.sea_density)}</span>}
            </span>
          </div>
        )}

        {/* watch + 종목 */}
        {narrative?.watch?.length > 0 && (
          <p className="text-[10px] text-white/45">👁 {narrative.watch.join(' · ')}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 min-w-0">
            {(p.equities ?? []).map(e => (
              <span key={e} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/10">{e}</span>
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDetails(deskKey); }}
            className="shrink-0 text-[10px] font-mono px-2 py-1 rounded border border-sea-border text-sea-muted hover:text-white hover:border-white/30 transition-colors"
          >
            자세히 →
          </button>
        </div>
      </div>
    </div>
  );
}

// 차트 툴팁 — 지수 모드라도 항상 원본값 표시(payload.payload에서 원본 읽음).
function ChartTooltip({ active, payload, label, units }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-sea-panel border border-sea-border rounded px-2 py-1.5 text-[10px] font-mono">
      <p className="text-white/70 mb-0.5">{label}</p>
      {payload.map(p => {
        const k = String(p.dataKey).replace(/_i$/, '');
        const raw = p.payload?.[k];
        return (
          <p key={p.dataKey} style={{ color: p.color }}>
            {SERIES_META[k]?.label ?? p.name}: {raw == null ? '–' : Number(raw).toLocaleString()} {units?.[SERIES_META[k]?.unitKey] ?? ''}
          </p>
        );
      })}
    </div>
  );
}

export default function XCapitalSpace() {
  const { toggleXCapital, reports } = useStore();
  const [data, setData] = useState(null);   // /api/xcap/desks
  const [selected, setSelected] = useState('axelrod');
  const [seriesCache, setSeriesCache] = useState({}); // deskKey → desk-series payload
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState('index'); // 'index'(시작=100) | 'raw'(원본값)
  const [visible, setVisible] = useState(() => new Set(SERIES_ORDER));
  const [detailsKey, setDetailsKey] = useState(null);

  // 최신 INVESTMENT_ANALYST 보고 → 서술(narrative) + 병합 데스크
  const latestReport = useMemo(
    () => reports.find(r => r.agent_id === 'INVESTMENT_ANALYST') ?? null,
    [reports]
  );
  const narratives = useMemo(() => {
    const arr = latestReport?.raw_data?.desks ?? [];
    return Object.fromEntries(arr.map(d => [d.key, d]));
  }, [latestReport]);

  const fetchDesks = useCallback(() => {
    setLoading(true);
    setSeriesCache({}); // 새로고침 시 시계열 캐시도 비움
    fetch(`${PROXY_URL}/api/xcap/desks`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDesks(); }, [fetchDesks]);

  // 선택 데스크 시계열 로드(키별 캐시)
  useEffect(() => {
    if (seriesCache[selected]) return;
    let alive = true;
    fetch(`${PROXY_URL}/api/xcap/desk-series?key=${selected}&days=30`)
      .then(r => r.json())
      .then(d => { if (alive) setSeriesCache(c => ({ ...c, [selected]: d })); })
      .catch(() => { if (alive) setSeriesCache(c => ({ ...c, [selected]: { series: [], units: {}, modes: {}, freight: {} } })); });
    return () => { alive = false; };
  }, [selected, seriesCache]);

  // ESC 닫기 — 자세히 모달이 열려 있으면 모달만 닫고 공간은 유지
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      if (detailsKey) setDetailsKey(null);
      else toggleXCapital();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [toggleXCapital, detailsKey]);

  const quantByKey = useMemo(() => {
    const arr = data?.desks ?? [];
    return Object.fromEntries(arr.map(d => [d.key, d]));
  }, [data]);

  const selectedQuant = quantByKey[selected] ?? narratives[selected];
  const series = seriesCache[selected] ?? null;
  const seriesLoading = !series;

  // 차트 행: 원본값 + 시작=100 지수값(`${k}_i`) 동시 보유
  const chartRows = useMemo(() => {
    const s = series?.series ?? [];
    if (!s.length) return [];
    const bases = {};
    for (const k of SERIES_ORDER) {
      const first = s.find(r => r[k] != null);
      bases[k] = first ? first[k] : null;
    }
    return s.map(r => {
      const out = { date: r.date.slice(5) };
      for (const k of SERIES_ORDER) {
        out[k] = r[k];
        out[`${k}_i`] = (r[k] != null && bases[k]) ? Math.round((r[k] / bases[k]) * 1000) / 10 : null;
      }
      return out;
    });
  }, [series]);

  const toggleSeries = (k) => setVisible(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const mode = data?.mode ?? latestReport?.raw_data?.mode ?? 'demo';
  const globalBadge = {
    live:     { t: '🟢 실시간 데이터', c: 'text-green-300 border-green-500/40 bg-green-900/20' },
    estimate: { t: '🔵 일부 기준추정', c: 'text-blue-300 border-blue-500/40 bg-blue-900/20' },
    demo:     { t: '🟡 데모 모드 · 데이터 축적 중', c: 'text-amber-300 border-amber-500/40 bg-amber-900/20' },
  }[mode] ?? { t: mode, c: '' };

  const corr = selectedQuant?.correlation;
  const accent = INVESTMENT_PERSONAS[selected]?.accent ?? '#F59E0B';
  const units = series?.units ?? {};
  const freightDemo = series?.modes?.freight === 'demo';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 사무실 배경 — 뷰포트 고정(스크롤해도 항상 콘텐츠 뒤를 덮음) */}
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url('/characters/xcap_office.webp')" }} />
      <div className="fixed inset-0 z-0 bg-sea-bg/88 backdrop-blur-sm" />

      <div className="relative z-10">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-sea-panel/90 backdrop-blur border-b border-sea-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-mono font-bold tracking-widest text-amber-300">💼 X CAPITAL</span>
            <span className="text-[11px] text-sea-muted hidden sm:block">해양 대안데이터 투자 데스크</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${globalBadge.c}`}>{globalBadge.t}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchDesks} className="text-[10px] font-mono text-sea-muted hover:text-white px-2 py-1 rounded border border-sea-border hover:border-white/30 transition-colors">새로고침</button>
            <button onClick={toggleXCapital} className="w-7 h-7 flex items-center justify-center rounded-lg border border-sea-border hover:bg-white/10 text-sea-muted hover:text-white transition-colors text-sm">✕</button>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-6 py-5 space-y-5">
          {/* 헤드라인 */}
          {latestReport?.summary && (
            <p className="text-sm text-white/85 border-l-2 border-amber-500/60 pl-3">{latestReport.summary}</p>
          )}
          {loading && <p className="text-[11px] font-mono text-sea-muted animate-pulse">데스크 신호 집계 중…</p>}

          {/* 3 페르소나 카드 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PERSONA_ORDER.map(k => (
              <PersonaCard
                key={k}
                deskKey={k}
                quant={quantByKey[k]}
                narrative={narratives[k]}
                selected={selected === k}
                onSelect={setSelected}
                onDetails={setDetailsKey}
              />
            ))}
          </div>

          {/* 선택 데스크 시계열 차트 */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <span className="text-xs font-semibold text-white/80">
                {INVESTMENT_PERSONAS[selected]?.desk} — 혼잡·입항·유입·체류·운임 시계열
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/50">
                  {corr?.mode === 'live'
                    ? `혼잡→운임 r=${corr.r} · 시차 ${corr.lag}일`
                    : '혼잡→운임 상관: 축적 중'}
                </span>
                {/* 지수/원본 토글 */}
                <div className="flex rounded border border-sea-border overflow-hidden">
                  {[['index', '지수(시작=100)'], ['raw', '원본값']].map(([m, t]) => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`text-[9px] font-mono px-2 py-1 transition-colors ${chartMode === m ? 'bg-white/15 text-white' : 'text-sea-muted hover:text-white'}`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 지표 토글 칩 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SERIES_ORDER.map(k => {
                const m = SERIES_META[k];
                const on = visible.has(k);
                const color = k === 'freight' ? accent : m.color;
                return (
                  <button
                    key={k}
                    onClick={() => toggleSeries(k)}
                    className={`flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${on ? 'text-white bg-white/5' : 'text-sea-muted'}`}
                    style={{ borderColor: on ? color : 'rgba(255,255,255,0.12)' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: on ? color : 'transparent', border: `1px solid ${color}` }} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {seriesLoading ? (
              <div className="h-64 flex items-center justify-center text-[11px] font-mono text-sea-muted animate-pulse">차트 로드 중…</div>
            ) : chartRows.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[11px] font-mono text-white/40">시계열 데이터 축적 중…</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="l" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} />
                  {chartMode === 'raw' && (
                    <YAxis yAxisId="r" orientation="right" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} />
                  )}
                  <Tooltip content={<ChartTooltip units={units} />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {SERIES_ORDER.filter(k => visible.has(k)).map(k => {
                    const m = SERIES_META[k];
                    const dataKey = chartMode === 'index' ? `${k}_i` : k;
                    const axis = chartMode === 'index' ? 'l' : m.axis;
                    const color = k === 'freight' ? accent : m.color;
                    return (
                      <Line key={k} yAxisId={axis} type={m.step ? 'stepAfter' : 'monotone'} dataKey={dataKey} name={m.label}
                        stroke={color} dot={false} strokeWidth={1.8} strokeDasharray={m.official ? '5 3' : undefined} connectNulls />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
              <p className="text-[10px] text-white/40">
                {chartMode === 'index'
                  ? '※ 각 지표를 시작일=100으로 지수화해 한 축에서 추세를 비교합니다. 원본 수치는 툴팁·자세히 표 참조.'
                  : '※ 운임은 우측 축, 나머지는 좌측 축의 원본 수치입니다.'}
              </p>
              {freightDemo && (
                <p className="text-[10px] text-amber-300/70 font-mono">⚠ 운임 시계열 축적 중 — KOBC 백필 완료 시 표시</p>
              )}
            </div>
          </div>

          <p className="text-[10px] text-white/35 leading-relaxed">
            ※ X Capital은 Seabird 해양 대안데이터(항만 혼잡·입항·원자재 유입 추정·체류시간)와 KOBC 운임·선가 지수를 결합한 <b>실험적 투자 인텔리전스</b>입니다.
            절대 수치는 거친 추정이며 투자 자문이 아닙니다. 페르소나는 드라마 <i>Billions</i> 모티프의 창작 캐릭터입니다.
          </p>
        </div>
      </div>

      {detailsKey && (
        <DeskDetailsModal deskKey={detailsKey} seed={seriesCache[detailsKey]} narrative={narratives[detailsKey]} korStats={quantByKey[detailsKey]?.korStats} onClose={() => setDetailsKey(null)} />
      )}
    </div>
  );
}
