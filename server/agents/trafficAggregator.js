// 항만·초크포인트 실시간 집계 + 원자재 유입 추정 — 공유 모듈.
// /api/port-stats·/api/chokepoint-stats(엔드포인트)와 trafficSnapshotWriter(이력 적재)가 공용.
// ships 테이블의 최근 1h 스냅샷(BoundingBox)에서 선종·기국·목적지·입출항 분해 + 화물 톤수 추정.
const { normalizeDestination } = require('../data/destinationNormalizer');
const { mmsiToFlag } = require('../data/flag');

function nmToDeg(nm) { return nm / 60; }

// 두 지점 사이 방위각(도)
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function angleDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

// 선종별 대표 DWT(재화중량톤) — AIS에 dwt가 없을 때의 클래스 평균 추정값.
// 글로벌 선대 평균 기준 보수적 수치(원유 VLCC~제품선 혼합, 벌크 Panamax 중심 등).
const TYPICAL_DWT = {
  'Tanker': 80000,
  'LNG Carrier': 80000,
  'Bulk Carrier': 75000,
  'Container Ship': 50000,
  'Other': 20000,
};
// 입항(양하 목적) 선박은 만재 가정 — 적재율
const INBOUND_LOAD_FACTOR = 0.85;
// 컨테이너선 DWT → TEU 환산(대략 1 TEU ≈ 12.5 DWT)
const DWT_PER_TEU = 12.5;

// 한 척의 적재 화물 톤수 추정(입항 만재 가정). dwt 있으면 우선, 없으면 클래스 평균.
function estLadenTons(ship) {
  const type = ship.vessel_type || 'Other';
  const dwt = (ship.dwt != null && ship.dwt > 0) ? Number(ship.dwt) : (TYPICAL_DWT[type] ?? TYPICAL_DWT.Other);
  return dwt * INBOUND_LOAD_FACTOR;
}

