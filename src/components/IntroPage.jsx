import { useState, useEffect } from 'react';
import useStore from '../store/useStore.js';
import { MALCOLM, ERAS, ABILITIES, TIPS, CHAPTERS } from '../data/introContent.js';

// 이미지 + 이모지 fallback (RegionIntelPanel onError 패턴)
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

// ── Ch1: 지도자 등장 (좌측 텍스트 — 초상은 우측 공용 패널에 크게) ──
function ChapterLeader() {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-white/65 leading-relaxed">{MALCOLM.greeting}</p>
      <div className="pl-3 border-l-2 border-amber-400/40">
        <p className="text-[14px] italic text-amber-100/80 leading-relaxed" style={{ fontFamily: 'serif' }}>{MALCOLM.quote}</p>
      </div>
      <p className="text-[11px] text-white/45 leading-snug pt-1">{MALCOLM.title}</p>
    </div>
  );
}

// ── Ch2: 해운의 역사 — 대형 일러스트 + 풍부한 서사, 스크롤형 기술 트리 ──
function ChapterHistory() {
  return (
    <div className="space-y-5">
      {ERAS.map((e, i) => (
        <div key={e.key} className="relative">
          {/* 연결선(기술 트리) */}
          {i < ERAS.length - 1 && (
            <div className="absolute left-1/2 -bottom-5 w-px h-5 bg-gradient-to-b from-amber-400/40 to-transparent md:hidden" />
          )}
          <div
            className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-4 items-center rounded-2xl border p-4 ${
              e.star ? 'border-amber-400/40 bg-amber-400/[0.07]' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            {/* 대형 일러스트 */}
            <div className="w-full md:w-64 h-48 md:h-52 shrink-0 flex items-center justify-center rounded-xl bg-black/30 overflow-hidden">
              <ImageOrEmoji
                src={`/characters/era_${e.key}.webp`} emoji={e.emoji} alt={e.title}
                imgClass="w-full h-full object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
                emojiClass="text-7xl w-full h-full"
              />
            </div>
            {/* 서사 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono text-amber-300/80 tracking-wider">{e.year}</span>
                {e.star && <span className="text-amber-400 text-xs">★</span>}
              </div>
              <h3 className="text-xl font-bold text-white leading-tight" style={{ fontFamily: 'serif', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
                {e.title}
              </h3>
              {e.tagline && <p className="text-[12px] italic text-amber-100/70 mt-0.5">“{e.tagline}”</p>}
              <p className="text-[13px] text-white/70 leading-relaxed mt-2">{e.desc}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ch3: 해금된 능력 ──
function ChapterAbilities() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {ABILITIES.map((a) => (
        <div key={a.name} className="bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{a.icon}</span>
            <h3 className="text-[13px] font-bold text-white leading-tight">{a.name}</h3>
          </div>
          <p className="text-[11px] text-white/60 leading-relaxed">{a.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ── Ch4: 자문관의 조언 ──
function ChapterTips() {
  return (
    <div className="space-y-2.5">
      {TIPS.map((t, i) => (
        <div key={i} className="flex gap-3 border-l-2 border-amber-400/40 pl-3 py-0.5">
          <span className="text-lg shrink-0">{t.icon}</span>
          <p className="text-[12.5px] text-white/75 leading-relaxed">
            <span className="text-white/40">제독님, </span>{t.text}
          </p>
        </div>
      ))}
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

  useEffect(() => { if (showIntro) setChapter(0); }, [showIntro]);

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
  const isHistory = chapter === 1; // 역사: 전체 폭 + 대형 일러스트(맬컴 숨김)

  return (
    // 전체 화면 + 센터 정렬
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      {/* Civ 지도자 화면: 어두운 지도 배경 + 좌 텍스트 / 우 대형 초상 */}
      <div
        className="relative w-full max-w-5xl h-[88vh] max-h-[780px] rounded-2xl overflow-hidden border border-sea-border shadow-2xl flex"
        style={{ background: 'radial-gradient(120% 120% at 75% 30%, #16314f 0%, #0c1726 55%, #070b14 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 세계지도 느낌의 은은한 패턴 */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, white 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, white 0 1px, transparent 1px 28px)' }}
        />

        {/* 우측 대형 맬컴 초상 (자문관 — 역사 챕터 제외 전 챕터 상주) */}
        {!isHistory && (
          <div className="hidden md:flex absolute inset-y-0 right-0 w-[52%] items-end justify-center pointer-events-none">
            <ImageOrEmoji
              src={MALCOLM.image} emoji={MALCOLM.fallbackEmoji} alt={MALCOLM.nameEn}
              imgClass="h-[97%] w-auto object-contain object-bottom drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
              emojiClass="text-[12rem] h-full"
            />
          </div>
        )}

        {/* 좌측 텍스트 패널 (역사 챕터는 전체 폭) */}
        <div className={`relative z-10 h-full flex flex-col ${
          isHistory
            ? 'w-full bg-[#0b1524]/95'
            : 'w-full md:w-[58%] bg-gradient-to-r from-[#0b1524]/97 via-[#0b1524]/92 to-[#0b1524]/55'
        }`}>
          {/* 헤더 */}
          <div className="flex items-start justify-between px-6 pt-5 pb-3">
            <div>
              <p className="text-[10px] text-amber-300/70 font-mono tracking-[0.3em] uppercase">SEABIRD · 항해 일지</p>
              <h2 className="text-2xl font-bold text-white tracking-wide mt-1" style={{ fontFamily: 'serif', textShadow: '0 1px 10px rgba(0,0,0,0.6)' }}>
                {meta.title}
              </h2>
              {chapter === 0 && (
                <p className="text-[12px] text-amber-100/70 mt-0.5" style={{ fontFamily: 'serif' }}>
                  {MALCOLM.name} · <span className="font-mono text-[10px] text-white/40 uppercase">{MALCOLM.nameEn}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/15 hover:bg-white/10 text-white/50 hover:text-white transition-colors text-sm shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="h-px mx-6 bg-gradient-to-r from-amber-400/40 to-transparent" />

          {/* 본문 (스크롤) */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Body />
          </div>

          {/* 네비 */}
          <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-white/10 bg-black/20">
            <button
              onClick={prev}
              disabled={chapter === 0}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-xs disabled:opacity-25 disabled:cursor-not-allowed"
            >
              ← 이전
            </button>

            <div className="flex items-center gap-1.5">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setChapter(i)}
                  className={`text-xs transition-all ${i === chapter ? 'text-amber-400 scale-110' : i < chapter ? 'text-amber-400/50' : 'text-white/25'}`}
                  aria-label={c.title}
                >
                  {i <= chapter ? '●' : '○'}
                </button>
              ))}
            </div>

            {chapter === last ? (
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
              >
                항해 시작 →
              </button>
            ) : (
              <button
                onClick={next}
                className="px-3 py-1.5 rounded-lg border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 transition-colors text-xs"
              >
                다음 →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
