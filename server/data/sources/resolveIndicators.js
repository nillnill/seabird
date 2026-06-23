// 최신성 우선 멀티소스 리졸버 — OECD(월별)·IMF(2026 추정)·WorldBank(폴백+구조지표)를 합쳐
// metric_key별로 **가장 최신 as_of**를 채택(동률 시 OECD>IMF>WB). 전 후보는 원자 저장용으로 함께 반환.
const wb = require('./worldBank');
const imf = require('./imf');
const oecd = require('./oecd');

const SRC_PRIORITY = { OECD: 3, IMF: 2, WorldBank: 1 };

async function resolveIndicators(iso3) {
  const [wbRows, imfRows, oecdRows] = await Promise.all([
    wb.fetchCountry(iso3).catch(() => []),
    imf.fetchCountry(iso3).catch(() => []),
    oecd.fetchCountry(iso3).catch(() => []),
  ]);
  const all = [...wbRows, ...imfRows, ...oecdRows];
  const yearOf = (r) => parseInt((r.as_of || '0').slice(0, 4), 10) || 0;
  const byKey = {};
  for (const r of all) {
    const cur = byKey[r.metric_key];
    if (!cur) { byKey[r.metric_key] = r; continue; }
    // 연도 우선 비교(최신 연도 채택). 같은 연도면 소스 우선순위(OECD 월별 actual > IMF 연간 추정 > WB).
    const newer = yearOf(r) > yearOf(cur)
      || (yearOf(r) === yearOf(cur) && (SRC_PRIORITY[r.source] || 0) > (SRC_PRIORITY[cur.source] || 0));
    if (newer) byKey[r.metric_key] = r;
  }
  return { chosen: Object.values(byKey), all };
}

module.exports = { resolveIndicators };
