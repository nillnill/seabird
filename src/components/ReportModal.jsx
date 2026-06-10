import ReactMarkdown from 'react-markdown';

const AGENT_LABELS = {
  PORT_ANALYST:        '🏗️ PORT ANALYST',
  CHOKEPOINT_WATCHER:  '🚢 CHOKEPOINT WATCHER',
  CARGO_ESTIMATOR:     '📦 CARGO ESTIMATOR',
  ANOMALY_DETECTOR:    '🔍 ANOMALY DETECTOR',
  GEOPOLITICAL_LINKER: '🌐 GEOPOLITICAL LINKER',
};

export default function ReportModal({ report, onClose }) {
  if (!report) return null;

  const kst = new Date(report.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sea-panel border border-sea-border rounded-xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between p-4 border-b border-sea-border">
          <div className="space-y-0.5">
            <p className="text-[10px] text-sea-muted font-mono">{AGENT_LABELS[report.agent_id]} · {kst}</p>
            <h2 className="text-sm font-bold text-white leading-tight">{report.title}</h2>
            <p className="text-xs text-sea-muted">{report.summary}</p>
          </div>
          <button
            className="text-sea-muted hover:text-white transition-colors ml-4 shrink-0"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto p-4 prose prose-invert prose-sm max-w-none">
          {report.detail ? (
            <ReactMarkdown>{report.detail}</ReactMarkdown>
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
