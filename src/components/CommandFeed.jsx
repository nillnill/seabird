import { useState, useMemo } from 'react';
import useStore from '../store/useStore.js';
import { useAgentReports } from '../hooks/useAgentReports.js';
import ReportCard from './ReportCard.jsx';
import ReportModal from './ReportModal.jsx';
import FeedTabs, { TABS, reportInTab } from './FeedTabs.jsx';
import FeedFilter from './FeedFilter.jsx';
import CommanderInput from './CommanderInput.jsx';
import { parseUtc } from '../utils/time.js';

const TIME_MS = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };

export default function CommandFeed() {
  useAgentReports();

  const { reports, feedFilters, feedTab, mobileView } = useStore();
  const [selectedReport, setSelectedReport] = useState(null);

  // 1) 공통 필터(심각도·기간)만 먼저 적용 — 탭 건수 배지가 같은 기준을 공유하도록
  const base = useMemo(() => {
    const cutoff = Date.now() - (TIME_MS[feedFilters.timeRange] ?? TIME_MS['24h']);
    return reports.filter(
      (r) =>
        feedFilters.severities.includes(r.severity) &&
        parseUtc(r.created_at).getTime() > cutoff
    );
  }, [reports, feedFilters.severities, feedFilters.timeRange]);

  // 2) 탭별 건수 (배지용)
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0]));
    for (const r of base) {
      for (const t of TABS) if (reportInTab(t.id, r.agent_id)) c[t.id]++;
    }
    return c;
  }, [base]);

  // 3) 활성 탭으로 최종 필터
  const filtered = useMemo(
    () => base.filter((r) => reportInTab(feedTab, r.agent_id)),
    [base, feedTab]
  );

  return (
    <aside className={`${mobileView === 'feed' ? 'absolute inset-0 z-30 flex' : 'hidden'} md:static md:z-auto md:flex w-full md:w-80 lg:w-96 h-full flex-col border-l border-sea-border bg-sea-panel`}>
      {/* 피드 헤더 */}
      <div className="px-4 py-3 border-b border-sea-border shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white tracking-wide">COMMAND FEED</span>
          <span className="text-[10px] font-mono text-sea-muted">{filtered.length} reports</span>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <FeedTabs counts={counts} />

      {/* 심각도·기간 필터 */}
      <FeedFilter />

      {/* 보고 카드 목록 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sea-muted text-xs text-center gap-2">
            <span className="text-2xl opacity-30">📡</span>
            <span>{feedTab === 'all' ? '에이전트 보고 대기 중...' : '이 카테고리의 보고가 없습니다'}</span>
            <span className="text-[10px] opacity-60">실시간 AIS 분석 중</span>
          </div>
        ) : (
          filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={() => setSelectedReport(report)}
            />
          ))
        )}
      </div>

      {/* Commander 입력 */}
      <CommanderInput />

      {/* 상세 모달 */}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </aside>
  );
}
