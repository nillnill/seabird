import { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore.js';
import { COUNTRY_DATA, COMMODITIES } from '../data/countryData.js';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const CONSTRAINTS = [
  { key: 'political',   label: '정치·정치경제', emoji: '🏛️' },
  { key: 'market',      label: '거시·시장',     emoji: '📉' },
  { key: 'geopolitics', label: '지정학',        emoji: '🌐' },
  { key: 'legal',       label: '헌법·법률',     emoji: '⚖️' },
];
const DIR = {
  tightening: { t: '긴장 ↑', c: 'text-red-300 bg-red-900/40 border-red-500/50' },
  loosening:  { t: '완화 ↓', c: 'text-green-300 bg-green-900/40 border-green-500/50' },
  stable:     { t: '안정 —', c: 'text-slate-300 bg-slate-700/40 border-slate-500/40' },
};
// 출처 배지: 공식자료=초록, Perplexity/현지=노랑
const sourceBadge = (src = '') => {
  const official = /WorldBank|OECD|UNComtrade|EIA|USGS|IMF|WTO|EIU/i.test(src);
  return official
    ? { t: src, c: 'text-green-300 bg-green-900/30 border-green-500/40' }
    : { t: src || '추정', c: 'text-amber-300 bg-amber-900/30 border-amber-500/40' };
};

function FactRow({ f }) {
  const b = sourceBadge(f.source);
  return (
    <div className="border-b border-white/5 py-2">
      <p className="text-[12px] text-white/85 leading-snug">{f.fact}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {f.value != null && (
          <span className="text-[11px] font-mono text-cyan-200/90">{Number(f.value).toLocaleString()}{f.unit ? ` ${f.unit}` : ''}</span>
        )}
        <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${b.c}`}>{b.t}</span>
        {f.as_of && <span className="text-[9px] text-white/40 font-mono">{String(f.as_of).slice(0, 10)}</span>}
      </div>
    </div>
  );
}

// ⚡ 에너지 탭 — 자립도·1차에너지 구조·발전 믹스·발전소 설비·전기요금 (domain='energy' indicators)
const FUEL_COLOR = { coal: '#64748B', gas: '#38BDF8', oil: '#FB923C', nuclear: '#A78BFA', hydro: '#22D3EE', solar: '#FACC15', wind: '#34D399', bio: '#84CC16', otherfossil: '#9CA3AF', otherrenew: '#4ADE80', fossil: '#EF4444', lowcarbon: '#22C55E', renew: '#34D399' };
const FUEL_KO = { coal: '석탄', gas: '가스', oil: '석유', nuclear: '원자력', hydro: '수력', solar: '태양광', wind: '풍력', bio: '바이오', otherfossil: '기타화석', otherrenew: '기타재생', fossil: '화석', lowcarbon: '저탄소', renew: '재생' };

function Bar({ label, pct, color, right }) {
  return (
    <div className="mb-1">
      <div className="flex justify-between text-[11px]"><span className="text-white/80">{label}</span><span className="font-mono text-white/70">{right}</span></div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-0.5"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>
    </div>
  );
}

function EnergyTab({ indicators }) {
  const byKey = {};
  for (const r of indicators) byKey[r.metric_key] = r;
  const v = (k) => byKey[k]?.value;
  const asof = (k) => byKey[k]?.as_of ? String(byKey[k].as_of).slice(0, 4) : '';
  const src = (k) => byKey[k]?.source || '';
  const has = indicators.some(r => r.domain === 'energy');
  if (!has && v('energy_import_dep') == null) return <p className="text-white/40 text-sm">에너지 데이터가 아직 없습니다(배치 대기).</p>;

  const importDep = v('energy_import_dep');
  const selfSuff = importDep != null ? Math.round((100 - importDep) * 10) / 10 : null;
  const genFuels = ['coal', 'gas', 'nuclear', 'hydro', 'solar', 'wind', 'bio', 'otherfossil'].filter(k => v(`elec_gen_${k}_pct`) != null);
  const capFuels = ['coal', 'gas', 'nuclear', 'hydro', 'solar', 'wind', 'bio'].filter(k => v(`capacity_${k}_gw`) != null);
  const capTotal = v('capacity_total_gw');
  const Section = ({ title, sub, children }) => (
    <div className="mb-4"><p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">{title}{sub ? <span className="text-white/30 normal-case"> · {sub}</span> : ''}</p>{children}</div>
  );

  return (
    <div>
      {selfSuff != null && (
        <Section title="에너지 자립도" sub={`${src('energy_import_dep')||'WorldBank'} ${asof('energy_import_dep')}`}>
          <Bar label="자립도(생산/소비)" pct={selfSuff} color={selfSuff >= 50 ? '#22C55E' : '#F59E0B'} right={`${selfSuff}%`} />
          <p className="text-[10px] text-white/45 mt-0.5">수입의존 {importDep}% → 자립도 {selfSuff}% (높을수록 해상 수입 충격에 강함)</p>
        </Section>
      )}
      {v('primary_fossil_pct') != null && (
        <Section title="1차에너지 구조" sub={`OWID ${asof('primary_fossil_pct')}`}>
          {['fossil', 'lowcarbon'].map(k => v(`primary_${k}_pct`) != null && <Bar key={k} label={FUEL_KO[k]} pct={v(`primary_${k}_pct`)} color={FUEL_COLOR[k]} right={`${v(`primary_${k}_pct`)}%`} />)}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {['coal', 'gas', 'oil', 'nuclear', 'hydro', 'renew'].map(k => v(`primary_${k}_pct`) != null && (
              <span key={k} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10" style={{ color: FUEL_COLOR[k] }}>{FUEL_KO[k]} {v(`primary_${k}_pct`)}%</span>
            ))}
          </div>
        </Section>
      )}
      {genFuels.length > 0 && (
        <Section title="발전 믹스" sub={`Ember ${asof('elec_gen_gas_pct') || asof('elec_gen_coal_pct')}`}>
          {genFuels.sort((a, b) => v(`elec_gen_${b}_pct`) - v(`elec_gen_${a}_pct`)).map(k => (
            <Bar key={k} label={FUEL_KO[k]} pct={v(`elec_gen_${k}_pct`)} color={FUEL_COLOR[k]} right={`${v(`elec_gen_${k}_pct`)}%`} />
          ))}
        </Section>
      )}
      {capFuels.length > 0 && capTotal && (
        <Section title="발전소 설비 구성" sub={`Ember ${asof('capacity_total_gw')} · 총 ${capTotal}GW`}>
          {capFuels.sort((a, b) => v(`capacity_${b}_gw`) - v(`capacity_${a}_gw`)).map(k => (
            <Bar key={k} label={FUEL_KO[k]} pct={(v(`capacity_${k}_gw`) / capTotal) * 100} color={FUEL_COLOR[k]} right={`${v(`capacity_${k}_gw`)}GW`} />
          ))}
        </Section>
      )}
      {v('electricity_price_usd_kwh') != null && (
        <Section title="전기요금(가정용)" sub="추정">
          <div className="flex items-center gap-2">
            <span className="text-base font-mono text-cyan-200">${v('electricity_price_usd_kwh')}/kWh</span>
            <span className="text-[9px] font-mono px-1 py-0.5 rounded border text-amber-300 bg-amber-900/30 border-amber-500/40">Perplexity 추정</span>
          </div>
        </Section>
      )}
    </div>
  );
}

export default function CountryFulcrumPanel() {
  const { selectedCountry, setSelectedCountry, activeSupplyRoute, setActiveSupplyRoute } = useStore();
  const [data, setData] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [tab, setTab] = useState('fulcrum');
  const [loading, setLoading] = useState(false);

  const code = selectedCountry?.code;
  const cd = code ? COUNTRY_DATA[code] : null;

  useEffect(() => {
    if (!code) return;
    setData(null); setRoutes(null); setTab('fulcrum');
    setLoading(true);
    fetch(`${PROXY_URL}/api/country-fulcrum?code=${code}`)
      .then(r => r.json()).then(d => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [code]);

  // 공급 루트 탭: 루트 데이터 로드
  const loadRoutes = useCallback(() => {
    if (!code || routes) return;
    fetch(`${PROXY_URL}/api/supply-routes?code=${code}`)
      .then(r => r.json()).then(d => setRoutes(d)).catch(() => setRoutes({ routes: [] }));
  }, [code, routes]);
  useEffect(() => { if (tab === 'routes') loadRoutes(); }, [tab, loadRoutes]);

  if (!selectedCountry) return null;
  const f = data?.fulcrum;
  const dir = DIR[f?.fulcrum_direction] ?? DIR.stable;
  const fulcrumDomain = CONSTRAINTS.find(c => c.key === f?.fulcrum_constraint);

  // 공급루트: 품목별 그룹
  const byCommodity = {};
  for (const r of (routes?.routes ?? [])) (byCommodity[r.commodity] ??= []).push(r);
  const commodityKeys = Object.keys(byCommodity);

  const close = () => { setSelectedCountry(null); setActiveSupplyRoute(null); };

  return (
    <div className="fixed inset-x-2 bottom-14 h-[72vh] z-40 flex flex-col pointer-events-none md:absolute md:inset-x-auto md:bottom-3 md:top-3 md:left-3 md:h-auto md:w-[27rem] md:max-w-[calc(100%-1.5rem)]">
      <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 pointer-events-auto bg-sea-panel">
        {/* 헤더 (Civ 리더) */}
        <div className="relative flex-shrink-0 px-5 pt-5 pb-4"
          style={{ background: `linear-gradient(135deg, ${cd?.leader?.bgFrom ?? '#1a1a2e'} 0%, ${cd?.leader?.bgTo ?? '#16213e'} 100%)` }}>
          <button onClick={close} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 text-white/60 hover:text-white hover:bg-black/50 text-sm">✕</button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-black/30 flex items-center justify-center text-3xl overflow-hidden shrink-0">
              {cd?.leader?.image
                ? <img src={cd.leader.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = cd.flagEmoji; }} />
                : (cd?.flagEmoji ?? '🌐')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{cd?.flagEmoji} {selectedCountry.name}</h2>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${dir.c}`}>{dir.t}</span>
              </div>
              <p className="text-[11px] text-white/70">{cd?.leader?.name} · {cd?.leader?.title}</p>
            </div>
          </div>
          {cd?.leader?.quote && <p className="text-[11px] text-white/60 italic mt-2">{cd.leader.quote}</p>}
        </div>

        {/* 탭바 */}
        <div className="flex-shrink-0 flex border-b border-white/10 bg-black/20 text-[11px] overflow-x-auto">
          {[{ k: 'fulcrum', l: '⚖ Fulcrum' }, ...CONSTRAINTS.map(c => ({ k: c.key, l: c.emoji + ' ' + c.label })), { k: 'energy', l: '⚡ 에너지' }, { k: 'routes', l: '🛢️ 공급루트' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-3 py-2 whitespace-nowrap transition-colors ${tab === t.k ? 'text-white border-b-2 border-purple-400 bg-white/5' : 'text-white/50 hover:text-white/80'}`}>{t.l}</button>
          ))}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-white/50 text-sm">불러오는 중…</p>}
          {!loading && !f && <p className="text-white/50 text-sm">아직 분석 데이터가 없습니다. (주 1회 배치 또는 에이전트 첫 실행 대기)</p>}

          {/* ① Fulcrum 종합 */}
          {tab === 'fulcrum' && f && (
            <div className="space-y-3">
              <div className="rounded-lg border border-purple-500/40 bg-purple-950/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-purple-300">FULCRUM (가장 구속력 있는 제약)</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${dir.c}`}>{dir.t}</span>
                </div>
                <p className="text-sm font-bold text-white mb-1.5">{fulcrumDomain ? `${fulcrumDomain.emoji} ${fulcrumDomain.label}` : f.fulcrum_constraint}</p>
                <p className="text-[12px] text-white/80 leading-relaxed">{f.fulcrum_summary}</p>
              </div>
              {(f.maritime_streams?.length > 0) && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">fulcrum을 움직이는 라이브 스트림</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.maritime_streams.map((s, i) => (
                      <span key={i} className="text-[10px] font-mono px-2 py-1 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-200/90">{s.label || s.stream}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ②~⑤ 4제약 */}
          {CONSTRAINTS.some(c => c.key === tab) && f && (
            <div>
              {(f.constraints?.[tab] ?? []).length === 0
                ? <p className="text-white/40 text-sm">해당 제약 사실이 아직 없습니다.</p>
                : (f.constraints[tab]).map((fact, i) => <FactRow key={i} f={fact} />)}
            </div>
          )}

          {/* ⚡ 에너지 */}
          {tab === 'energy' && <EnergyTab indicators={data?.indicators ?? []} />}

          {/* ⑥ 공급루트 & 의존도 */}
          {tab === 'routes' && (
            <div className="space-y-3">
              {!routes && <p className="text-white/50 text-sm">루트 불러오는 중…</p>}
              {routes && commodityKeys.length === 0 && <p className="text-white/40 text-sm">이 국가의 공급 루트 데이터가 없습니다(주로 수출국).</p>}
              {commodityKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {commodityKeys.map(ck => {
                    const on = activeSupplyRoute?.code === code && activeSupplyRoute?.commodity === ck;
                    const m = COMMODITIES[ck];
                    return (
                      <button key={ck} onClick={() => setActiveSupplyRoute(on ? null : { code, commodity: ck })}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-purple-600/40 border-purple-400 text-white' : 'bg-white/5 border-white/15 text-white/70 hover:text-white'}`}>
                        {m?.emoji} {m?.label ?? ck}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeSupplyRoute?.commodity && byCommodity[activeSupplyRoute.commodity] && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">{COMMODITIES[activeSupplyRoute.commodity]?.label} 공급원별 의존도 · 위험포인트</p>
                  {byCommodity[activeSupplyRoute.commodity].sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0)).map((r, i) => (
                    <div key={i} className="mb-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-white/85">{r.supplier_code}</span>
                        <span className="font-mono text-cyan-200/90">{r.share_pct ?? '?'}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-purple-400/70" style={{ width: `${Math.min(100, r.share_pct ?? 0)}%` }} />
                      </div>
                      {(r.chokepoints?.length > 0) && (
                        <p className="text-[10px] text-red-300/80 mt-0.5">⚠ {r.chokepoints.join(' · ')} {r.distance_nm ? `· ${Number(r.distance_nm).toLocaleString()}nm` : ''}</p>
                      )}
                    </div>
                  ))}
                  <p className="text-[9px] text-white/35 mt-1">지도에 항로·위험포인트(초크포인트 라이브 상태)가 표시됩니다. ※ 근사 항로(시각화용).</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
