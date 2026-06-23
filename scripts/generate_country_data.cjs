// src/data/countryData.js(ESM)에서 서버(에이전트·라우트 엔진)가 쓰는 데이터를 server/data/countryData.js(CJS)로 미러링.
// 재생성: node scripts/generate_country_data.cjs
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const src = path.join(__dirname, '../src/data/countryData.js');
  const mod = await import(pathToFileURL(src).href);
  const out = {
    COUNTRY_DATA: mod.COUNTRY_DATA,
    EXPORT_PORTS: mod.EXPORT_PORTS,
    COMMODITIES: mod.COMMODITIES,
    WB_INDICATORS: mod.WB_INDICATORS,
    MEDIA_DOMAINS: mod.MEDIA_DOMAINS,
  };
  const header =
    '// AUTO-GENERATED from src/data/countryData.js — 직접 수정 금지.\n' +
    '// 재생성: node scripts/generate_country_data.cjs\n';
  const body =
    `module.exports = ${JSON.stringify(out, null, 2)};\n` +
    'module.exports.COUNTRY_LIST = Object.values(module.exports.COUNTRY_DATA);\n';
  const dest = path.join(__dirname, '../server/data/countryData.js');
  fs.writeFileSync(dest, header + body);
  console.log('wrote server/data/countryData.js —', Object.keys(out.COUNTRY_DATA).length, 'countries');
})();
