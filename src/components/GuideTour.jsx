import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import useStore from '../store/useStore.js';

// 신규 사용자 단계별 스포트라이트 투어. data-tour 요소를 하이라이트하며 안내.
const STEPS = [
  { target: 'map',      title: '항구', desc: '지도의 동그란 항구 마커를 클릭하면 그 항구의 실시간 현황·역사·뉴스를 볼 수 있어요.' },
  { target: 'map',      title: '배',   desc: '바다 위 선박(점·화살표)을 클릭하면 AI가 화물을 추정해 보여줍니다.' },
  { target: 'xcapital', title: 'X Capital', desc: '상단 X Capital — 해양 데이터로 만든 투자 데스크. 세 페르소나가 매수·매도 시그널과 근거를 제시해요.' },
  { target: 'feed',     title: '보고 피드', desc: '오른쪽 보고 피드 — AI 에이전트들의 실시간 분석. 카드를 클릭하면 상세를 봅니다.' },
];
const PAD = 8, TW = 320, TH = 168;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function GuideTour() {
  const { showGuide, closeGuide } = useStore();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => { if (showGuide) setStep(0); }, [showGuide]);

  const measure = useCallback(() => {
    const t = STEPS[step]?.target;
    const el = t && document.querySelector(`[data-tour="${t}"]`);
    const r = el?.getBoundingClientRect();
    setRect(r && r.width > 4 && r.height > 4 ? r : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!showGuide) return;
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [showGuide, step, measure]);

  useEffect(() => {
    if (!showGuide) return;
    const h = (e) => { if (e.key === 'Escape') closeGuide(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showGuide, closeGuide]);

  if (!showGuide) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;

  // 스포트라이트(구멍) 스타일
  const spot = rect && {
    position: 'absolute',
    top: rect.top - PAD, left: rect.left - PAD,
    width: rect.width + PAD * 2, height: rect.height + PAD * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(5,9,16,0.72)',
  };

  // 툴팁 위치: 타깃 아래(공간 없으면 위), 가로는 타깃 중앙 정렬 후 클램프
  let top, left;
  if (rect) {
    top = (rect.bottom + 16 + TH < vh) ? rect.bottom + 16 + PAD : clamp(rect.top - 16 - TH, 16, vh - TH - 16);
    left = clamp(rect.left + rect.width / 2 - TW / 2, 16, vw - TW - 16);
  } else {
    top = vh / 2 - TH / 2; left = vw / 2 - TW / 2; // 폴백(숨은 요소): 중앙
  }

  return (
    <div className="fixed inset-0 z-[70]">
      {/* 클릭 차단 + (타깃 없을 때) 전체 딤 */}
      <div className="absolute inset-0" style={!rect ? { background: 'rgba(5,9,16,0.72)' } : undefined} />
      {/* 스포트라이트 */}
      {spot && <div style={spot} className="ring-2 ring-amber-300/90 pointer-events-none" />}
      {/* 툴팁 카드 */}
      <div
        className="absolute pointer-events-auto bg-sea-panel border border-sea-border rounded-xl shadow-2xl p-4"
        style={{ top, left, width: TW }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-amber-300 tracking-widest">{step + 1} / {STEPS.length}</span>
          <button onClick={closeGuide} className="text-[10px] font-mono text-sea-muted hover:text-white">건너뛰기</button>
        </div>
        <p className="text-sm font-bold text-white mb-1">{s.title}</p>
        <p className="text-[12px] text-white/70 leading-relaxed">{s.desc}</p>
        <div className="flex items-center justify-end gap-2 mt-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="text-[11px] px-2.5 py-1.5 rounded border border-sea-border text-sea-muted hover:text-white hover:border-white/30 transition-colors"
            >이전</button>
          )}
          <button
            onClick={() => (last ? closeGuide() : setStep(step + 1))}
            className="text-[11px] px-3 py-1.5 rounded border border-amber-500/60 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors font-medium"
          >{last ? '완료' : '다음'}</button>
        </div>
      </div>
    </div>
  );
}
