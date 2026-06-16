const { createClient } = require('@supabase/supabase-js');
const { PORTS } = require('./portAnalyst');
const { CHOKEPOINTS } = require('./chokepointWatcher');
const { aggregatePort, aggregateChokepoint } = require('./trafficAggregator');
const { trackPortDwell } = require('./dwellTracker');

// 60분 (무료 티어 Disk IO 절약). 데모 가속 시 env BASELINES_POLL_MS로 임시 단축 가능.
const POLL_INTERVAL_MS = Number(process.env.BASELINES_POLL_MS) || 60 * 60 * 1000;

// ※ 하드코딩 평년 기준값은 portAnalyst.js(HARDCODED_BASELINE)·chokepointWatcher.js가 단일 소스.
//   baselinesWriter는 실측 스냅샷만 기록한다.
// 30분마다 전 지역을 1회 집계(aggregatePort/aggregateChokepoint)해 두 테이블에 적재:
//   ① baselines        — 평년 산출용 스칼라(waiting_ships / daily_throughput)
//   ② traffic_snapshots — 입출항·선종·기국·목적지·원자재 유입 분해(리포트·추세용)

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

let _warnedNoTrafficTable = false;
let _warnedNoDwellTable = false;

async function getAvg90d(db, locationId, metric, currentValue) {
  const cutoff90 = new Date(Date.now() - 90 * 24 * 3600000).toISOString();
  const { data: hist } = await db
    .from('baselines')
    .select('current_value')
    .eq('location_id', locationId)
    .eq('metric', metric)
    .gte('snapshot_at', cutoff90);

  const vals = [...(hist ?? []).map(r => parseFloat(r.current_value)), currentValue];
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

// traffic_snapshots 적재(테이블 없으면 1회만 경고하고 조용히 스킵 — baselines는 계속 기록)
async function insertTraffic(db, row) {
  const { error } = await db.from('traffic_snapshots').insert(row);
  if (error && !_warnedNoTrafficTable) {
    _warnedNoTrafficTable = true;
    console.warn(`[BASELINES_WRITER] traffic_snapshots 적재 실패 — supabase_schema.sql의 traffic_snapshots 테이블을 먼저 생성하세요. (${error.message})`);
  }
  return !error;
}

async function snapshotBaselines() {
  const db = getDb();
  let baseN = 0, trafN = 0, dwellClosed = 0;
  const cycleNow = new Date(); // 전 항만이 동일 타임스탬프 공유 → dwell 임계 일관성

  for (const port of PORTS) {
    try {
      const agg = await aggregatePort(db, port);
      const avg90d = await getAvg90d(db, port.id, 'waiting_ships', agg.waiting_ships);
      await db.from('baselines').insert({
        location_id: port.id, metric: 'waiting_ships',
        current_value: agg.waiting_ships, avg_90d: avg90d,
      });
      baseN++;

      // 체류시간 추적(presence ledger). 실패해도 baselines/traffic에 영향 없도록 격리.
      try {
        const r = await trackPortDwell(db, port.id, agg.present_ships ?? [], cycleNow);
        dwellClosed += r.closed ?? 0;
      } catch (de) {
        if (!_warnedNoDwellTable) {
          _warnedNoDwellTable = true;
          console.warn(`[BASELINES_WRITER] dwell 추적 실패 — supabase_schema.sql의 port_presence·dwell_events·port_presence_touch를 먼저 생성하세요. (${de.message})`);
        }
      }

      if (agg.total_ships > 0) {
        const ok = await insertTraffic(db, {
          location_id: port.id, location_type: 'port',
          total_ships: agg.total_ships,
          inbound: agg.traffic.inbound, outbound: agg.traffic.outbound, passing: agg.traffic.passing,
          vessel_type_dist: agg.vessel_type_dist, flag_dist: agg.flag_dist,
          dest_country_dist: agg.dest_country_dist, inbound_by_type: agg.inbound_by_type,
          commodity_inflow: agg.commodity_inflow,
        });
        if (ok) trafN++;
      }
    } catch (e) {
      // 개별 항만 실패는 무시
    }
  }

  for (const cp of CHOKEPOINTS) {
    try {
      const agg = await aggregateChokepoint(db, cp);
      const current = agg.current_ships;
      const avg90d = await getAvg90d(db, cp.id, 'daily_throughput', current);
      await db.from('baselines').insert({
        location_id: cp.id, metric: 'daily_throughput',
        current_value: current, avg_90d: avg90d,
      });
      baseN++;

      if (current > 0) {
        const ok = await insertTraffic(db, {
          location_id: cp.id, location_type: 'chokepoint',
          total_ships: current,
          vessel_type_dist: agg.vessel_type_dist, flag_dist: agg.flag_dist,
        });
        if (ok) trafN++;
      }
    } catch (e) {
      // 개별 초크포인트 실패는 무시
    }
  }

  console.log(`[BASELINES_WRITER] baselines ${baseN}, traffic ${trafN}/${PORTS.length + CHOKEPOINTS.length} locations, dwell closed ${dwellClosed}`);
}

function startBaselinesWriter() {
  snapshotBaselines();
  return setInterval(snapshotBaselines, POLL_INTERVAL_MS);
}

module.exports = { startBaselinesWriter };
