// 평년(baseline) 산출 공유 정책.
// 충분한 실측 이력이 쌓이기 전엔 하드코딩 기준값을 쓰고, 그 이후 동적 평년으로 전환한다.
// baselines 테이블의 (location_id, metric) 이력에서 0 스냅샷(수집 공백: AIS 단절·
// 마이그레이션 이전 upsert 실패 등)을 제외한 실측 표본만으로 평균을 낸다.
// 30분 간격 스냅샷 기준 — 48표본 ≈ 24h.
const MIN_BASELINE_SAMPLES = 48;
const MIN_BASELINE_SPAN_MS = 24 * 3600000;
const MIN_WINDOW_SAMPLES = 3;          // 롤링 윈도우가 유효하려면 최소 표본 수(1~2표본 노이즈 방지)
const DAY_MS = 24 * 3600000;

const _round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const _pct = (cur, base) => (cur != null && base ? Math.round(((cur - base) / base) * 1000) / 10 : null);

// samples([{v,t}] 오름차순)에서 [now-startAgo, now-endAgo) 구간 평균(표본 부족 시 null).
function _windowMean(samples, startAgo, endAgo, now) {
  const lo = now - startAgo, hi = now - endAgo;
  const vals = [];
  for (const s of samples) if (s.t >= lo && s.t < hi) vals.push(s.v);
  if (vals.length < MIN_WINDOW_SAMPLES) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// 7일·30일 이동평균 + 직전 동기간 대비(WoW/MoM) + z-score(단기 평활 레벨의 이상치 정도).
// 단일 시점 스냅샷의 노이즈를 제거하고 '롤링 추세'로 판단하기 위한 공통 산출.
//  - ma7/ma30: 최근 7일·30일 평균(평활 현재값)
//  - wow7: 최근 7일 vs 직전 7일(14일 이력 필요, 없으면 null='누적 중')
//  - mom30: 최근 30일 vs 직전 30일(60일 이력 필요, 없으면 null)
//  - z: (ma7 - 전체평균)/표준편차 — |z|≥1.5면 통계적으로 유의(노이즈 게이팅)
function rollingFromSamples(samples, mean, std, now) {
  const ma7 = _windowMean(samples, 7 * DAY_MS, 0, now);
  const prev7 = _windowMean(samples, 14 * DAY_MS, 7 * DAY_MS, now);
  const ma30 = _windowMean(samples, 30 * DAY_MS, 0, now);
  const prev30 = _windowMean(samples, 60 * DAY_MS, 30 * DAY_MS, now);
  const z = (ma7 != null && std) ? Math.round(((ma7 - mean) / std) * 100) / 100 : null;
  return {
    ma7: _round1(ma7), ma30: _round1(ma30),
    prev7: _round1(prev7), prev30: _round1(prev30),
    wow7: _pct(ma7, prev7), mom30: _pct(ma30, prev30),
    z,
  };
}

// (location_id, metric)의 실측 표본을 읽어 통계를 산출하는 공통 코어.
// 반환: { samples, baseline, mean, std, n, hasDynamic, latest }
//  - samples: [{ v, t }] 0 제외, 시간 오름차순
//  - baseline: 동적 평년(표본 충분 시) 또는 hardcoded
//  - mean/std: 실측 표본 평균·표준편차 (이상치 z-score용, 표본 부족 시 null)
//  - latest: 가장 최근 표본 { v, t } (없으면 null)
async function resolveBaselineStats(db, locationId, metric, hardcoded, windowMs = 90 * 24 * 3600000) {
  const fallback = hardcoded ?? 50;
  const emptyRoll = { ma7: null, ma30: null, prev7: null, prev30: null, wow7: null, mom30: null, z: null };
  const empty = { samples: [], baseline: fallback, mean: null, std: null, n: 0, hasDynamic: false, latest: null, roll: emptyRoll, smoothedCurrent: null, smoothedChangePct: null };
  try {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const { data: rows } = await db
      .from('baselines')
      .select('current_value, snapshot_at')
      .eq('location_id', locationId)
      .eq('metric', metric)
      .gte('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: true });

    const samples = (rows ?? [])
      .map(r => ({ v: parseFloat(r.current_value), t: Date.parse(r.snapshot_at) }))
      .filter(s => s.v > 0 && Number.isFinite(s.t)); // 0 = 수집 공백 → 제외

    if (!samples.length) return empty;

    const latest = samples[samples.length - 1];
    const n = samples.length;
    const mean = samples.reduce((s, x) => s + x.v, 0) / n;
    const variance = samples.reduce((s, x) => s + (x.v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    const span = latest.t - samples[0].t;
    const hasDynamic = n >= MIN_BASELINE_SAMPLES && span >= MIN_BASELINE_SPAN_MS;
    const baseline = hasDynamic && mean > 0 ? Math.round(mean * 10) / 10 : fallback;

    // 롤링(7일·30일) 추세 — 단일 스냅샷 과대반응 방지용. smoothedCurrent=ma7(없으면 최신값).
    const roll = rollingFromSamples(samples, mean, std, Date.now());
    const smoothedCurrent = roll.ma7 ?? Math.round(latest.v * 10) / 10;

    return {
      samples,
      baseline,
      mean: Math.round(mean * 10) / 10,
      std: Math.round(std * 10) / 10,
      n,
      hasDynamic,
      latest: { v: latest.v, t: new Date(latest.t).toISOString() },
      roll,                                              // { ma7, ma30, prev7, prev30, wow7, mom30, z }
      smoothedCurrent,                                   // 평활 현재값(7일 평균 우선)
      smoothedChangePct: _pct(smoothedCurrent, baseline), // 평활 현재값 vs 평년(순간값 대신 이걸로 보고)
    };
  } catch {
    return empty;
  }
}

// 기존 시그니처 유지 — 평년 단일값만 필요할 때.
async function resolveBaseline(db, locationId, metric, hardcoded) {
  const { baseline } = await resolveBaselineStats(db, locationId, metric, hardcoded);
  return baseline;
}

module.exports = { resolveBaseline, resolveBaselineStats, rollingFromSamples, MIN_BASELINE_SAMPLES, MIN_BASELINE_SPAN_MS, MIN_WINDOW_SAMPLES };