function toDist(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

// 항만 집계. port: { id, name, lat, lng, radius_nm }
async function aggregatePort(db, port) {
  const deg = nmToDeg(port.radius_nm);
  const cutoff = new Date(Date.now() - 3600000).toISOString();

  const { data: ships } = await db.from('ships')
    .select('mmsi, vessel_type, flag_country, speed, course, heading, lat, lng, draught, dwt, destination')
    .gte('lat', port.lat - deg).lte('lat', port.lat + deg)
    .gte('lng', port.lng - deg).lte('lng', port.lng + deg)
    .gte('updated_at', cutoff);

  const rows = ships ?? [];
  const vesselTypeDist = {}, flagDist = {}, destCountryDist = {};
  const status = { berthed: 0, waiting: 0, maneuvering: 0, transit: 0 };
  const traffic = { inbound: 0, outbound: 0, passing: 0, moving: 0 };
  const inboundByType = {}, outboundByType = {};
  const speedHist = { berth: 0, slow: 0, cruise: 0, fast: 0 };
  // 원자재 유입(입항 선박 기준) 톤수 추정
  const inflow = { tanker_ships: 0, bulk_ships: 0, container_ships: 0, lng_ships: 0,
    est_liquid_dwt: 0, est_dry_bulk_dwt: 0, est_container_teu: 0, est_lng_dwt: 0 };
  let destWithData = 0, draughtSum = 0, draughtN = 0;

  rows.forEach(s => {
    const type = s.vessel_type || 'Other';
    vesselTypeDist[type] = (vesselTypeDist[type] || 0) + 1;
    const flag = s.flag_country || mmsiToFlag(s.mmsi);
    if (flag) flagDist[flag] = (flagDist[flag] || 0) + 1;

    const sp = s.speed ?? 0;
    if (sp < 0.5) { status.berthed++; speedHist.berth++; }
    else if (sp <= 2.0) { status.waiting++; speedHist.slow++; }
    else if (sp < 5.0) { status.maneuvering++; speedHist.slow++; }
    else { status.transit++; if (sp < 10) speedHist.cruise++; else speedHist.fast++; }

    let isInbound = false;
    if (sp >= 3 && s.lat != null && s.lng != null) {
      const cog = s.course ?? s.heading;
      if (cog != null) {
        traffic.moving++;
        const toPort = bearingDeg(s.lat, s.lng, port.lat, port.lng);
        const diff = angleDiff(cog, toPort);
        if (diff < 70) { traffic.inbound++; isInbound = true; inboundByType[type] = (inboundByType[type] || 0) + 1; }
        else if (diff > 110) { traffic.outbound++; outboundByType[type] = (outboundByType[type] || 0) + 1; }
        else traffic.passing++;
      }
    }

    // 입항 선박만 유입 화물로 집계(양하 목적, 만재 가정)
    if (isInbound) {
      const tons = estLadenTons(s);
      if (type === 'Tanker') { inflow.tanker_ships++; inflow.est_liquid_dwt += tons; }
      else if (type === 'Bulk Carrier') { inflow.bulk_ships++; inflow.est_dry_bulk_dwt += tons; }
      else if (type === 'Container Ship') { inflow.container_ships++; inflow.est_container_teu += tons / DWT_PER_TEU; }
      else if (type === 'LNG Carrier') { inflow.lng_ships++; inflow.est_lng_dwt += tons; }
    }

    if (s.draught != null && s.draught > 0) { draughtSum += s.draught; draughtN++; }
    if (s.destination) {
      const nd = normalizeDestination(s.destination);
      if (nd.countryKo) { destCountryDist[nd.countryKo] = (destCountryDist[nd.countryKo] || 0) + 1; destWithData++; }
    }
  });

  const total = rows.length;
  ['est_liquid_dwt', 'est_dry_bulk_dwt', 'est_container_teu', 'est_lng_dwt'].forEach(k => inflow[k] = Math.round(inflow[k]));

  return {
    total_ships: total,
    waiting_ships: status.berthed + status.waiting,
    status,
    status_breakdown: [
      { key: 'berthed',     label: '정박·계류',  count: status.berthed },
      { key: 'waiting',     label: '대기·정박지', count: status.waiting },
      { key: 'maneuvering', label: '입출항 기동', count: status.maneuvering },
      { key: 'transit',     label: '항행 중',     count: status.transit },
    ],
    traffic,
    inbound_by_type: inboundByType,
    outbound_by_type: outboundByType,
    speed_hist: [
      { key: 'berth',  label: '정박(<0.5kn)',  count: speedHist.berth },
      { key: 'slow',   label: '저속(0.5–5kn)', count: speedHist.slow },
      { key: 'cruise', label: '항행(5–10kn)',  count: speedHist.cruise },
      { key: 'fast',   label: '고속(>10kn)',   count: speedHist.fast },
    ],
    avg_draught: draughtN ? Math.round((draughtSum / draughtN) * 10) / 10 : null,
    draught_samples: draughtN,
    dest_country_dist: toDist(destCountryDist).slice(0, 8)
      .map(([country, count]) => ({ country, count, pct: destWithData ? Math.round(count / destWithData * 100) : 0 })),
    dest_samples: destWithData,
    vessel_type_dist: toDist(vesselTypeDist)
      .map(([type, count]) => ({ type, count, pct: total ? Math.round(count / total * 100) : 0 })),
    flag_dist: toDist(flagDist).slice(0, 8)
      .map(([flag, count]) => ({ flag, count, pct: total ? Math.round(count / total * 100) : 0 })),
    commodity_inflow: inflow,
  };
}

// 초크포인트 집계. cp: { id, name, bbox:[[latMin,lngMin],[latMax,lngMax]] }
async function aggregateChokepoint(db, cp) {
  const [[latMin, lngMin], [latMax, lngMax]] = cp.bbox;
  const cutoff = new Date(Date.now() - 3600000).toISOString();

  const { data: ships } = await db.from('ships')
    .select('mmsi, vessel_type, flag_country, speed')
    .gte('lat', latMin).lte('lat', latMax)
    .gte('lng', lngMin).lte('lng', lngMax)
    .gte('updated_at', cutoff);

  const rows = ships ?? [];
  const typeDist = {}, flagDist = {};
  rows.forEach(s => {
    const t = s.vessel_type || 'Other';
    typeDist[t] = (typeDist[t] || 0) + 1;
    const flag = s.flag_country || mmsiToFlag(s.mmsi);
    if (flag) flagDist[flag] = (flagDist[flag] || 0) + 1;
  });
  const total = rows.length;

  return {
    current_ships: total,
    vessel_type_dist: toDist(typeDist)
      .map(([type, count]) => ({ type, count, pct: total ? Math.round(count / total * 100) : 0 })),
    flag_dist: toDist(flagDist).slice(0, 8)
      .map(([flag, count]) => ({ flag, count, pct: total ? Math.round(count / total * 100) : 0 })),
  };
}

module.exports = { aggregatePort, aggregateChokepoint, TYPICAL_DWT, DWT_PER_TEU };
