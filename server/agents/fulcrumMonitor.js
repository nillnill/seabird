// FULCRUM MONITOR (L2, 3시간) — 3차 alpha.
// 각국 country_fulcrum.maritime_streams가 가리키는 라이브 스트림(초크포인트 통항·운임/선물)을
// 롤링(7d/30d/z, baselineUtils 재사용)으로 평가 → fulcrum 긴장/완화 감지 → FULCRUM_MONITOR 경보 + 방향 갱신.
// 노이즈 게이팅(|z|≥1.5 또는 |WoW|≥15%)로 단발 스파이크 무시. LLM 없이 룰 기반(저렴·견고).
const { createClient } = require('@supabase/supabase-js');
const { resolveBaselineStats, rollingFromSamples } = require('./baselineUtils');
const { HARDCODED_BASELINE: CP_BASELINE } = require('./chokepointWatcher');

const POLL_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3h (기존 빠른 케이던스 합류)
const Z_GATE = 1.5, WOW_GATE = 15;           // 노이즈 게이팅 임계

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 운임/선물(freight_history index_code) 롤링 — 최근 45일 종가에서 ma7/wow/z
async function marketRolling(db, code) {
  const cutoff = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const { data } = await db.from('freight_history')
    .select('obs_date, value').eq('index_code', code).gte('obs_date', cutoff)
    .order('obs_date', { ascending: true });
  const rows = (data ?? []).filter(r => r.value != null);
  if (rows.length < 5) return null;
  const samples = rows.map(r => ({ v: parseFloat(r.value), t: Date.parse(r.obs_date + 'T00:00:00Z') }));
  const mean = samples.reduce((a, s) => a + s.v, 0) / samples.length;
  const std = Math.sqrt(samples.reduce((a, s) => a + (s.v - mean) ** 2, 0) / samples.length);
  return rollingFromSamples(samples, mean, std, Date.now());
}

// 한 스트림 평가 → { label, kind, z, wow, breach, dir } 또는 null
//  - chokepoint: 통항량(daily_throughput)↓ = 긴장(tightening), ↑ = 완화
//  - market: 가격↑ = 긴장(비용 압박), ↓ = 완화
async function evalStream(db, s) {
  const stream = s.stream || '';
  const [kind, key] = stream.split(':');
  if (kind === 'chokepoint' && key) {
    const st = await resolveBaselineStats(db, key, 'daily_throughput', CP_BASELINE?.[key] ?? 50);
    const z = st.roll?.z, wow = st.roll?.wow7;
    if (z == null && wow == null) return null;
    const breach = (z != null && Math.abs(z) >= Z_GATE) || (wow != null && Math.abs(wow) >= WOW_GATE);
    const down = (wow ?? 0) < 0 || (z ?? 0) < 0;
    return { label: s.label || key, kind, z, wow, breach, dir: down ? 'tightening' : 'loosening' };
  }
  if (kind === 'market' && key) {
    const r = await marketRolling(db, key);
    if (!r) return null;
    const z = r.z, wow = r.wow7;
    if (z == null && wow == null) return null;
    const breach = (z != null && Math.abs(z) >= Z_GATE) || (wow != null && Math.abs(wow) >= WOW_GATE);
    const up = (wow ?? 0) > 0 || (z ?? 0) > 0;
    return { label: s.label || key, kind, z, wow, breach, dir: up ? 'tightening' : 'loosening' };
  }
  return null; // news:/macro: 등 미지원 스트림 skip
}

async function runFulcrumMonitor() {
  console.log('[FULCRUM_MONITOR] run at', new Date().toISOString());
  const db = getDb();
  const { data: countries } = await db.from('country_fulcrum')
    .select('country_code, country_name, fulcrum_constraint, maritime_streams');
  if (!countries?.length) { console.log('[FULCRUM_MONITOR] no fulcrum rows — skip'); return; }

  let emitted = 0;
  for (const c of countries) {
    const streams = Array.isArray(c.maritime_streams) ? c.maritime_streams : [];
    const evals = [];
    for (const s of streams) { const e = await evalStream(db, s).catch(() => null); if (e) evals.push(e); }
    const breached = evals.filter(e => e.breach);
    if (!breached.length) {
      // 유의미한 이탈 없음 → 방향 stable로만 갱신(보고 없음)
      await db.from('country_fulcrum').update({ fulcrum_direction: 'stable' }).eq('country_code', c.country_code);
      continue;
    }
    const tighten = breached.filter(e => e.dir === 'tightening').length;
    const loosen = breached.length - tighten;
    const direction = tighten >= loosen ? 'tightening' : 'loosening';
    const sev = direction === 'tightening' && tighten >= 2 ? 'WARNING' : 'INFO';
    const lines = breached.map(e =>
      `- ${e.label}: ${e.dir === 'tightening' ? '긴장' : '완화'} (${e.wow != null ? `WoW ${e.wow > 0 ? '+' : ''}${e.wow}%` : ''}${e.z != null ? `, z=${e.z}` : ''})`);
    const detail = `## 🧭 ${c.country_name} fulcrum ${direction === 'tightening' ? '긴장(tightening)' : '완화(loosening)'}\n`
      + `핵심 제약: ${c.fulcrum_constraint}. fulcrum을 움직이는 라이브 스트림 ${breached.length}건이 임계 이탈.\n\n`
      + lines.join('\n') + `\n\n> 롤링(7일/z) 기준 노이즈 게이팅 통과 신호만 표시.`;

    await db.from('country_fulcrum').update({ fulcrum_direction: direction }).eq('country_code', c.country_code);
    const { error } = await db.from('agent_reports').insert({
      agent_id: 'FULCRUM_MONITOR', severity: sev,
      title: `[FULCRUM] ${c.country_name} ${c.fulcrum_constraint} ${direction === 'tightening' ? '긴장↑' : '완화↓'}`,
      summary: `${c.country_name} fulcrum-구동 스트림 ${breached.length}건 이탈 (${direction})`.slice(0, 120),
      detail, data_points: breached.map(e => ({ label: e.label, current: e.wow ?? 0, baseline: 0, unit: '%', change_pct: e.wow ?? 0, direction: e.dir === 'tightening' ? 'UP' : 'DOWN' })),
      annotations: [], related_mmsi: [], location: null,
      raw_data: { country_code: c.country_code, fulcrum_direction: direction, streams: breached },
    });
    if (!error) emitted++;
  }
  console.log(`[FULCRUM_MONITOR] done — ${emitted} alerts (of ${countries.length} countries)`);
}

function startFulcrumMonitor() {
  setTimeout(runFulcrumMonitor, 60000); // 시작 60s 후 1회
  return setInterval(runFulcrumMonitor, POLL_INTERVAL_MS);
}

module.exports = { runFulcrumMonitor, startFulcrumMonitor };
