import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useStore from '../store/useStore.js';
import { fmtKst } from '../utils/time.js';

function CharAvatar({ character }) {
  const [err, setErr] = useState(false);
  if (err || !character.image) {
    return (
      <span className="w-14 h-14 shrink-0 flex items-center justify-center rounded-full bg-sea-bg text-2xl ring-1 ring-white/10">
        {character.symbolEmoji ?? character.flagEmoji ?? '⚓'}
      </span>
    );
  }
  return (
    <img src={character.image} alt={character.name} onError={() => setErr(true)}
      className="w-14 h-14 shrink-0 rounded-full object-cover bg-sea-bg ring-1 ring-white/10" />
  );
}

const AGENT_LABELS = {
  PORT_ANALYST:        '🏗️ PORT ANALYST',
  CHOKEPOINT_WATCHER:  '🚢 CHOKEPOINT WATCHER',
  CARGO_ESTIMATOR:     '📦 CARGO ESTIMATOR',
  GEOPOLITICAL_LINKER: '🌐 GEOPOLITICAL LINKER',
  MASTER_AGENT:        '🧭 MASTER AGENT',
  WEATHER_AGENT:       '🌪️ WEATHER AGENT',
  COMMODITY_ANALYST:   '💹 COMMODITY ANALYST',
  FLOW_REPORTER:       '🛢️ FLOW REPORTER',
};

// Notion 스타일 마크다운 렌더러 — 테두리 표·여백 있는 제목·읽기 좋은 문단/리스트
const MD_COMPONENTS = {
  h1: ({ children }) => <h1 className="text-base font-bold text-white mt-5 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-white mt-5 mb-2 first:mt-0 pb-1 border-b border-white/10">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="text-[13px] font-semibold text-white/90 mt-4 mb-1.5 first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="text-[13px] text-white/75 leading-relaxed my-2">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="text-white/70 not-italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{children}</a>
  ),
  ul: ({ children }) => <ul className="my-2 space-y-1 list-disc pl-5 marker:text-blue-400/60">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 space-y-1 list-decimal pl-5 marker:text-white/40">{children}</ol>,
  li: ({ children }) => <li className="text-[13px] text-white/75 leading-relaxed pl-1">{children}</li>,
  hr: () => <hr className="my-4 border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-500/40 pl-3 my-2 text-white/55 text-[13px]">{children}</blockquote>
  ),
  code: ({ children }) => <code className="bg-white/10 text-blue-200 px-1.5 py-0.5 rounded text-[11px] font-mono">{children}</code>,
  // ── 표 (remark-gfm) — Notion 스타일 박스 ──
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.06]">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left font-semibold text-white/70 px-3 py-2 border-b border-white/10 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="text-white/80 px-3 py-2 border-b border-white/5 align-top leading-snug">{children}</td>
  ),
  tr: ({ children }) => <tr className="hover:bg-white/[0.03] transition-colors">{children}</tr>,
};

export default function ReportModal({ report, onClose }) {
  if (!report) return null;

  const kst = fmtKst(report.created_at);
  const character = report.raw_data?.character;

  const setSelectedRegion = useStore((s) => s.setSelectedRegion);
  const rd = report.raw_data ?? {};
  const regionId = rd.port_id || rd.cp_id || report.location?.chokepoint_id || null;
  const regionType = rd.port_id ? 'port' : (rd.cp_id || report.location?.chokepoint_id) ? 'chokepoint' : null;
  const canOpenRegion = regionId && regionType && report.location?.lat != null;

  function openRegion() {
    setSelectedRegion({
      id: regionId,
      name: rd.port_name || rd.cp_name || character?.region,
      type: regionType,
      lat: report.location.lat,
      lng: report.location.lng,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sea-panel border border-sea-border rounded-xl w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between p-4 border-b border-sea-border shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {character && <CharAvatar character={character} />}
            <div className="space-y-1 min-w-0">
              {character ? (
                <p className="text-[10px] text-sea-muted">
                  <span className="text-white/80 font-semibold">{character.name}</span>
                  {character.title ? ` · ${character.title}` : ''} · {kst}
                </p>
              ) : (
                <p className="text-[10px] text-sea-muted font-mono">{AGENT_LABELS[report.agent_id] ?? report.agent_id} · {kst}</p>
              )}
              <h2 className="text-base font-bold text-white leading-tight">{report.title}</h2>
              {report.summary && <p className="text-xs text-sea-muted leading-snug">{report.summary}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {canOpenRegion && (
              <button
                className="text-[11px] px-2.5 py-1 rounded border border-blue-500/50 text-blue-300 hover:bg-blue-900/30 transition-colors whitespace-nowrap"
                onClick={openRegion}
              >
                지역 상세 보기 →
              </button>
            )}
            <button
              className="text-sea-muted hover:text-white transition-colors text-lg leading-none"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto px-5 py-4">
          {report.detail ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {report.detail}
            </ReactMarkdown>
          ) : (
            <p className="text-sea-muted text-sm">상세 내용이 없습니다.</p>
          )}

          {/* 연관 MMSI */}
          {report.related_mmsi?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-sea-border">
              <p className="text-[10px] text-sea-muted mb-2 font-mono">연관 선박 MMSI</p>
              <div className="flex flex-wrap gap-1">
                {report.related_mmsi.map((m) => (
                  <span key={m} className="text-[10px] font-mono bg-sea-bg border border-sea-border rounded px-2 py-0.5 text-white">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
