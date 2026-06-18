import { useEffect, useState } from 'react';
import useStore from '../store/useStore.js';

// 발표 슬라이드(이미지 1~5) 풀스크린 뷰어.
// 1장당 이미지 1개, 하단 이전/다음 버튼 + 키보드(←/→) 지원, ESC로 닫기.
const SLIDES = [
  '/ppt/slide1.png',
  '/ppt/slide2.png',
  '/ppt/slide3.png',
  '/ppt/slide4.png',
  '/ppt/slide5.png',
];

export default function SlideDeck() {
  const { showSlides, toggleSlides } = useStore();
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(SLIDES.length - 1, i + 1));

  // 열릴 때 첫 장으로 초기화
  useEffect(() => {
    if (showSlides) setIdx(0);
  }, [showSlides]);

  // 키보드: ESC 닫기, ←/→ 이동
  useEffect(() => {
    if (!showSlides) return;
    const h = (e) => {
      if (e.key === 'Escape') toggleSlides();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight' || e.key === ' ') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showSlides, toggleSlides]);

  if (!showSlides) return null;

  const atFirst = idx === 0;
  const atLast = idx === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* 상단 바 */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-sea-border bg-sea-panel">
        <span className="text-sm font-mono font-bold tracking-widest text-white">발표 슬라이드</span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-sea-muted">{idx + 1} / {SLIDES.length}</span>
          <button
            onClick={toggleSlides}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-sea-border hover:bg-white/10 text-sea-muted hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 슬라이드 이미지 (1장당 1개) */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <img
          src={SLIDES[idx]}
          alt={`슬라이드 ${idx + 1}`}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      </div>

      {/* 하단 이전/다음 버튼 */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-4 py-3 border-t border-sea-border bg-sea-panel">
        <button
          onClick={prev}
          disabled={atFirst}
          className="px-5 py-2 rounded-lg border border-sea-border text-sm font-mono text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← 이전
        </button>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`슬라이드 ${i + 1}로 이동`}
              className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          disabled={atLast}
          className="px-5 py-2 rounded-lg border border-sea-border text-sm font-mono text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
