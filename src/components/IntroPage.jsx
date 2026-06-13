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

// ── Ch1: 지도자 등장 ──
function ChapterLeader() {
  return (
    <div className="space-y-6">
      <p className="text-lg text-white/80 leading-relaxed">{MALCOLM.greeting}</p>
      <div className="pl-4 border-l-4 border-amber-400/50">
        <p className="text-2xl italic text-amber-100/90 leading-snug" style={{ fontFamily: 'serif' }}>{MALCOLM.quote}</p>
      </div>
      <p className="text-sm text-white/50 leading-snug pt-1">{MALCOLM.title}</p>
    </div>
  );
}

// ── Ch2: 해운의 역사 — 좌우 풀폭 일러스트 배너 + 오버레이 제목 + 서사 ──
function ChapterHistory() {
  return (
    <div className="space-y-8">
      {ERAS.map((e) => (
        <div
          key={e.key}
          className={`rounded-2xl border overflow-hidden ${
            e.star ? 'border-amber-400/45 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.03]'
          }`}
        >
          {/* 좌우 100% 일러스트 배너 */}
          <div className="relative w-full h-64 md:h-80 bg-gradient-to-b from-[#0e2236] to-[#0a1322]">
            <ImageOrEmoji
              src={`/characters/era_${e.key}.webp`} emoji={e.emoji} alt={e.title}
              imgClass="w-full h-full object-cover object-center"
              emojiClass="text-[8rem] w-full h-full"
            />
            {/* 하단 그라데이션 + 제목 오버레이 */}
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-amber-300 tracking-wider">{e.year}</span>
                {e.star && <span className="text-amber-400 text-base">★</span>}
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'serif', textShadow: '0 2px 14px rgba(0,0,0,0.85)' }}>
                {e.title}
              </h3>
              {e.tagline && <p className="text-base md:text-lg italic text-amber-100/90 mt-1.5">“{e.tagline}”</p>}
            </div>
          </div>
          {/* 서사 */}
          <div className="px-6 py-5">
            <p className="text-[15px] md:text-base text-white/75 leading-relaxed">{e.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ch3: 사용할 수 있는 능력 ──
function ChapterAbilities() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {ABILITIES.map((a) => (
        <div key={a.name} className="bg-white/[0.05] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-3xl">{a.icon}</span>
            <h3 className="text-lg font-bold text-white leading-tight">{a.name}</h3>
          </div>
          <p className="text-sm text-white/65 leading-relaxed">{a.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ── Ch4: 자문관의 조언 ──
function ChapterTips() {
  return (
    <div className="space-y-4">
      {TIPS.map((t, i) => (
        <div key={i} className="flex gap-3.5 border-l-4 border-amber-400/50 pl-4 py-1">
          <span className="text-2xl shrink-0">{t.icon}</span>
          <p className="text-base text-white/80 leading-relaxed">
            <span className="text-white/45">제독님, </span>{t.text}
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      {/* Civ 지도자 화면: 어두운 지도 배경 + 좌 텍스트 / 우 대형 초상 */}
      <div
        className="relative w-full max-w-6xl h-[92vh] max-h-[880px] rounded-2xl overflow-hidden border border-sea-border shadow-2xl flex"
        style={{ background: 'radial-gradient(120% 120% at 75% 25%, #16314f 0%, #0c1726 55%, #070b14 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 세계지도 느낌의 은은한 격자 */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, white 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, white 0 1px, transparent 1px 34px)' }}
        />

        {/* 우측 대형 맬컴 초상 (역사 챕터 제외 상주) */}
        {!isHistory && (
          <div className="hidden md:flex absolute inset-y-0 right-0 w-[50%] items-end justify-center pointer-events-none">
            <ImageOrEmoji
              src={MALCOLM.image} emoji={MALCOLM.fallbackEmoji} alt={MALCOLM.nameEn}
              imgClass="h-full w-auto object-contain object-bottom drop-shadow-[0_10px_40px_rgba(0,0,0,0.65)]"
              emojiClass="text-[14rem] h-full"
            />
          </div>
        )}

        {/* 좌측 텍스트 패널 (역사 챕터는 전체 폭) */}
        <div className={`relative z-10 h-full flex flex-col ${
          isHistory
            ? 'w-full bg-[#0b1524]/95'
            : 'w-full md:w-[60%] bg-gradient-to-r from-[#0b1524]/97 via-[#0b1524]/93 to-[#0b1524]/55'
        }`}>
          {/* 헤더 */}
          <div className="flex items-start justify-between px-8 pt-7 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-amber-300/70">
                <span className="text-xs font-mono tracking-[0.35em] uppercase">SEABIRD · 항해 일지</span>
                <span className="text-xs font-mono text-white/30">{String(chapter + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}</span>
              </div>
              <h2 className="text-4xl font-bold text-white tracking-wide mt-2" style={{ fontFamily: 'serif', textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
                {meta.title}
              </h2>
              {chapter === 0 && (
                <p className="text-base text-amber-100/80 mt-1.5" style={{ fontFamily: 'serif' }}>
                  {MALCOLM.name} <span className="font-mono text-xs text-white/40 uppercase tracking-wider">· {MALCOLM.nameEn}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/15 hover:bg-white/10 text-white/50 hover:text-white transition-colors text-base shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="h-px mx-8 bg-gradient-to-r from-amber-400/50 to-transparent" />

          {/* 본문 (스크롤) */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <Body />
          </div>

          {/* 네비 */}
          <div className="flex items-center justify-between gap-3 px-8 py-4 border-t border-white/10 bg-black/25">
            <button
              onClick={prev}
              disabled={chapter === 0}
              className="px-4 py-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm disabled:opacity-25 disabled:cursor-not-allowed"
            >
              ← 이전
            </button>

            <div className="flex items-center gap-2">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setChapter(i)}
                  className={`text-base transition-all ${i === chapter ? 'text-amber-400 scale-125' : i < chapter ? 'text-amber-400/55' : 'text-white/25 hover:text-white/50'}`}
                  aria-label={c.title}
                >
                  {i <= chapter ? '●' : '○'}
                </button>
              ))}
            </div>

            {chapter === last ? (
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
              >
                항해 시작 →
              </button>
            ) : (
              <button
                onClick={next}
                className="px-5 py-2 rounded-lg border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 transition-colors text-sm font-semibold"
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
