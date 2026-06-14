// src/data/regionData.js(ESM)에서 캐릭터 페르소나만 추출해 server/data/regionCharacters.js(CJS)로 미러링.
// 역사(history)·뉴스쿼리는 제외 — 정기 보고는 '현재 상황' 중심이라 캐릭터 페르소나 + 항구 역할만 필요.
// 재생성: node scripts/generate_region_characters.cjs
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const src = path.join(__dirname, '../src/data/regionData.js');
  const mod = await import(pathToFileURL(src).href);
  const REGION_DATA = mod.REGION_DATA;

  const out = {};
  for (const [id, r] of Object.entries(REGION_DATA)) {
    const c = r.character ?? {};
    const s = r.stats ?? {};
    out[id] = {
      type: r.type,
      name: c.name,
      nameEn: c.nameEn,
      title: c.title,
      quote: c.quote,
      symbolEmoji: c.symbolEmoji,
      flagEmoji: c.flagEmoji,
      image: c.image,
      // 캐릭터가 자기 항구를 알고 말하도록 — 역할/규모 한 줄 (역사 아님)
      role: [s.worldRank, s.tradeShare].filter(Boolean).join(' · '),
      topCargoes: s.topCargoes ?? [],
    };
  }

  const header =
    '// AUTO-GENERATED from src/data/regionData.js — 직접 수정 금지.\n' +
    '// 재생성: node scripts/generate_region_characters.cjs\n' +
    '// history 제외 — 정기 캐릭터 보고는 현재 상황 중심.\n';
  const body = `module.exports = { REGION_CHARACTERS: ${JSON.stringify(out, null, 2)} };\n`;
  const dest = path.join(__dirname, '../server/data/regionCharacters.js');
  fs.writeFileSync(dest, header + body);
  console.log('wrote server/data/regionCharacters.js —', Object.keys(out).length, 'regions');
})();
