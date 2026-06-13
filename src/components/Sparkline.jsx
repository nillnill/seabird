// 경량 SVG 스파크라인 — baselines 시계열 추이 + 평년 기준선 오버레이.
// Recharts 없이 인라인 렌더 (패널 현황 탭용). viewBox 0..100 좌표계 + preserveAspectRatio none.
const VB_W = 100;
const VB_H = 100;
const PAD_Y = 8; // 위아래 여백 (점·라벨 잘림 방지)

export default function Sparkline({
  series = [],
  baseline = null,
  height = 56,
  higherIsBad = true,
  color = '#60a5fa',
}) {
  if (!series.length) {
    return (
      <div className="flex items-center justify-center text-[9px] text-white/25 font-mono" style={{ height }}>
        추이 데이터 누적 중…
      </div>
    );
  }

  const vals = series.map(s => s.v);
  const candidates = baseline != null ? [...vals, baseline] : vals;
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  const range = max - min || 1;

  const x = (i) => (series.length === 1 ? VB_W / 2 : (i / (series.length - 1)) * VB_W);
  const y = (v) => PAD_Y + (1 - (v - min) / range) * (VB_H - 2 * PAD_Y);

  const linePts = series.map((s, i) => `${x(i)},${y(s.v)}`).join(' ');
  const areaPts = `0,${VB_H} ${linePts} ${VB_W},${VB_H}`;
  const baseY = baseline != null ? y(baseline) : null;

  const last = series[series.length - 1];
  const lastX = x(series.length - 1);
  const lastY = y(last.v);

  // 마지막 값 평년 대비 색
  const ratio = baseline ? last.v / baseline : 1;
  const bad = higherIsBad ? ratio > 1.2 : ratio < 0.8;
  const worse = higherIsBad ? ratio > 1.5 : ratio < 0.5;
  const dotColor = worse ? '#f87171' : bad ? '#facc15' : '#4ade80';

  const gid = `spark-${Math.round(min)}-${Math.round(max)}-${series.length}`;

  return (
    <div className="relative" style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 평년 기준선 */}
        {baseY != null && (
          <line x1="0" y1={baseY} x2={VB_W} y2={baseY}
            stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke" />
        )}
        {/* 면적 + 라인 */}
        <polygon points={areaPts} fill={`url(#${gid})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.4"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {/* 마지막 점 */}
        <circle cx={lastX} cy={lastY} r="2.6" fill={dotColor} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* y축 라벨 (현재·최대·최소) */}
      <span className="absolute top-0 right-1 text-[8px] font-mono text-white/35">{max}</span>
      <span className="absolute bottom-0 right-1 text-[8px] font-mono text-white/35">{min}</span>
      {baseline != null && (
        <span
          className="absolute left-1 text-[8px] font-mono text-white/45"
          style={{ top: `${(baseY / VB_H) * 100}%`, transform: 'translateY(-120%)' }}
        >
          평년 {baseline}
        </span>
      )}
    </div>
  );
}
