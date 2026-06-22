// X CAPITAL — 데스크별 투자 신호 집계 (공유 모듈).
// /api/xcap/desks(엔드포인트)와 investmentAnalyst(에이전트)가 공용.
//
// 3 페르소나(Billions) ↔ 섹터 데스크 ↔ 우리 데이터 ↔ 종목 매핑:
//   - Bobby Axelrod  → 컨테이너·해운 (항만 혼잡 + 컨테이너 운임 → 해운주)
//   - Taylor Mason   → 건화물·철강 (벌크 입항·Δ흘수 + KDCI 건화물운임 → 철강주)
//   - Mike Wagner    → 에너지·정유 (탱커 입항·원유 유입 + 원유가 → 정유주)
//
// 각 지표에 mode 플래그: 'live'(실측 충분) / 'estimate'(하드코딩 기준) / 'demo'(축적 중).
const { aggregatePort } = require('./trafficAggregator');
const { resolveBaselineStats, rollingFromSamples } = require('./baselineUtils');

// 데스크 정의. ports[0]은 시계열·상관용 대표 항. PORTS는 호출부(index.js)에서 주입.
const DESKS = [
  {
    key: 'axelrod', persona: 'Bobby Axelrod', desk: '컨테이너·해운',
    portIds: ['busan', 'la_lb', 'rotterdam'],
    inflowKey: 'est_container_teu', inflowLabel: '컨테이너 입항(추정 TEU)', inflowUnit: 'TEU',
    chartFreight: 'KCCI', chartFreightLabel: 'KCCI 컨테이너선운임지수',
    korItems: [], // 컨테이너는 품목 분류가 분산 — 부산 공식 입항(척수)만 사용
    equities: ['HMM', '팬오션', '대한해운'],
  },
  {
    // 철강 대표 국내 항(POSCO 광양·포항, 현대제철 당진) — 중국 본토(칭다오·닝보)는 AIS 공백이라 제외
    key: 'taylor', persona: 'Taylor Mason', desk: '건화물·철강',
    portIds: ['gwangyang', 'pohang', 'dangjin'],
    inflowKey: 'est_dry_bulk_dwt', inflowLabel: '건화물 입항(추정 DWT)', inflowUnit: 'DWT',
    chartFreight: 'KDCI', chartFreightLabel: 'KOBC 건화물운임지수(KDCI)',
    korItems: ['13', '12'], // 철광석·유연탄 (전국 처리량)
    equities: ['POSCO홀딩스', '현대제철', '대한제강'],
  },
  {
    // 원유·정유 항(울산 SK·S-Oil, 여수 GS칼텍스, 광양, 싱가포르·로테르담 석유허브) + 더티탱커 운임(BDTI)
    key: 'wagner', persona: 'Mike Wagner', desk: '에너지·정유',
    portIds: ['ulsan', 'yeosu', 'gwangyang', 'singapore', 'rotterdam'],
    inflowKey: 'est_liquid_dwt', inflowLabel: '원유·석유제품 입항(추정 DWT)', inflowUnit: 'DWT',
    chartFreight: 'BWET', chartFreightLabel: 'BWET 탱커운임 ETF',
    korItems: ['15', '16'], // 원유·석유정제품 (전국 처리량)
    equities: ['S-Oil', 'GS', 'SK이노베이션'],
  },
];

