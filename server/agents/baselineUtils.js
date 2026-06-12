// 평년(baseline) 산출 공유 정책.
// 충분한 실측 이력이 쌓이기 전엔 하드코딩 기준값을 쓰고, 그 이후 동적 평년으로 전환한다.
// baselines 테이블의 (location_id, metric) 이력에서 0 스냅샷(수집 공백: AIS 단절·
// 마이그레이션 이전 upsert 실패 등)을 제외한 실측 표본만으로 평균을 낸다.
// 30분 간격 스냅샷 기준 — 48표본 ≈ 24h.
const MIN_BASELINE_SAMPLES = 48;
const MIN_BASELINE_SPAN_MS = 24 * 3600000;

// db: supabase 클라이언트, metric: 'daily_throughput' | 'waiting_ships' 등
async function resolveBaseline(db, locationId, metric, hardcoded) {
  const fallback = hardcoded ?? 50;
  try {
    const cutoff90 = new Date(Date.now() - 90 * 24 * 3600000).toISOString();
    const { data: rows } = await db
      .from('baselines')
      .select('current_value, snapshot_at')
      .eq('location_id', locationId)
      .eq('metric', metric)
      .gte('snapshot_at', cutoff90)
      .order('snapshot_at', { ascending: true });

    const samples = (rows ?? [])
      .map(r => ({ v: parseFloat(r.current_value), t: Date.parse(r.snapshot_at) }))
      .filter(s => s.v > 0 && Number.isFinite(s.t)); // 0 = 수집 공백 → 제외

    if (samples.length < MIN_BASELINE_SAMPLES) return fallback;
    const span = samples[samples.length - 1].t - samples[0].t;
    if (span < MIN_BASELINE_SPAN_MS) return fallback;

    const avg = samples.reduce((s, x) => s + x.v, 0) / samples.length;
    return avg > 0 ? Math.round(avg * 10) / 10 : fallback;
  } catch {
    return fallback;
  }
}

module.exports = { resolveBaseline, MIN_BASELINE_SAMPLES, MIN_BASELINE_SPAN_MS };
