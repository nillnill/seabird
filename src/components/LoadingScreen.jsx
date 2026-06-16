import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore.js';

// 첫 진입 로딩 화면 — 선박 데이터가 임계치까지 쌓일 동안 맥린 캐릭터와 함께 표시.
// 서버가 접속 시 전체 스냅샷을 한 번에 밀어 데이터가 순식간에 채워질 수 있어,
// 브랜드 애니메이션이 보이도록 최소 표시시간을 둔다. 임계 미달 시엔 안전 타임아웃으로 통과.
const THRESHOLD = 5000;
const MIN_DISPLAY_MS = 1600; // 데이터가 즉시 차도 최소 노출
const MAX_WAIT_MS = 25000;   // 커버리지 부족 등 임계 미달 시 자동 통과

export default function LoadingScreen() {
  const shipCount = useStore((s) => s.shipCount);
  // 마운트 시 이미 충분하면(HMR 재마운트 등) 바로 통과
  const [done, setDone] = useState(() => useStore.getState().shipCount >= THRESHOLD);
  const [err, setErr] = useState(false);
  const mountRef = useRef(Date.now());

  // 임계 도달 → 최소 표시시간을 채운 뒤 닫기
  useEffect(() => {
    if (done || shipCount < THRESHOLD) return;
    const wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - mountRef.current));
    const t = setTimeout(() => setDone(true), wait);
    return () => clearTimeout(t);
  }, [shipCount, done]);

  // 안전 폴백
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setDone(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [done]);

  if (done) return null;

  const pct = Math.min(100, Math.round((shipCount / THRESHOLD) * 100));

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-sea-bg px-6 text-center">
      {/* 맥린 + 회전 링 */}
      <div className="relative mb-6">
        <div className="absolute -inset-3 rounded-full border-2 border-amber-400/25 border-t-amber-400 animate-spin" />
        {err ? (
          <span className="w-28 h-28 flex items-center justify-center rounded-full bg-sea-panel text-4xl">⚓</span>
        ) : (
          <img
            src="/characters/Malcolm_McLean.webp"
            alt="Malcolm McLean"
            onError={() => setErr(true)}
            className="w-28 h-28 rounded-full object-cover bg-sea-panel ring-1 ring-white/10 animate-pulse"
          />
        )}
      </div>

      <p className="text-base font-semibold text-white">선박 정보를 불러오고 있습니다</p>
      <p className="text-[11px] text-sea-muted mt-1 font-mono">전 세계 AIS 신호를 수신 중…</p>

      {/* 진행 바 */}
      <div className="mt-5 w-64 max-w-[80vw]">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[11px] font-mono text-white/60">
          <span className="text-white">{shipCount.toLocaleString()}</span> / {THRESHOLD.toLocaleString()} 척
        </p>
      </div>

      <button
        onClick={() => setDone(true)}
        className="mt-6 text-[11px] font-mono text-sea-muted hover:text-white transition-colors"
      >
        바로 시작 →
      </button>
    </div>
  );
}
