import useStore from '../store/useStore.js';

// 모바일 하단 탭바 — 지도 ↔ 피드 전환 (md 미만에서만 표시). 한 번에 하나만 풀스크린.
export default function MobileTabBar() {
  const { mobileView, setMobileView } = useStore();
  const tabs = [
    { id: 'map', icon: '🗺️', label: '지도' },
    { id: 'feed', icon: '📡', label: '피드' },
  ];
  return (
    <nav className="md:hidden shrink-0 flex border-t border-sea-border bg-sea-panel">
      {tabs.map((t) => {
        const active = mobileView === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setMobileView(t.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] transition-colors ${
              active ? 'text-amber-300 bg-white/5' : 'text-sea-muted'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
