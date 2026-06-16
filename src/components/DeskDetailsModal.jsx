import { useEffect, useState } from 'react';
import { INVESTMENT_PERSONAS } from '../data/investmentCharacters.js';
import { PORT_KO, FREIGHT_GLOSSARY, SERIES_META, SERIES_ORDER } from '../data/xcapGlossary.js';
import { ModeBadge } from './XCapitalSpace.jsx';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

const fmtNum = (n) => (n == null ? '–' : Number(n).toLocaleString());

// X CAPITAL 데스크 "자세히" — 항구·운임지수 설명 + 실수치 시계열 표.
const SIGNAL_COLOR = { LONG: 'text-green-400', SHORT: 'text-red-400', HOLD: 'text-slate-300' };

export default function DeskDetailsModal({ deskKey, seed, narrative, korStats, onClose }) {
  const p = INVESTMENT_PERSONAS[deskKey];
  const strat = p?.strategy;
  const seaPorts = korStats?.sea_density_ports ?? [];
  const seaSeries = korStats?.sea_density_series ?? [];
  const seaMax = Math.max(1, ...seaSeries.map(s => s.value));
  const seaYm = korStats?.sea_density_ym ? `${korStats.sea_density_ym.slice(0, 4)}.${korStats.sea_density_ym.slice(4)}` : '';
  const [data, setData] = useState(seed ?? null);
  const [loading, setLoading] = useState(!seed);

  useEffect(() => {
    if (seed) { setData(seed); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetch(`${PROXY_URL}/api/xcap/desk-series?key=${deskKey}&days=30`)
      .then(r => r.json())
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [deskKey, seed]);

  if (!p) return null;

  const ports = data?.ports ?? [];
  const units = data?.units ?? {};
  const modes = data?.modes ?? {};
  const freightCode = data?.freight?.code;
  // 최신순(표는 위가 최근)
  const rows = [...(data?.series ?? [])].reverse();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-sea-panel border border-sea-border rounded-xl w-full max-w-3xl max-h-[86vh] flex flex-col overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between p-4 border-b border-sea-border shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] text-sea-muted">
              <span className="text-white/85 font-semibold">{p.name}</span> · {p.desk} 데스크
            </p>
            <h2 className="text-base font-bold text-white leading-tight">데스크 데이터 시계열 (최근 30일)</h2>
            <p className="text-[11px] text-sea-muted mt-0.5">
              항구: {ports.map(id => PORT_KO[id] ?? id).join(' · ') || '–'}
              {freightCode ? `  ·  운임: ${freightCode}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-sea-muted hover:text-white transition-colors text-lg leading-none ml-4 shrink-0">✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* 전략 & 판단 근거 */}
          {(strat || narrative) && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-950/10 p-3 space-y-2.5">
              <p className="text-[11px] font-semibold text-amber-200/90">📈 {p.name}의 전략</p>
              {strat?.framework && <p className="text-[11px] text-white/75 leading-relaxed">{strat.framework}</p>}

              {strat?.reads?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] text-white/40 uppercase tracking-widest">데이터를 읽는 법</p>
                  {strat.reads.map((r, i) => (
                    <div key={i} className="flex gap-2 text-[10px] leading-snug">
                      <span className="text-white/80 font-medium shrink-0 w-28">{r.metric}</span>
                      <span className="text-white/30">→</span>
                      <span className="text-white/55">{r.how}</span>
                    </div>
                  ))}
                </div>
              )}
              {strat?.playbook && (
                <p className="text-[10px] text-white/55 font-mono border-t border-white/10 pt-2">🎯 {strat.playbook}</p>
              )}

              {/* 현재 판단(동적) */}
              {narrative && (
                <div className="border-t border-white/10 pt-2 space-y-1.5">
                  <p className="text-[10px] text-white/45 uppercase tracking-widest">현재 판단</p>
                  <p className="text-[12px]">
                    <span className={`font-bold ${SIGNAL_COLOR[narrative.signal] ?? 'text-white/70'}`}>{narrative.signal ?? 'HOLD'}</span>
                    {narrative.conviction && <span className="text-white/40 font-mono text-[10px]"> · 확신 {narrative.conviction}</span>}
                  </p>
                  {narrative.thesis && <p className="text-[11px] text-white/70 leading-relaxed">{narrative.thesis}</p>}
                  {narrative.drivers?.length > 0 && (
                    <ul className="space-y-0.5">
                      {narrative.drivers.map((x, i) => (
                        <li key={i} className="text-[10px] text-white/60 flex gap-1.5 leading-snug">
                          <span className="text-amber-400/50 shrink-0">▸</span><span>{x}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 설명 블록 */}
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-white/80 mb-1.5">📊 이 데스크가 쓰는 데이터</p>
              <ul className="space-y-1 text-[11px] text-white/65 leading-relaxed">
                {SERIES_ORDER.map(k => {
                  const m = SERIES_META[k];
                  return (
                    <li key={k} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="text-white/80">{m.label}</span>
                      <span className="text-sea-muted">({units[m.unitKey] ?? ''})</span>
                      {modes[k] && <ModeBadge mode={modes[k]} />}
                    </li>
                  );
                })}
              </ul>
              <p className="text-[10px] text-white/40 mt-1.5">
                혼잡=항구권 정박·대기 선박 수, 입항=항구로 향하는 선박 수, 유입=입항 선박의 화물 추정량,
                체류=항구 평균 머문 시간(회전속도·수요압력 신호), 운임=KOBC 운임지수.
                <br /><span className="text-cyan-300/70">공식 입항·화물처리=해양수산부 월별 공식 통계(AIS 사각지대인 국내 철강·정유항 보완, 월 계단·점선). 화물처리는 전국 품목 기준.</span>
              </p>
            </div>

            {freightCode && FREIGHT_GLOSSARY[freightCode] && (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] font-semibold text-white/80">{FREIGHT_GLOSSARY[freightCode].name}</p>
                <p className="text-[10px] text-white/55 leading-relaxed mt-1">{FREIGHT_GLOSSARY[freightCode].desc}</p>
              </div>
            )}

            {/* 해역 통항 밀집도 (GICOMS) */}
            {seaPorts.length > 0 && (
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/10 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[11px] font-semibold text-cyan-200/90">🌊 해역 통항 밀집도 (GICOMS)</p>
                  <span className="text-[9px] text-white/40 font-mono">기준 {seaYm} · 합계 {fmtNum(korStats?.sea_density)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-1.5">
                  {seaPorts.map((sp) => (
                    <div key={sp.port_id} className="flex items-center justify-between gap-1 bg-black/30 rounded px-2 py-1">
                      <span className="text-[10px] text-white/70">{PORT_KO[sp.port_id] ?? sp.port_id}</span>
                      <span className="text-[10px] font-mono text-cyan-200/80">{fmtNum(sp.value)}</span>
                    </div>
                  ))}
                </div>

                {/* 월별 추세 (시계열) */}
                {seaSeries.length > 1 && (
                  <div className="mb-1.5">
                    <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">월별 추세</p>
                    <div className="flex items-end gap-1 h-16">
                      {seaSeries.map((s) => (
                        <div key={s.ym} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${s.ym}: ${fmtNum(s.value)}`}>
                          <span className="text-[8px] font-mono text-cyan-200/70 opacity-0 group-hover:opacity-100 transition-opacity">{fmtNum(s.value)}</span>
                          <div className="w-full rounded-t bg-cyan-400/60 hover:bg-cyan-300" style={{ height: `${Math.max(4, (s.value / seaMax) * 100)}%` }} />
                          <span className="text-[8px] text-white/35 font-mono">{s.ym.slice(2, 4)}.{s.ym.slice(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-white/45 leading-relaxed">
                  해양수산부 GICOMS 연안 AIS 통계 — 항구 해역(±40km) 격자의 통항 수 합산. aisstream이 못 잡는 국내 연안의 통항 밀집도를 공식 데이터로 보완(과거 기준월).
                </p>
              </div>
            )}
          </div>

          {/* 시계열 표 */}
          {loading ? (
            <p className="text-[11px] font-mono text-sea-muted animate-pulse py-6 text-center">시계열 로드 중…</p>
          ) : rows.length === 0 ? (
            <p className="text-[11px] font-mono text-white/40 py-6 text-center">시계열 데이터 축적 중 — 수집이 쌓이면 표시됩니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full border-collapse text-[11px]">
                <thead className="bg-white/[0.06]">
                  <tr>
                    <th className="text-left font-semibold text-white/70 px-3 py-2 border-b border-white/10 whitespace-nowrap">날짜</th>
                    {SERIES_ORDER.map(k => (
                      <th key={k} className="text-right font-semibold text-white/70 px-3 py-2 border-b border-white/10 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span style={{ color: SERIES_META[k].color }}>{SERIES_META[k].label}</span>
                        </div>
                        <span className="text-[9px] text-sea-muted font-normal">{units[SERIES_META[k].unitKey] ?? ''}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className="hover:bg-white/[0.03] transition-colors">
                      <td className="text-white/70 px-3 py-1.5 border-b border-white/5 font-mono whitespace-nowrap">{r.date}</td>
                      {SERIES_ORDER.map(k => (
                        <td key={k} className="text-right text-white/80 px-3 py-1.5 border-b border-white/5 font-mono tabular-nums">
                          {fmtNum(r[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-white/35 leading-relaxed">
            ※ 절대 수치는 AIS 커버리지 기반 거친 추정이며 투자 자문이 아닙니다.
            '축적 중' 배지는 표본이 아직 충분치 않은 지표입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
