// 에너지·광물 공급 루트 엔진 (L0). 수입국×품목×공급원 → searoute 해상 항로 + 초크포인트 위험포인트.
// 의존 % 는 구조 큐레이션(countryData.supplyChains)을 기본값으로, 라이브는 UN Comtrade로 후속 교체.
// → country_supply_routes 적재. /api/supply-routes·SupplyRouteLayer가 소비.
const { createClient } = require('@supabase/supabase-js');
const searoute = require('searoute-js');
const { COUNTRY_DATA, EXPORT_PORTS, COMMODITIES } = require('../data/countryData');
const { CHOKEPOINTS } = require('./chokepointWatcher');

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

const ptFeature = (lng, lat) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } });

// LineString 좌표가 지나는 초크포인트 id 목록(우리 7개 bbox 교차). bbox=[[latMin,lngMin],[latMax,lngMax]].
function chokepointsOnRoute(coords) {
  const hit = new Set();
  for (const [lng, lat] of coords) {
    for (const cp of CHOKEPOINTS) {
      const [[latMin, lngMin], [latMax, lngMax]] = cp.bbox;
      if (lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax) hit.add(cp.id);
    }
  }
  return [...hit];
}

// 한 수입국의 전 품목·공급원 루트 생성 → upsert. 라이브 % 미가용 시 구조 큐레이션 %.
async function buildRoutes(importerCode, db = getDb()) {
  const country = COUNTRY_DATA[importerCode];
  if (!country || !country.supplyChains || !country.importMainPort) return 0;
  const dest = ptFeature(country.importMainPort[0], country.importMainPort[1]);
  const rows = [];
  for (const [commodity, suppliers] of Object.entries(country.supplyChains)) {
    if (!Array.isArray(suppliers)) continue;
    for (const s of suppliers) {
      const exp = EXPORT_PORTS[s.supplier];
      const coord = exp?.[commodity] || exp?.crude || null; // 품목 전용 항 없으면 그 나라 대표항
      let route_geojson = null, chokepoints = [], distance_nm = null;
      if (coord) {
        try {
          const r = searoute(ptFeature(coord[0], coord[1]), dest);
          if (r?.geometry?.type === 'LineString') {
            route_geojson = r;
            chokepoints = chokepointsOnRoute(r.geometry.coordinates);
            distance_nm = Math.round(r.properties?.length ?? 0);
          }
        } catch { /* 루트 실패 → geojson 없이 % 만 기록 */ }
      }
      rows.push({
        importer_code: importerCode, commodity,
        supplier_code: s.supplier, supplier_name: s.supplier,
        share_pct: s.pct ?? null, route_geojson, chokepoints,
        distance_nm, source: 'curated', as_of: new Date().toISOString().slice(0, 10),
      });
    }
  }
  if (!rows.length) return 0;
  const { error } = await db.from('country_supply_routes')
    .upsert(rows, { onConflict: 'importer_code,commodity,supplier_code' });
  if (error) { console.warn('[SUPPLY_ROUTES]', importerCode, 'upsert 실패:', error.message); return 0; }
  return rows.length;
}

// 전 수입국 배치
async function buildAllRoutes() {
  console.log('[SUPPLY_ROUTES] run at', new Date().toISOString());
  const db = getDb();
  let total = 0;
  for (const code of Object.keys(COUNTRY_DATA)) {
    try { total += await buildRoutes(code, db); } catch (e) { /* 국가 실패 skip */ }
  }
  console.log(`[SUPPLY_ROUTES] done — ${total} routes upserted`);
  return total;
}

module.exports = { buildRoutes, buildAllRoutes, chokepointsOnRoute, COMMODITIES };
