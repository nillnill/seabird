// 평년(baseline) 산출 공유 정책.
// 충분한 실측 이력이 쌓이기 전엔 하드코딩 기준값을 쓰고, 그 이후 동적 평년으로 전환한다.
// baselines 테이블의 (location_id, metric) 이력에서 0 스냅샷(수집 공백: AIS 단절·
// 마이그레이션 이전 upsert 실패 등)을 제외한 실측 표본만으로 평균을 낸다.
// 30분 간격 스냅샷 기준 — 48표본 ≈ 24h.
const MIN_BASELINE_SAMPLES = 48;
const MIN_BASELINE_SPAN_MS = 24 * 3600000;

// (location_id, metric)의 실측 표본을 읽어 통계를 산출하는 공통 코어.
// 반환: { samples, baseline, mean, std, n, hasDynamic, latest }
//  - samples: [{ v, t }] 0 제외, 시간 오름차순
//  - baseline: 동적 평년(표본 충분 시) 또는 hardcoded
//  - mean/std: 실측 표본 평균·표준편차 (이상치 z-score용, 표본 부족 시 null)
//  - latest: 가장 최근 표본 { v, t } (없으면 null)
async function resolveBaselineStats(db, locationId, metric, hardcoded, windowMs = 90 * 24 * 3600000) {
  const fallback = hardcoded ?? 50;
  const empty = { samples: [], baseline: fallback, mean: null, std: null, n: 0, hasDynamic: false, latest: null };
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

    return {
      samples,
      baseline,
      mean: Math.round(mean * 10) / 10,
      std: Math.round(std * 10) / 10,
      n,
      hasDynamic,
      latest: { v: latest.v, t: new Date(latest.t).toISOString() },
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

module.exports = { resolveBaseline, resolveBaselineStats, MIN_BASELINE_SAMPLES, MIN_BASELINE_SPAN_MS };
