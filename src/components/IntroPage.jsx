import { useState, useEffect } from 'react';
import useStore from '../store/useStore.js';
import { MALCOLM, ERAS, ABILITIES, TIPS, CHAPTERS } from '../data/introContent.js';

// 이미지 + 이모지 fallback (RegionIntelPanel onError 패턴) — 이미지 없으면 이모지 표시
function ImageOrEmoji({ src, emoji, alt, imgClass, emojiClass }) {
  return (
    <>
      <img
        src={src}
        alt={alt}
        className={imgClass}
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
      <span className={`hidden items-center justify-center ${emojiClass}`}>{emoji}</span>
    </>
  );
}

// ── Ch1: 지도자 등장 ──
function ChapterLeader() {
  return (
    <div className="space-y-4">
      <div
        className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{ background: `linear-gradient(135deg, ${MALCOLM.bgFrom} 0%, ${MALCOLM.bgTo} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }}
        />
        <div className="relative flex items-center gap-5 p-6">
          <div className="w-40 h-40 shrink-0 flex items-center justify-center">
            <ImageOrEmoji
              src={MALCOLM.image} emoji={MALCOLM.fallbackEmoji} alt={MALCOLM.nameEn}
              imgClass="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              emojiClass="text-7xl w-full h-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white tracking-widest" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)', fontFamily: 'serif' }}>
              {MALCOLM.name}
            </h2>
            <p className="text-[10px] text-white/50 font-mono mt-0.5 uppercase tracking-wider">{MALCOLM.nameEn}</p>
            <p className="text-[12px] text-white/70 mt-1.5 leading-snug">{MALCOLM.title}</p>
            <div className="mt-3 pl-3 border-l-2 border-white/20">
              <p className="text-[13px] italic text-white/70 leading-relaxed">{MALCOLM.quote}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[14px] text-white/75 leading-relaxed">{MALCOLM.greeting}</p>
    </div>
  );
}

// ── Ch2: 해운의 역사 (기술 트리) ──
function ChapterHistory() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest">⏳ 해운 기술 트리</p>
      <div className="relative pl-3">
        <div className="absolute left-[1.35rem] top-3 bottom-3 w-px bg-sea-border" />
        <div className="space-y-3">
          {ERAS.map((e) => (
            <div
              key={e.key}
              className={`relative flex items-center gap-3 rounded-xl border p-3 ${
                e.star ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-black/20">
                <ImageOrEmoji
                  src={`/characters/era_${e.key}.webp`} emoji={e.emoji} alt={e.title}
                  imgClass="w-full h-full object-contain"
                  emojiClass="text-3xl w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/40">{e.year}</span>
                  {e.star && <span className="text-blue-400 text-[11px]">★</span>}
                </div>
                <h3 className="text-[14px] font-bold text-white leading-tight">{e.title}</h3>
                <p className="text-[12px] text-white/65 leading-snug mt-0.5">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ch3: 해금된 능력 ──
function ChapterAbilities() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest">⚓ Seabird가 해금한 능력</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ABILITIES.map((a) => (
          <div key={a.name} className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{a.icon}</span>
              <h3 className="text-[14px] font-bold text-white">{a.name}</h3>
            </div>
            <p className="text-[12px] text-white/60 leading-relaxed">{a.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ch4: 자문관의 조언 ──
function ChapterTips() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest">🧭 자문관의 조언</p>
      <div className="space-y-2.5">
        {TIPS.map((t, i) => (
          <div key={i} className="flex gap-3 border-l-2 border-blue-500/40 pl-3 py-0.5">
            <span className="text-xl shrink-0">{t.icon}</span>
            <p className="text-[13px] text-white/75 leading-relaxed">
              <span className="text-white/45">자문관: 제독님, </span>{t.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHAPTER_BODIES = [ChapterLeader, ChapterHistory, ChapterAbilities, ChapterTips];

export default function IntroPage() {
  const { showIntro, closeIntro } = useStore();
  const [chapter, setChapter] = useState(0);
  const last = CHAPTERS.length - 1;

  const handleClose = () => { closeIntro(); setChapter(0); };
  const next = () => setChapter((c) => Math.min(c + 1, last));
  const prev = () => setChapter((c) => Math.max(c - 1, 0));

  // 열 때마다 1챕터부터
  useEffect(() => { if (showIntro) setChapter(0); }, [showIntro]);

  // 키보드: ESC 닫기, ←/→ 이동
  useEffect(() => {
    if (!showIntro) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showIntro, chapter]);

  if (!showIntro) return null;

  const Body = CHAPTER_BODIES[chapter];
  const meta = CHAPTERS[chapter];

  return (
    <div
      className="fixed inset-0 z-[60] bg-sea-bg/97 backdrop-blur-sm overflow-y-auto"
      onClick={chapter === last ? handleClose : undefined}
    >
      <div
        className="max-w-3xl my-6 mx-4 sm:mx-auto bg-sea-panel border border-sea-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-sea-border shrink-0">
          <div>
            <p className="text-[10px] text-sea-muted font-mono tracking-widest">📜 SEABIRD · 항해 일지</p>
            <p className="text-[10px] text-blue-400/80 font-mono mt-0.5">{meta.kicker} — {meta.title}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-sea-border hover:bg-white/10 text-sea-muted hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-5 min-h-[22rem]">
          <Body />
        </div>

        {/* 네비 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-sea-border shrink-0">
          <button
            onClick={prev}
            disabled={chapter === 0}
            className="px-3 py-1.5 rounded-lg border border-sea-border text-sea-muted hover:text-white hover:bg-white/5 transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>

          <div className="flex items-center gap-1.5">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setChapter(i)}
                className={`transition-all ${i === chapter ? 'text-blue-400 scale-110' : i < chapter ? 'text-blue-400/60' : 'text-white/25'}`}
                aria-label={c.title}
              >
                {i <= chapter ? '●' : '○'}
              </button>
            ))}
          </div>

          {chapter === last ? (
            <button
              onClick={handleClose}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
            >
              항해 시작 →
            </button>
          ) : (
            <button
              onClick={next}
              className="px-3 py-1.5 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-900/20 transition-colors text-xs"
            >
              다음 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
