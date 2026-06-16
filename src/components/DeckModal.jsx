import { useEffect } from 'react';
import useStore from '../store/useStore.js';

// 서비스 소개 발표자료(PDF) 전체화면 뷰어. GNB '소개' 버튼으로 토글, ESC로 닫기.
export default function DeckModal() {
  const { showDeck, toggleDeck } = useStore();

  useEffect(() => {
    if (!showDeck) return;
    const h = (e) => { if (e.key === 'Escape') toggleDeck(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showDeck, toggleDeck]);

  if (!showDeck) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-sea-bg">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-sea-border bg-sea-panel">
        <span className="text-sm font-mono font-bold tracking-widest text-white">서비스 소개</span>
        <div className="flex items-center gap-3">
          <a
            href="/seabird_intro.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-mono text-sea-muted hover:text-white px-2 py-1 rounded border border-sea-border hover:border-white/30 transition-colors"
          >
            새 탭으로 열기
          </a>
          <button
            onClick={toggleDeck}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-sea-border hover:bg-white/10 text-sea-muted hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>
      <iframe
        title="서비스 소개"
        src="/seabird_intro.pdf#view=FitH"
        className="flex-1 w-full bg-white"
      />
    </div>
  );
}