// 일별 평균으로 리샘플 → [{date:'YYYY-MM-DD', v}]
function toDaily(samples) {
  const byDay = {};
  for (const s of samples) {
    const d = new Date(s.t).toISOString().slice(0, 10);
    (byDay[d] ??= []).push(s.v);
  }
  return Object.entries(byDay)
    .map(([date, vs]) => ({ date, v: vs.reduce((a, b) => a + b, 0) / vs.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 두 일별 시계열의 시차별 Pearson 상관 (lag 0..maxLag일, series2가 series1보다 lag일 후행).
// 겹치는 표본이 minOverlap 미만이면 demo.
function lagCorrelation(daily1, daily2, maxLag = 14, minOverlap = 14) {
  const map2 = new Map(daily2.map(d => [d.date, d.v]));
  let best = { lag: 0, r: 0, n: 0 };
  const addDays = (date, k) => {
    const dt = new Date(date + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + k);
    return dt.toISOString().slice(0, 10);
  };
  for (let lag = 0; lag <= maxLag; lag++) {
    const xs = [], ys = [];
    for (const { date, v } of daily1) {
      const y = map2.get(addDays(date, lag));
      if (y != null) { xs.push(v); ys.push(y); }
    }
    const n = xs.length;
    if (n < minOverlap) continue;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
    const r = dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
    if (Math.abs(r) > Math.abs(best.r)) best = { lag, r: Math.round(r * 100) / 100, n };
  }
  const mode = best.n >= minOverlap ? 'live' : 'demo';
  return { ...best, mode, overlapDays: best.n };
}

function trendOf(daily) {
  if (daily.length < 3) return 'flat';
  const last3 = daily.slice(-3).map(d => d.v);
  const slope = last3[2] - last3[0];
  const scale = Math.abs(last3[0]) || 1;
  if (slope / scale > 0.05) return 'rising';
  if (slope / scale < -0.05) return 'falling';
  return 'flat';
}

// 운임 시계열 조회 → 일별 [{date,v}] + 최신/직전 변동
async function freightSeries(db, code, days = 120) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data } = await db.from('freight_history')
    .select('obs_date, value, unit')
    .eq('index_code', code)
    .gte('obs_date', cutoff)
    .order('obs_date', { ascending: true });
  const rows = (data ?? []).filter(r => r.value != null);
  const daily = rows.map(r => ({ date: r.obs_date, v: parseFloat(r.value) }));
  const unit = rows.length ? rows[rows.length - 1].unit : '';
  const latest = daily[daily.length - 1] ?? null;
  const prev = daily.length >= 2 ? daily[daily.length - 2] : null;
  const change_pct = latest && prev && prev.v ? Math.round(((latest.v - prev.v) / prev.v) * 1000) / 10 : null;
  return { daily, unit, latest, change_pct, mode: daily.length ? 'live' : 'demo' };
}

const HARDCODED_PORT_BASELINE = {
  busan: 250, la_lb: 200, rotterdam: 880, gwangyang: 120, qingdao: 300, ningbo: 350, singapore: 600, shanghai: 700,
  ulsan: 60, yeosu: 30, pohang: 25, dangjin: 20, // 국내 산업항(철강·정유)
};

// 해양수산부 공식 통계(kor_port_monthly)가 커버하는 국내 항만 + 품목코드→한글명
const KOR_PORT_IDS = new Set(['gwangyang', 'pohang', 'dangjin', 'ulsan', 'yeosu', 'busan', 'incheon']);
const KOR_CARGO_NAMES = {
  '11': '무연탄', '12': '유연탄', '13': '철광석', '15': '원유', '16': '석유정제품', '17': '석유가스', '25': '고철', '26': '철강제품',
};

// 월별 합계 맵 빌드 — [{period_ym, value}] → { 'YYYYMM': sum }
function sumByYm(rows) {
  const m = {};
  for (const r of rows ?? []) { const v = parseFloat(r.value); if (Number.isFinite(v)) m[r.period_ym] = (m[r.period_ym] ?? 0) + v; }
  return m;
}

const addIsoDays = (iso, k) => { const dt = new Date(iso + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + k); return dt.toISOString().slice(0, 10); };

// 해역 통항 밀집도(GICOMS sea_density_daily, 일별 준실시간) — 데스크 국내항 합산 신호.
// ⚠️ 일변동(CoV 6~12%)이 커서 DoD는 노이즈 — 7일/30일 이동평균·WoW·z-score를 주지표로 한다.
// 반환: 7d/30d MA·wow7·z(주지표) + latest/dod(참고) + 최신일 항구분해 + 일별 시계열(모달). 데이터 없으면 demo.
async function seaDensityForDesk(db, portIds, days = 30) {
  const korPorts = portIds.filter(id => KOR_PORT_IDS.has(id));
  const empty = { latest: null, latest_date: null, dod: null, ma7: null, ma30: null, wow7: null, z: null, trend: 'flat', ports: [], series: [], mode: 'demo' };
  if (!korPorts.length) return empty;
  const cutoff = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10); // 30d MA + WoW 버퍼
  const { data, error } = await db.from('sea_density_daily')
    .select('port_id, obs_date, ais_sum')
    .in('port_id', korPorts).gte('obs_date', cutoff)
    .order('obs_date', { ascending: true });
  if (error || !data || !data.length) return empty;

  const sumByDay = {}, portsByDay = {};
  for (const r of data) {
    const day = String(r.obs_date).slice(0, 10), v = parseFloat(r.ais_sum);
    if (!Number.isFinite(v)) continue;
    sumByDay[day] = (sumByDay[day] ?? 0) + v;
    (portsByDay[day] ??= {})[r.port_id] = (portsByDay[day][r.port_id] ?? 0) + v;
  }
  const daysSorted = Object.keys(sumByDay).sort();
  if (!daysSorted.length) return empty;
  const latestDay = daysSorted[daysSorted.length - 1], prevDay = daysSorted[daysSorted.length - 2];
  const pct = (cur, pv) => (cur != null && pv ? Math.round(((cur - pv) / pv) * 1000) / 10 : null);

  // 7일/30일 롤링 — baselineUtils 공통 헬퍼 재사용(노이즈 게이팅 z 포함)
  const samples = daysSorted.map(d => ({ v: sumByDay[d], t: Date.parse(d + 'T00:00:00Z') }));
  const mean = samples.reduce((a, s) => a + s.v, 0) / samples.length;
  const std = Math.sqrt(samples.reduce((a, s) => a + (s.v - mean) ** 2, 0) / samples.length);
  const roll = rollingFromSamples(samples, mean, std, Date.now());

  const series = daysSorted.map(d => ({ date: d, v: Math.round(sumByDay[d]) }));
  const ports = Object.entries(portsByDay[latestDay] ?? {})
    .map(([port_id, value]) => ({ port_id, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  // 추세는 3점 기울기(trendOf) 대신 7일 vs 직전7일(wow7) 부호로 — 노이즈에 강함
  const trend = roll.wow7 == null ? 'flat' : roll.wow7 > 3 ? 'rising' : roll.wow7 < -3 ? 'falling' : 'flat';
  return {
    latest: Math.round(sumByDay[latestDay]),
    latest_date: latestDay,
    dod: pct(sumByDay[latestDay], prevDay ? sumByDay[prevDay] : null), // 참고(노이즈)
    ma7: roll.ma7, ma30: roll.ma30, wow7: roll.wow7, z: roll.z,        // 주지표
    trend,
    ports,
    series: series.slice(-days).map(s => ({ date: s.date, value: s.v })),
    mode: 'live',
  };
}

// 데스크의 국내 공식 통계 — 입항 척수(월)·전국 품목 처리량(월)·MoM + GICOMS 해역밀집(일별).
async function korStatsForDesk(db, desk) {
  const korPorts = desk.portIds.filter(id => KOR_PORT_IDS.has(id));
  const items = desk.korItems ?? [];
  const empty = { vessel_calls: null, vessel_mom: null, cargo: null, cargo_mom: null, cargo_label: null, sea_density: null, sea_density_date: null, sea_density_dod: null, sea_density_ma7: null, sea_density_ma30: null, sea_density_wow: null, sea_density_z: null, sea_density_trend: null, sea_density_ports: [], sea_density_series: [], ports: korPorts, latest_ym: null, mode: 'demo' };
  if (!korPorts.length && !items.length) return empty;

  const [vesRes, cargoRes, sea] = await Promise.all([
    korPorts.length ? db.from('kor_port_monthly').select('period_ym, value').eq('category', 'vessel').eq('item', 'in').in('port_id', korPorts) : Promise.resolve({ data: [] }),
    items.length ? db.from('kor_port_monthly').select('period_ym, value').eq('category', 'cargo').eq('port_id', 'KR').in('item', items) : Promise.resolve({ data: [] }),
    seaDensityForDesk(db, desk.portIds),
  ]);
  const ves = sumByYm(vesRes.data), carg = sumByYm(cargoRes.data);
  const yms = [...new Set([...Object.keys(ves), ...Object.keys(carg)])].sort();
  const latest = yms[yms.length - 1], prior = yms[yms.length - 2];
  const mom = (cur, pv) => (cur != null && pv ? Math.round(((cur - pv) / pv) * 1000) / 10 : null);
  if (!yms.length && sea.latest == null) return empty;

  return {
    vessel_calls: ves[latest] ?? null,
    vessel_mom: mom(ves[latest], prior ? ves[prior] : null),
    cargo: carg[latest] ?? null,
    cargo_mom: mom(carg[latest], prior ? carg[prior] : null),
    cargo_label: items.map(c => KOR_CARGO_NAMES[c] ?? c).join('+') || null,
    sea_density: sea.latest,
    sea_density_date: sea.latest_date,
    sea_density_dod: sea.dod,          // 참고(노이즈)
    sea_density_ma7: sea.ma7,          // 주지표 — 7일 평균
    sea_density_ma30: sea.ma30,        // 30일 평균(구조적)
    sea_density_wow: sea.wow7,         // 주간 변화(7d vs 직전 7d)
    sea_density_z: sea.z,              // 7일 평균 이상치(|z|≥1.5 유의)
    sea_density_trend: sea.trend,      // wow7 부호 기반
    sea_density_ports: sea.ports,
    sea_density_series: sea.series,
    ports: korPorts,
    latest_ym: latest ?? null,
    mode: (Object.keys(ves).length || Object.keys(carg).length || sea.latest != null) ? 'live' : 'demo',
  };
}

const DWELL_LIVE_MIN = 10;     // 현재 윈도우 마감 체류 ≥10건이면 live
const REF_DWELL_HOURS = 24;    // 수요압력 중립 기준(1일). curAvg=24h & congIndex=100 → pressure 100

const _mean = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const _median = (arr) => {
  if (!arr || !arr.length) return null;
  const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const _round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// dwell_events에서 항만군의 체류 신호 산출. congIndex(0~)는 수요압력 합성에 사용.
// 현재 윈도우[now-days, now] + 직전 윈도우[now-2*days, now-days]를 한 번에 조회.
async function dwellSignals(db, portIds, congIndex, days = 30) {
  const empty = {
    avg_dwell_hours: null, median_hours: null, turnover_per_day: null,
    prior_avg: null, trend_pct: null, pressure: null, n: 0, mode: 'demo',
  };
  const now = Date.now(), winMs = days * 86400000;
  const { data, error } = await db.from('dwell_events')
    .select('dwell_hours, exited_at')
    .in('port_id', portIds)
    .gte('exited_at', new Date(now - 2 * winMs).toISOString())
    .order('exited_at', { ascending: false })
    .limit(5000);
  if (error || !data) return empty;

  const curStart = now - winMs, cur = [], prior = [];
  for (const r of data) {
    const t = new Date(r.exited_at).getTime(), h = parseFloat(r.dwell_hours);
    if (!isFinite(h)) continue;
    (t >= curStart ? cur : prior).push(h);
  }
  const curAvg = _mean(cur), priorAvg = _mean(prior), n = cur.length;
  const mode = n >= DWELL_LIVE_MIN ? 'live' : 'demo';
  const trend_pct = (curAvg != null && priorAvg != null && priorAvg > 0)
    ? Math.round(((curAvg - priorAvg) / priorAvg) * 1000) / 10 : null;
  // 수요압력: 체류↑(선석 점유 지속) + 혼잡↑(대기 적체) → 100 초과 = 강세 신호
  const pressure = (mode === 'live' && curAvg != null && congIndex != null)
    ? Math.round(0.5 * (curAvg / REF_DWELL_HOURS) * 100 + 0.5 * congIndex) : null;
  return {
    avg_dwell_hours: _round1(curAvg), median_hours: _round1(_median(cur)),
    turnover_per_day: Math.round((n / days) * 10) / 10,
    prior_avg: _round1(priorAvg), trend_pct, pressure, n, mode,
  };
}

// 한 데스크의 모든 신호를 빌드. ports: PORTS 레지스트리(주입), aggMemo: 요청 내 항만 집계 메모.
async function buildDesk(db, desk, ports, aggMemo) {
  const portObjs = desk.portIds.map(id => ports.find(p => p.id === id)).filter(Boolean);

  // 항만별 집계(메모로 중복 제거) → 혼잡·유입 합산.
  // ⚠️ 혼잡은 순간 합(waitSum)이 아니라 7일 평균 합(smoothedWait)으로 index/change_pct를 낸다(단일 시점 과대반응 방지).
  let waitSum = 0, baseSum = 0, inflowSum = 0, draughtVals = [];
  let ma7Sum = 0, prev7Sum = 0, ma7HasAny = false, prev7HasAny = false;
  const statsPerPort = {};
  for (const p of portObjs) {
    if (!aggMemo[p.id]) aggMemo[p.id] = await aggregatePort(db, p);
    const agg = aggMemo[p.id];
    waitSum += agg.waiting_ships ?? 0;
    baseSum += HARDCODED_PORT_BASELINE[p.id] ?? 100;
    inflowSum += agg.commodity_inflow?.[desk.inflowKey] ?? 0;
    if (agg.avg_draught != null) draughtVals.push(agg.avg_draught);
    const st = await resolveBaselineStats(db, p.id, 'waiting_ships', HARDCODED_PORT_BASELINE[p.id] ?? 100);
    statsPerPort[p.id] = st;
    if (st.roll?.ma7 != null) { ma7Sum += st.roll.ma7; ma7HasAny = true; } else { ma7Sum += agg.waiting_ships ?? 0; }
    if (st.roll?.prev7 != null) { prev7Sum += st.roll.prev7; prev7HasAny = true; }
  }
  const smoothedWait = ma7HasAny ? ma7Sum : waitSum; // 7일 평균 합(없으면 순간값 폴백)

  // 대표 항 시계열(상관·z용) + 데스크 주간 변화(7d 합 vs 직전 7d 합)
  const primary = portObjs[0];
  const stats = statsPerPort[primary?.id] ?? { samples: [], hasDynamic: false, mean: null, std: null, latest: null, roll: {} };
  const congDaily = toDaily(stats.samples);
  const z = stats.roll?.z ?? null;
  const congWow = prev7HasAny && prev7Sum > 0 ? Math.round(((ma7Sum - prev7Sum) / prev7Sum) * 1000) / 10 : (stats.roll?.wow7 ?? null);

  // 운임 시계열 + 상관
  const freight = await freightSeries(db, desk.chartFreight);
  const corr = (congDaily.length && freight.daily.length)
    ? lagCorrelation(congDaily, freight.daily)
    : { lag: 0, r: 0, n: 0, mode: 'demo', overlapDays: 0 };

  // Δ흘수 화물 추정 — draft_events 표본
  const { count: draftN } = await db.from('draft_events').select('id', { count: 'exact', head: true })
    .in('port_id', desk.portIds);
  const draftMode = (draftN ?? 0) >= 20 ? 'live' : 'demo';

  // 관측 가능 여부 — 7일 이력도 없고 순간값도 0이면 AIS 사각지대(국내 산업항)라 혼잡 미관측.
  // 이때 index/change_pct를 -100%로 내면 '붕괴'처럼 오인되므로 null+demo로 정직하게 표시(sea_density·공식통계로 판단).
  const congObservable = ma7HasAny || waitSum > 0;
  const congIndex = (congObservable && baseSum > 0) ? Math.round((smoothedWait / baseSum) * 100) : null; // 100 = 평년 (7일 평균)
  const congPct = (congObservable && baseSum > 0) ? Math.round(((smoothedWait - baseSum) / baseSum) * 100) : null;
  const congMode = !congObservable ? 'demo' : (stats.hasDynamic ? 'live' : 'estimate');

  // 체류시간(dwell) 신호 — 회전속도·대기 적체·수요압력
  const dwell = await dwellSignals(db, desk.portIds, congIndex);
  // 해양수산부 월별 공식 통계(국내항 입항 척수 + 전국 품목 처리량) — AIS 사각지대 보완
  const korStats = await korStatsForDesk(db, desk);

  return {
    key: desk.key, persona: desk.persona, desk: desk.desk, equities: desk.equities,
    congestion: {
      current: waitSum, baseline: baseSum, index: congIndex, change_pct: congPct, z, wow: congWow,
      trend: congWow == null ? trendOf(congDaily) : congWow > 3 ? 'rising' : congWow < -3 ? 'falling' : 'flat',
      mode: congMode, ports: desk.portIds,
    },
    inflow: { key: desk.inflowKey, label: desk.inflowLabel, unit: desk.inflowUnit, value: Math.round(inflowSum), mode: 'live' },
    freight: {
      code: desk.chartFreight, label: desk.chartFreightLabel, unit: freight.unit,
      current: freight.latest?.v ?? null, change_pct: freight.change_pct, mode: freight.mode,
    },
    correlation: corr,
    draft: { avg: draughtVals.length ? Math.round(draughtVals.reduce((a, b) => a + b, 0) / draughtVals.length * 10) / 10 : null, samples: draftN ?? 0, mode: draftMode },
    dwell: {
      avg_hours: dwell.avg_dwell_hours, median_hours: dwell.median_hours,
      turnover_per_day: dwell.turnover_per_day, trend_pct: dwell.trend_pct,
      pressure: dwell.pressure, samples: dwell.n, mode: dwell.mode,
    },
    korStats,
  };
}

// 전 데스크 빌드. 한 요청 내 항만 집계는 메모로 1회만.
async function buildAllDesks(db, ports) {
  const aggMemo = {};
  const desks = [];
  for (const desk of DESKS) desks.push(await buildDesk(db, desk, ports, aggMemo));
  // 전체 모드: 하나라도 demo면 demo, estimate 있으면 estimate, 아니면 live
  const modes = desks.flatMap(d => [d.congestion.mode, d.freight.mode, d.correlation.mode, d.draft.mode, d.dwell.mode]);
  const overallMode = modes.includes('demo') ? 'demo' : modes.includes('estimate') ? 'estimate' : 'live';
  return { desks, mode: overallMode, generated_at: new Date().toISOString() };
}

// 한 데스크의 정렬된 일별 시계열(혼잡·입항·유입·체류·운임). 차트·자세히 표 공용.
// 혼잡은 데스크의 전 항구를 합산(대표 항 1곳만 쓰던 차트 버그 수정).
async function buildDeskSeries(db, desk, ports, days = 30) {
  const cutoffIso = new Date(Date.now() - days * 86400000).toISOString();
  const cutoffDay = cutoffIso.slice(0, 10);
  const portIds = desk.portIds;

  // 혼잡: baselines 단일 쿼리 → 항구별 일평균을 일자별로 합산 (0 스냅샷 제외 — baselineUtils 정책)
  const { data: baseRows } = await db.from('baselines')
    .select('current_value, snapshot_at, location_id')
    .in('location_id', portIds).eq('metric', 'waiting_ships')
    .gte('snapshot_at', cutoffIso).order('snapshot_at', { ascending: true }).limit(5000);
  const congPD = {}; // `${loc}|${day}` → {sum,n}
  for (const r of (baseRows ?? [])) {
    const v = parseFloat(r.current_value);
    if (!(v > 0)) continue;
    const k = r.location_id + '|' + String(r.snapshot_at).slice(0, 10);
    (congPD[k] ??= { sum: 0, n: 0 }); congPD[k].sum += v; congPD[k].n++;
  }
  const congByDay = {};
  for (const [k, o] of Object.entries(congPD)) {
    const day = k.split('|')[1];
    congByDay[day] = (congByDay[day] ?? 0) + o.sum / o.n;
  }

  // 입항·유입: traffic_snapshots 단일 쿼리 → 일자별 inbound 평균 + inflow[inflowKey] 평균
  const { data: trafRows } = await db.from('traffic_snapshots')
    .select('inbound, commodity_inflow, snapshot_at, location_id')
    .in('location_id', portIds).eq('location_type', 'port')
    .gte('snapshot_at', cutoffIso).order('snapshot_at', { ascending: false }).limit(5000);
  const inbPD = {}, inflPD = {};
  for (const r of (trafRows ?? [])) {
    const day = String(r.snapshot_at).slice(0, 10);
    (inbPD[day] ??= []).push(r.inbound ?? 0);
    (inflPD[day] ??= []).push(r.commodity_inflow?.[desk.inflowKey] ?? 0);
  }

  // 체류: dwell_events → exited_at 일자별 dwell_hours 평균
  const { data: dwellRows } = await db.from('dwell_events')
    .select('dwell_hours, exited_at')
    .in('port_id', portIds).gte('exited_at', cutoffIso)
    .order('exited_at', { ascending: false }).limit(5000);
  const dwPD = {};
  for (const r of (dwellRows ?? [])) {
    const h = parseFloat(r.dwell_hours);
    if (isFinite(h)) (dwPD[String(r.exited_at).slice(0, 10)] ??= []).push(h);
  }

  // 운임
  const freight = await freightSeries(db, desk.chartFreight, days);
  const frByDay = {};
  for (const d of freight.daily) frByDay[d.date] = d.v;

  // 해양수산부 월별 공식 통계(입항 척수·품목 처리량, 월별 → 일별 계단) + GICOMS 해역밀집(일별)
  const korPorts = portIds.filter(id => KOR_PORT_IDS.has(id));
  const korItems = desk.korItems ?? [];
  const [korVesRes, korCargRes, seaRes] = await Promise.all([
    korPorts.length ? db.from('kor_port_monthly').select('period_ym, value').eq('category', 'vessel').eq('item', 'in').in('port_id', korPorts) : Promise.resolve({ data: [] }),
    korItems.length ? db.from('kor_port_monthly').select('period_ym, value').eq('category', 'cargo').eq('port_id', 'KR').in('item', korItems) : Promise.resolve({ data: [] }),
    korPorts.length ? db.from('sea_density_daily').select('obs_date, ais_sum').in('port_id', korPorts).gte('obs_date', cutoffDay) : Promise.resolve({ data: [] }),
  ]);
  const korVesByYm = sumByYm(korVesRes.data), korCargByYm = sumByYm(korCargRes.data);
  // 공식 통계는 2개월가량 지연 발행 → 그 달 값이 없으면 최근 발행월 값을 캐리포워드(최신 공식 수치 유지)
  const korVesMonths = Object.keys(korVesByYm).sort(), korCargMonths = Object.keys(korCargByYm).sort();
  const carryFwd = (map, months, ym) => { let v = null; for (const mo of months) { if (mo <= ym) v = map[mo]; else break; } return v; };
  // 해역밀집(GICOMS) — 일자별 국내항 합산 (일별 라인, 카운트 단위라 calendar day로 합산)
  const seaByDay = {};
  for (const r of (seaRes.data ?? [])) { const v = parseFloat(r.ais_sum); if (Number.isFinite(v)) { const d = String(r.obs_date).slice(0, 10); seaByDay[d] = (seaByDay[d] ?? 0) + v; } }

  const dates = new Set([
    ...Object.keys(congByDay), ...Object.keys(inbPD), ...Object.keys(inflPD),
    ...Object.keys(dwPD), ...Object.keys(frByDay), ...Object.keys(seaByDay),
  ]);
  const series = [...dates].filter(d => d >= cutoffDay).sort().map(date => {
    const ym = date.slice(0, 7).replace('-', ''); // 'YYYY-MM-DD' → 'YYYYMM'
    return {
      date,
      congestion: congByDay[date] != null ? Math.round(congByDay[date]) : null,
      inbound: inbPD[date] ? Math.round(_mean(inbPD[date])) : null,
      inflow: inflPD[date] ? Math.round(_mean(inflPD[date])) : null,
      dwell: dwPD[date] ? Math.round(_mean(dwPD[date]) * 10) / 10 : null,
      freight: frByDay[date] ?? null,
      korVessel: carryFwd(korVesByYm, korVesMonths, ym),   // 월 계단(공식 입항 척수, 캐리포워드)
      korCargo: carryFwd(korCargByYm, korCargMonths, ym),  // 월 계단(전국 품목 처리량, 캐리포워드)
      seaDensity: seaByDay[date] != null ? Math.round(seaByDay[date]) : null, // 일별(GICOMS 해역 통항 밀집도)
    };
  });

  const korCargoLabel = korItems.map(c => KOR_CARGO_NAMES[c] ?? c).join('+') || null;
  return {
    key: desk.key, days, ports: portIds, series,
    units: { congestion: '척', inbound: '척', inflow: desk.inflowUnit, dwell: 'h', freight: freight.unit || 'pt', korVessel: '척/월', korCargo: 'R/T·월', seaDensity: 'AIS/일' },
    freight: { code: desk.chartFreight, label: desk.chartFreightLabel, unit: freight.unit || 'pt' },
    korCargoLabel,
    modes: {
      congestion: Object.keys(congByDay).length ? 'live' : 'demo',
      inbound: Object.keys(inbPD).length ? 'live' : 'demo',
      inflow: Object.keys(inflPD).length ? 'live' : 'demo',
      dwell: Object.keys(dwPD).length >= 5 ? 'live' : 'demo',
      freight: freight.mode,
      korVessel: Object.keys(korVesByYm).length ? 'live' : 'demo',
      korCargo: Object.keys(korCargByYm).length ? 'live' : 'demo',
      seaDensity: Object.keys(seaByDay).length ? 'live' : 'demo',
    },
  };
}

module.exports = { DESKS, buildAllDesks, buildDeskSeries, dwellSignals, lagCorrelation, freightSeries };
