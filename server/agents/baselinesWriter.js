const { createClient } = require('@supabase/supabase-js');
const { PORTS } = require('./portAnalyst');
const { CHOKEPOINTS } = require('./chokepointWatcher');

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30분

const CP_HARDCODED = {
  suez: 58, malacca: 247, hormuz: 89, panama: 35,
  dover: 312, korea_strait: 156, bab_el_mandeb: 67,
};

const PORT_HARDCODED = {
  busan: 12, incheon: 8, gwangyang: 5, singapore: 45,
  shanghai: 80, rotterdam: 35, la_lb: 40, dubai: 20,
  yokohama: 18, kobe: 12, ningbo: 35, shenzhen: 28,
  hongkong: 45, vladivostok: 8, portklang: 22, mumbai: 20,
  hamburg: 25, newyork: 30, guangzhou: 60, qingdao: 55,
  tianjin: 50, antwerp: 30, tanjung_pelepas: 25, xiamen: 28,
  kaohsiung: 22, laem_chabang: 18, jakarta: 20, colombo: 15,
  savannah: 12, hochiminhcity: 18,
};

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

function nmToDeg(nm) { return nm / 60; }

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

async function snapshotBaselines() {
  const db = getDb();
  const cutoff1h = new Date(Date.now() - 3600000).toISOString();
  let written = 0;

  for (const port of PORTS) {
    try {
      const deg = nmToDeg(port.radius_nm);
      const { data: ships } = await db.from('ships')
        .select('speed')
        .gte('lat', port.lat - deg).lte('lat', port.lat + deg)
        .gte('lng', port.lng - deg).lte('lng', port.lng + deg)
        .gte('updated_at', cutoff1h);

      const waiting = (ships ?? []).filter(s => (s.speed ?? 0) <= 2.0).length;
      const avg90d = await getAvg90d(db, port.id, 'waiting_ships', waiting);

      await db.from('baselines').insert({
        location_id: port.id,
        metric: 'waiting_ships',
        current_value: waiting,
        avg_90d: avg90d,
      });
      written++;
    } catch (e) {
      // 개별 항만 실패는 무시
    }
  }

  for (const cp of CHOKEPOINTS) {
    try {
      const [[latMin, lngMin], [latMax, lngMax]] = cp.bbox;
      const { data: ships } = await db.from('ships')
        .select('mmsi')
        .gte('lat', latMin).lte('lat', latMax)
        .gte('lng', lngMin).lte('lng', lngMax)
        .gte('updated_at', cutoff1h);

      const current = (ships ?? []).length;
      const avg90d = await getAvg90d(db, cp.id, 'daily_throughput', current);

      await db.from('baselines').insert({
        location_id: cp.id,
        metric: 'daily_throughput',
        current_value: current,
        avg_90d: avg90d,
      });
      written++;
    } catch (e) {
      // 개별 초크포인트 실패는 무시
    }
  }

  console.log(`[BASELINES_WRITER] snapshot ${written}/${PORTS.length + CHOKEPOINTS.length} locations`);
}

function startBaselinesWriter() {
  snapshotBaselines();
  return setInterval(snapshotBaselines, POLL_INTERVAL_MS);
}

module.exports = { startBaselinesWriter };
