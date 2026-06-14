require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { startPortAnalyst, runPortAnalyst, PORTS, HARDCODED_BASELINE: PORT_BASELINE } = require('./agents/portAnalyst');
const { startChokepointWatcher, runChokepointWatcher, CHOKEPOINTS, HARDCODED_BASELINE: CP_BASELINE } = require('./agents/chokepointWatcher');
const { resolveBaseline, resolveBaselineStats, MIN_BASELINE_SAMPLES, MIN_BASELINE_SPAN_MS } = require('./agents/baselineUtils');
const { normalizeDestination } = require('./data/destinationNormalizer');
const { mmsiToFlag } = require('./data/flag');
const { aggregatePort, aggregateChokepoint } = require('./agents/trafficAggregator');
const { startBaselinesWriter } = require('./agents/baselinesWriter');
const { startGeopoliticalLinker, runGeopoliticalLinker } = require('./agents/geopoliticalLinker');
const { startWeatherAgent } = require('./agents/weatherAgent');
const { startCommodityAnalyst } = require('./agents/commodityAnalyst');
const { startFlowReporter } = require('./agents/flowReporter');
const { callClaude } = require('./agents/claudeClient');
const { TRADE_PAIRS, SEASONAL_INDEX, getSeasonalCategory } = require('./data/tradePairs');

const PORT = process.env.PORT ?? 3001;
const SUPABASE_BATCH_INTERVAL_MS = 30 * 1000;
const POSITIONS_FLUSH_INTERVAL_MS = 10 * 1000;  // ship_positions: 10초마다 배치 INSERT
const RELAY_FLUSH_INTERVAL_MS = 2 * 1000;       // 브라우저 relay: 2초마다 변경분 압축 스냅샷 전송
const POSITION_STORE_MIN_INTERVAL_MS = 60 * 1000; // 같은 mmsi 위치 이력은 최대 60초당 1건만 저장(쓰기량·테이블 폭증 억제)
const POSITIONS_TTL_MS = 2 * 3600000;           // ship_positions 보존 2시간(항적 충분), 초과분 삭제
const TTL_CLEANUP_INTERVAL_MS = 20 * 60 * 1000; // 20분마다 오래된 positions 삭제(작은 배치로 vacuum 부담↓)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

// WebSocket 서버 (브라우저 relay용)
// perMessageDeflate: AIS 스냅샷 JSON은 키·값 반복이 많아 deflate로 ~70-80% 줄어듦 (Render egress 절감)
const wss = new WebSocketServer({ server: httpServer, path: '/relay', perMessageDeflate: true });
wss.on('connection', (ws) => {
  console.log('[RELAY] browser connected, total:', wss.clients.size);
  // 초기 전체 스냅샷 1회 — 새 탭이 즉시 전체 선박을 받음(위치가 움직일 때까지 기다리지 않음)
  const ships = [];
  for (const r of shipState.values()) { const c = compactShip(r); if (c) ships.push(c); }
  if (ships.length && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'snapshot', ships, full: true }));
  }
  ws.on('close', () => console.log('[RELAY] browser disconnected, total:', wss.clients.size));
});

function broadcast(data) {
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

// 지도에 필요한 필드만 추린 compact 선박 객체 (raw aisstream 봉투 대신 relay 페이로드로 사용).
// 의미 있는 값만 포함해 바이트·파싱 절약 (없는 필드는 프론트가 기존값 유지).
function compactShip(r) {
  if (!r || r.lat == null || r.lng == null) return null;
  const s = { mmsi: r.mmsi, lat: r.lat, lng: r.lng };
  if (r.speed != null) s.speed = r.speed;
  if (r.heading != null) s.heading = r.heading;
  if (r.nav_status != null) s.nav_status = r.nav_status;
  if (r.vessel_type && r.vessel_type !== 'Other') s.vessel_type = r.vessel_type;
  if (r.ship_name) s.ship_name = r.ship_name;
  if (r.flag_country) s.flag_country = r.flag_country;
  if (r.destination) s.destination = r.destination;
  if (r.eta) s.eta = r.eta;
  return s;
}

// ── AIS 데이터 배치 버퍼 ──────────────────────────────────────────────────────
// shipState: mmsi → 누적 전체 레코드(위치+정적 통합). 절대 통째로 비우지 않고 유지한다.
// 과거엔 30초마다 버퍼를 비워 정적 데이터(vessel_type/ship_name)가 위치 갱신에 덮여 사라졌음
// → 누적 캐시 + 정규화 컬럼(모든 행 동일 키)으로 PostgREST upsert가 다른 컬럼을 NULL로 지우는 문제 제거.
const shipState = new Map();      // mmsi → { ...모든 컬럼 }
const dirtyMmsi = new Set();      // 마지막 Supabase flush 이후 변경된 mmsi
const relayDirty = new Set();     // 마지막 relay flush 이후 변경된 mmsi (브라우저 중계용, 별도 관리)
const positionInsertBuf = [];     // { mmsi, lat, lng, speed, recorded_at }[]
const lastPositionStoredAt = new Map(); // mmsi → 마지막 이력 저장 시각(throttle용)

// upsert 시 모든 행이 동일 컬럼 집합을 갖도록 정규화 (이질 배치의 NULL 덮어쓰기 방지)
const SHIP_COLS = ['mmsi','lat','lng','speed','heading','course','nav_status','ship_name',
  'vessel_type','destination','draught','call_sign','imo','eta','flag_country','origin_country','updated_at'];

// 수신 필드를 누적 상태에 병합. Type=0('Other')은 이미 아는 선종을 덮어쓰지 않음.
function applyShipUpdate(mmsi, fields) {
  const cur = shipState.get(mmsi) ?? { mmsi };
  if (fields.vessel_type === 'Other' && cur.vessel_type && cur.vessel_type !== 'Other') {
    const { vessel_type, ...rest } = fields;
    fields = rest;
  }
  Object.assign(cur, fields);
  shipState.set(mmsi, cur);
  dirtyMmsi.add(mmsi);
  relayDirty.add(mmsi);
}

function mapAISTypeToCategory(typeCode) {
  if (!typeCode) return 'Other';
  if (typeCode === 30) return 'Fishing';
  if (typeCode >= 31 && typeCode <= 39) return 'Special Craft'; // 예인·군함·범선·레저 등
  if (typeCode >= 40 && typeCode <= 49) return 'Special Craft'; // 고속선(HSC)
  if (typeCode >= 50 && typeCode <= 59) return 'Special Craft'; // 도선·예인·SAR 등
  if (typeCode >= 60 && typeCode <= 69) return 'Passenger';
  if (typeCode >= 72 && typeCode <= 74) return 'Bulk Carrier';
  if (typeCode >= 70 && typeCode <= 79) return 'Container Ship';
  if (typeCode === 84 || typeCode === 85) return 'LNG Carrier';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  return 'Other';
}

// MID_TO_FLAG·mmsiToFlag는 server/data/flag.js 단일 소스에서 import (아래 require).

function parsePositionReport(msg) {
  const m = msg.Message.PositionReport;
  const rawHeading = m.TrueHeading !== 511 ? m.TrueHeading : (m.Cog ?? null);
  const navStatus = (m.NavigationStatus != null && m.NavigationStatus !== 15) ? m.NavigationStatus : null;
  const mmsi = String(m.UserID);
  const flag = mmsiToFlag(mmsi);
  return {
    mmsi,
    lat: m.Latitude,
    lng: m.Longitude,
    speed: m.Sog ?? null,
    heading: rawHeading != null ? Math.round(rawHeading) : null,
    course: m.Cog != null ? Math.round(m.Cog) : null,
    nav_status: navStatus,
    // 국적은 MMSI MID로 모든 메시지에서 결정 가능 → PositionReport에도 채워 커버리지 ~100%
    flag_country: flag,
    origin_country: flag,
    updated_at: new Date().toISOString(),
  };
}

function parseEta(raw) {
  if (!raw) return null;
  try {
    // 객체형: { Month, Day, Hour, Minute }
    if (typeof raw === 'object' && raw.Month) {
      const { Month: mo, Day: d, Hour: h, Minute: mi } = raw;
      if (mo === 0 && d === 0) return null; // 미설정
      const year = mo < new Date().getMonth() + 1 ? new Date().getFullYear() + 1 : new Date().getFullYear();
      return new Date(year, mo - 1, d, h, mi).toISOString();
    }
    // 문자열형
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  } catch { return null; }
}

function parseShipStaticData(msg) {
  const m = msg.Message.ShipStaticData;
  const mmsi = String(m.UserID);
  return {
    mmsi,
    ship_name: m.Name?.trim().slice(0, 100) || null,
    vessel_type: mapAISTypeToCategory(m.Type ?? 0),
    destination: m.Destination?.trim().slice(0, 100) || null,
    draught: m.MaximumStaticDraught ?? null,
    call_sign: m.CallSign?.trim().slice(0, 8) || null,
    imo: m.ImoNumber ? String(m.ImoNumber).replace(/\D/g, '').slice(0, 7) : null,
    eta: parseEta(m.Eta),
    flag_country: mmsiToFlag(mmsi),
    origin_country: mmsiToFlag(mmsi),
    updated_at: new Date().toISOString(),
  };
}

// Class B 확장 위치 보고(Type 19) — 위치 + 선종(Type) 동시 제공
function parseExtendedClassBPosition(msg) {
  const m = msg.Message?.ExtendedClassBPositionReport;
  if (!m || m.Latitude == null || m.Longitude == null) return null;
  const mmsi = String(m.UserID);
  const flag = mmsiToFlag(mmsi);
  const rawHeading = (m.TrueHeading != null && m.TrueHeading >= 0 && m.TrueHeading <= 359) ? m.TrueHeading : (m.Cog ?? null);
  const type = mapAISTypeToCategory(m.Type ?? 0);
  const out = {
    mmsi,
    lat: m.Latitude,
    lng: m.Longitude,
    speed: m.Sog ?? null,
    heading: rawHeading != null ? Math.round(rawHeading) : null,
    course: m.Cog != null ? Math.round(m.Cog) : null,
    flag_country: flag,
    origin_country: flag,
    updated_at: new Date().toISOString(),
  };
  if (m.Name?.trim()) out.ship_name = m.Name.trim().slice(0, 100);
  if (type !== 'Other') out.vessel_type = type; // Other는 넣지 않아 기존 선종 보존
  return out;
}

// Class B 정적 보고(Type 24) — Part A(이름) / Part B(선종·호출부호)
function parseStaticDataReport(msg) {
  const m = msg.Message?.StaticDataReport;
  if (!m || m.UserID == null) return null;
  const mmsi = String(m.UserID);
  const flag = mmsiToFlag(mmsi);
  const out = { mmsi, flag_country: flag, origin_country: flag, updated_at: new Date().toISOString() };
  const name = m.ReportA?.Name?.trim();
  if (name) out.ship_name = name.slice(0, 100);
  if (m.ReportB?.ShipType != null) {
    const type = mapAISTypeToCategory(m.ReportB.ShipType);
    if (type !== 'Other') out.vessel_type = type;
  }
  const cs = m.ReportB?.CallSign?.trim();
  if (cs) out.call_sign = cs.slice(0, 8);
  return out;
}

// ── 브라우저 relay 배치 (2초) ─────────────────────────────────────────────────
// 변경된 선박만 compact 스냅샷으로 묶어 전송. 같은 선박의 초당 다중 위치보고는 1건으로 dedup되고,
// perMessageDeflate 압축까지 더해 raw firehose 중계 대비 egress가 90%+ 줄어든다.
setInterval(() => {
  if (relayDirty.size === 0) return;
  if (wss.clients.size === 0) { relayDirty.clear(); return; } // 보는 사람 없으면 누적 비우고 skip
  const ships = [];
  for (const mmsi of relayDirty) {
    const c = compactShip(shipState.get(mmsi));
    if (c) ships.push(c);
  }
  relayDirty.clear();
  if (ships.length) broadcast(JSON.stringify({ type: 'snapshot', ships }));
}, RELAY_FLUSH_INTERVAL_MS);

// ── Supabase 배치 upsert (30초) ───────────────────────────────────────────────
setInterval(async () => {
  if (dirtyMmsi.size === 0) return;
  // 변경된 mmsi의 누적 전체 상태를 정규화(모든 컬럼 동일)해서 upsert → 정적 데이터 보존
  const rows = [];
  for (const mmsi of dirtyMmsi) {
    const r = shipState.get(mmsi);
    if (r && r.lat != null && r.lng != null) {
      rows.push(Object.fromEntries(SHIP_COLS.map(c => [c, r[c] ?? null])));
    }
  }
  dirtyMmsi.clear();
  if (rows.length === 0) return;

  const { error } = await supabase
    .from('ships')
    .upsert(rows, { onConflict: 'mmsi', ignoreDuplicates: false });
  if (error) console.error('[SUPABASE] ships upsert error:', error.message);
  else console.log(`[SUPABASE] upserted ${rows.length} ships`);
}, SUPABASE_BATCH_INTERVAL_MS);

// ── shipState 메모리 정리 (10분 주기, 6시간 미수신 mmsi 제거) ─────────────────
setInterval(() => {
  const cutoff = Date.now() - 6 * 3600000;
  let removed = 0;
  for (const [mmsi, r] of shipState) {
    const t = r.updated_at ? Date.parse(r.updated_at) : 0;
    if (t < cutoff) { shipState.delete(mmsi); dirtyMmsi.delete(mmsi); lastPositionStoredAt.delete(mmsi); removed++; }
  }
  if (removed) console.log(`[SHIP_STATE] evicted ${removed} stale (state size=${shipState.size})`);
}, 10 * 60 * 1000);

// ── ship_positions 배치 INSERT (10초) ────────────────────────────────────────
setInterval(async () => {
  if (positionInsertBuf.length === 0) return;
  const rows = positionInsertBuf.splice(0, positionInsertBuf.length);

  const { error } = await supabase.from('ship_positions').insert(rows);
  if (error) console.error('[SUPABASE] positions insert error:', error.message);
}, POSITIONS_FLUSH_INTERVAL_MS);

// ── TTL 정리 (20분 주기, 2시간 초과분 삭제) ──────────────────────────────────
setInterval(async () => {
  const cutoff = new Date(Date.now() - POSITIONS_TTL_MS).toISOString();
  const { error } = await supabase
    .from('ship_positions')
    .delete()
    .lt('recorded_at', cutoff);
  if (error) console.error('[TTL] cleanup error:', error.message);
  else console.log('[TTL] ship_positions cleanup done');
}, TTL_CLEANUP_INTERVAL_MS);

// ── aisstream.io WebSocket 연결 ───────────────────────────────────────────────
let aisWs = null;
let lastAisMessageAt = 0;             // 마지막 AIS 메시지 수신 시각
const AIS_STALE_MS = 60 * 1000;       // 60초간 무수신이면 좀비(half-open) 소켓으로 간주
const AIS_WATCHDOG_INTERVAL_MS = 20 * 1000;

function connectAIS() {
  console.log('[AIS] connecting to aisstream.io...');
  lastAisMessageAt = Date.now();
  aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');

  aisWs.on('open', () => {
    console.log('[AIS] connected');
    lastAisMessageAt = Date.now();
    aisWs.send(JSON.stringify({
      APIKey: process.env.AISSTREAM_API_KEY,
      // Class A 위치(1/2/3)·정적(5)에 더해 Class B 확장위치(19)·정적(24)도 구독 → 소형선 선종 확보
      MessageTypes: ['PositionReport', 'ShipStaticData', 'ExtendedClassBPositionReport', 'StaticDataReport'],
      BoundingBoxes: [[[-90, -180], [90, 180]]],
    }));
  });

  aisWs.on('message', (data) => {
    lastAisMessageAt = Date.now();
    const raw = data.toString();
    // 브라우저 relay는 더 이상 메시지마다 보내지 않음 — applyShipUpdate가 relayDirty에 모아
    // 2초마다 압축 스냅샷 1건으로 묶어 전송(아래 relay flush). raw firehose를 그대로
    // 모든 클라이언트에 중계하던 게 Render egress 폭증의 주범이었음.

    try {
      const msg = JSON.parse(raw);

      if (msg.MessageType === 'PositionReport' || msg.MessageType === 'ExtendedClassBPositionReport') {
        const parsed = msg.MessageType === 'PositionReport'
          ? parsePositionReport(msg)
          : parseExtendedClassBPosition(msg);
        if (parsed) {
          applyShipUpdate(parsed.mmsi, parsed);
          // 같은 선박은 60초당 1건만 이력 저장 — 글로벌 firehose를 그대로 쌓던 폭증을 차단
          const nowTs = Date.now();
          if (nowTs - (lastPositionStoredAt.get(parsed.mmsi) ?? 0) >= POSITION_STORE_MIN_INTERVAL_MS) {
            lastPositionStoredAt.set(parsed.mmsi, nowTs);
            positionInsertBuf.push({
              mmsi: parsed.mmsi,
              lat: parsed.lat,
              lng: parsed.lng,
              speed: parsed.speed,
              recorded_at: parsed.updated_at,
            });
          }
        }
      } else if (msg.MessageType === 'ShipStaticData') {
        const parsed = parseShipStaticData(msg);
        applyShipUpdate(parsed.mmsi, parsed);
      } else if (msg.MessageType === 'StaticDataReport') {
        const parsed = parseStaticDataReport(msg);
        if (parsed) applyShipUpdate(parsed.mmsi, parsed);
      }
    } catch {
      // 파싱 실패 무시
    }
  });

  aisWs.on('error', (err) => console.error('[AIS] error:', err.message));

  aisWs.on('close', () => {
    console.log('[AIS] disconnected — reconnecting in 5s');
    setTimeout(connectAIS, 5000);
  });
}

// 유휴 감지 워치독 — half-open(좀비) 소켓은 'close'가 안 뜨므로 강제 재연결
setInterval(() => {
  if (!aisWs || aisWs.readyState !== WebSocket.OPEN) return;
  const idle = Date.now() - lastAisMessageAt;
  if (idle > AIS_STALE_MS) {
    console.warn(`[AIS] no messages for ${Math.round(idle / 1000)}s — terminating stale socket`);
    lastAisMessageAt = Date.now(); // 재연결 사이클 동안 중복 terminate 방지
    aisWs.terminate();             // 'close' 핸들러가 5초 뒤 재연결
  }
}, AIS_WATCHDOG_INTERVAL_MS);

connectAIS();

// ── 에이전트 시작 (500ms 간격 stagger — rate limit 방지) ─────────────────────
setTimeout(() => startChokepointWatcher(), 3000);
setTimeout(() => startPortAnalyst(),       3500);
setTimeout(() => startGeopoliticalLinker(), 4000);
setTimeout(() => startBaselinesWriter(),   5000);
setTimeout(() => startWeatherAgent(),      5500);
setTimeout(() => startCommodityAnalyst(),  6000);
setTimeout(() => startFlowReporter(),      6500);

// ── HTTP 엔드포인트 ───────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ships_tracked: shipState.size, dirty: dirtyMmsi.size }));

// 선박 항적 — service_role로 조회(ship_positions는 anon RLS로 막혀 있어 서버 경유)
app.get('/api/ship-track', async (req, res) => {
  const { mmsi } = req.query;
  if (!mmsi) return res.status(400).json({ error: 'mmsi required' });
  const { data, error } = await supabase
    .from('ship_positions')
    .select('lat, lng, recorded_at')
    .eq('mmsi', String(mmsi))
    .order('recorded_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('[SHIP_TRACK] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ positions: data ?? [] });
});

app.post('/api/cargo-estimate', async (req, res) => {
  const { mmsi, ship: fallbackShip } = req.body ?? {};
  if (!mmsi) return res.status(400).json({ error: 'mmsi required' });

  try {
    const { data: dbShip } = await supabase.from('ships').select('*').eq('mmsi', mmsi).single();
    // DB가 먼저 오지만, vessel_type은 브라우저(fallback)가 더 최신일 수 있으므로 'Other'일 때만 DB 값 사용
    const merged = dbShip ? { ...fallbackShip, ...dbShip } : fallbackShip ? { mmsi, ...fallbackShip } : null;
    if (merged && fallbackShip?.vessel_type && fallbackShip.vessel_type !== 'Other') {
      merged.vessel_type = fallbackShip.vessel_type;
    }
    const ship = merged;
    if (!ship) return res.status(404).json({ error: 'ship not found' });

    const origin = ship.origin_country ?? ship.flag_country;
    const dest = ship.dest_country;
    const tradePairKey = origin && dest ? `${origin}_${dest}` : null;
    const tradePair = tradePairKey ? TRADE_PAIRS[tradePairKey] ?? null : null;
    const loadRatio = ship.draught && ship.max_draught ? Math.min(ship.draught / ship.max_draught, 1.0) : 0.7;
    const estimatedLoad = ship.dwt ? Math.round(ship.dwt * loadRatio) : null;
    const currentMonth = new Date().getMonth();

    let seasonalNote = '';
    if (tradePair?.top_cargo?.[0]) {
      const cat = getSeasonalCategory(tradePair.top_cargo[0].hs_code);
      const idx = SEASONAL_INDEX[cat]?.[currentMonth] ?? 1.0;
      if (idx !== 1.0) seasonalNote = `현재 월(${currentMonth + 1}월) 계절 인덱스: ${idx} (${cat})`;
    }

    const vesselType = ship.vessel_type ?? 'Other';

    // 캐시 조회 — 동일 (mmsi + destination + vessel_type) 12시간 TTL
    const cacheKey = {
      mmsi: String(mmsi),
      destination: (ship.destination || '').toUpperCase().trim().slice(0, 10),
      vessel_type: vesselType,
    };
    const cutoff = new Date(Date.now() - 12 * 3600_000).toISOString();
    const { data: cacheHit } = await supabase
      .from('agent_reports')
      .select('raw_data, created_at')
      .eq('agent_id', 'CARGO_ESTIMATOR')
      .eq('raw_data->>mmsi', cacheKey.mmsi)
      .eq('raw_data->>destination', cacheKey.destination)
      .eq('raw_data->>vessel_type', cacheKey.vessel_type)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (cacheHit?.raw_data?.cargo_result) {
      console.log(`[CARGO_CACHE] hit — mmsi=${cacheKey.mmsi}`);
      return res.json({ ...cacheHit.raw_data.cargo_result, _cached_at: cacheHit.created_at });
    }

    const CARGO_SYSTEM_PROMPT = (() => {
      const JSON_BASE = 'Respond ONLY with valid JSON. Language: Korean. MANDATORY: Never refuse — always estimate.';
      switch (vesselType) {
        case 'Tanker':
          return `You are CARGO ESTIMATOR specializing in liquid tankers.
${JSON_BASE}
원유·석유제품·화학물질·식용유 중 항로·원산지로 화물을 특정하라.
{"cargo_distribution":[{"item":"원유 (Crude Oil)","probability_pct":70,"margin_pct":15,"annotation":"[1] 근거: 항로 및 원산지 분석"}],"estimated_load_tons":280000,"load_ratio_pct":92,"vessel_size_class":"VLCC|Suezmax|Aframax|Product Tanker","cargo_type":"CRUDE|PRODUCT|CHEMICAL|VEGETABLE_OIL","confidence":"HIGH|MEDIUM|LOW","disclaimer":"탱커 화물 추정은 흘수·항로 기반 확률적 추정입니다.","data_sources":["IEA Oil Market Report","AIS 흘수 데이터"]}`;
        case 'LNG Carrier':
          return `You are CARGO ESTIMATOR specializing in LNG carriers.
${JSON_BASE}
LNG 운반선은 거의 100% LNG를 적재한다. 출처국(카타르·미국·호주·말레이시아 등)과 수량을 추정하라.
{"cargo_distribution":[{"item":"액화천연가스 (LNG)","probability_pct":98,"margin_pct":2,"annotation":"[1] LNG 전용선"}],"estimated_load_tons":65000,"estimated_load_m3":145000,"load_ratio_pct":92,"cargo_origin":"카타르|미국|호주|말레이시아 중 추정","confidence":"HIGH|MEDIUM|LOW","disclaimer":"LNG 운반선 화물 추정은 선박 제원과 항로 기반 확률적 추정입니다.","data_sources":["IGU World LNG Report","AIS 흘수 데이터"]}`;
        case 'Bulk Carrier':
          return `You are CARGO ESTIMATOR specializing in dry bulk carriers.
${JSON_BASE}
철광석·석탄·곡물·보크사이트·인산염 중 항로·계절성으로 화물을 추정하라. 선박 크기(Capesize/Panamax/Supramax/Handysize)도 추정하라.
{"cargo_distribution":[{"item":"철광석 (Iron Ore)","probability_pct":55,"margin_pct":15,"annotation":"[1] 근거: 호주·브라질 주요 수출품"}],"estimated_load_tons":180000,"load_ratio_pct":88,"vessel_size_class":"Capesize|Panamax|Supramax|Handysize","confidence":"HIGH|MEDIUM|LOW","disclaimer":"벌크선 화물 추정은 항로·원산지·계절성 기반 확률적 추정입니다.","data_sources":["Baltic Exchange","UN Comtrade 2023","AIS 흘수 데이터"]}`;
        case 'Fishing':
          return `You are CARGO ESTIMATOR specializing in fishing vessels.
${JSON_BASE}
어선은 상업 화물이 없다. 어업 해역·국적·계절성으로 어종과 어획량을 추정하라.
{"cargo_distribution":[{"item":"참치 (Tuna)","probability_pct":45,"margin_pct":20,"annotation":"[1] 근거: 해역 및 선박 크기 분석"}],"estimated_catch_tons":300,"estimated_load_tons":0,"fishing_zone":"추정 어업 해역","vessel_type_note":"어선 — 상업 화물 없음","confidence":"MEDIUM|LOW","disclaimer":"어선 어획 추정은 해역·계절성 기반 확률적 추정입니다.","data_sources":["FAO 어업 통계","AIS 위치 데이터"]}`;
        case 'Passenger':
          return `You are CARGO ESTIMATOR specializing in passenger vessels.
${JSON_BASE}
여객선·크루즈선은 상업 화물이 없다. 선박 규모·노선으로 승객 수와 선내 소비물자를 추정하라.
{"cargo_distribution":[{"item":"탑승 여객","probability_pct":100,"margin_pct":0,"annotation":"[1] 여객선 — 상업 화물 없음"}],"estimated_passengers":2500,"estimated_load_tons":0,"load_ratio_pct":0,"vessel_type_note":"여객선 — 화물 추정 해당 없음","confidence":"MEDIUM","disclaimer":"여객선에는 상업 화물이 없습니다. 승객 수는 선박 제원 기반 추정입니다.","data_sources":["CLIA 크루즈 보고서","AIS 데이터"]}`;
        case 'Special Craft':
          return `You are CARGO ESTIMATOR specializing in special purpose vessels.
${JSON_BASE}
특수선(예인선·도선선·구조선·작업선·해양조사선)은 상업 화물이 없다. 선박의 기능과 현재 작업을 추정하라.
{"cargo_distribution":[{"item":"특수 장비 및 작업 자재","probability_pct":100,"margin_pct":0,"annotation":"[1] 특수선 — 상업 화물 없음"}],"estimated_load_tons":0,"load_ratio_pct":0,"vessel_function":"예인·도선·구조·해양조사·공사 중 추정","confidence":"MEDIUM","disclaimer":"특수선에는 상업 화물이 없습니다.","data_sources":["AIS 데이터"]}`;
        case 'Container Ship':
        default:
          return `You are CARGO ESTIMATOR, a maritime cargo intelligence agent.
Given vessel AIS data and trade statistics, estimate the probable cargo composition.
${JSON_BASE}
TEU 수와 화물 종류(소비재·전자·자동차부품·화학 등)를 항로·국적으로 추정하라.
{"cargo_distribution":[{"item":"품목명","probability_pct":38,"margin_pct":8,"annotation":"[1] 근거: UN Comtrade 2023"}],"estimated_load_tons":45000,"estimated_teu":8500,"load_ratio_pct":78,"confidence":"HIGH|MEDIUM|LOW","disclaimer":"본 추정은 공개 무역 통계와 AIS 데이터를 기반으로 한 확률적 추정이며, 실제 화물과 다를 수 있습니다.","data_sources":["UN Comtrade 2023","AIS 흘수 데이터"]}
Minimum viable: Even with only MMSI, infer flag country → typical exports → probable cargo.`;
      }
    })();

    const result = await callClaude({
      systemPrompt: CARGO_SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        vessel: { mmsi: ship.mmsi, ship_name: ship.ship_name, vessel_type: ship.vessel_type, destination: ship.destination, origin_country: origin, dest_country: dest, draught: ship.draught, max_draught: ship.max_draught, dwt: ship.dwt, flag_country: ship.flag_country },
        trade_pair: tradePair ?? '데이터 없음',
        estimated_load_tons: estimatedLoad,
        load_ratio_pct: Math.round(loadRatio * 100),
        seasonal_note: seasonalNote || '없음',
        current_month: currentMonth + 1,
      }),
      maxTokens: 2000,
      // 응답 지연(~24s) 완화를 위해 Haiku로 다운그레이드. CARGO_MODEL 환경변수로 오버라이드 가능(예: Sonnet 복귀)
      model: process.env.CARGO_MODEL || 'claude-haiku-4-5',
    });

    // 캐시 저장 (백그라운드 — 응답 지연 없음)
    supabase.from('agent_reports').insert({
      agent_id: 'CARGO_ESTIMATOR',
      severity: 'INFO',
      title: `${ship.ship_name || mmsi} 화물 추정`,
      summary: (result.disclaimer || '화물 추정 완료').slice(0, 120),
      detail: '',
      data_points: [],
      annotations: [],
      related_mmsi: [String(mmsi)],
      location: { lat: ship.lat, lng: ship.lng },
      raw_data: { ...cacheKey, cargo_result: result },
    }).then(({ error }) => {
      if (error) console.error('[CARGO_CACHE] save error:', error.message);
      else console.log(`[CARGO_CACHE] saved — mmsi=${cacheKey.mmsi}`);
    });

    res.json(result);
  } catch (err) {
    console.error('[CARGO_ESTIMATE] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const ORCHESTRATE_SYSTEM_PROMPT = `You are the Seabird Orchestrator. Parse user queries and route to agents.

Respond ONLY with valid JSON:
{
  "agents": ["PORT_ANALYST"],
  "params": { "port_id": "busan", "mmsi": null },
  "user_message": "처리 중입니다..."
}

ROUTING RULES:
- 항만/항구/port/congestion/혼잡 → PORT_ANALYST
- MMSI/선박명 + 화물/cargo → CARGO_ESTIMATOR
- 초크포인트/해협/canal/strait → CHOKEPOINT_WATCHER
- 뉴스/제재/지정학/geopolitical → GEOPOLITICAL_LINKER
- 복합 질문 → 여러 에이전트

Port ID mappings: 부산=busan, 인천=incheon, 광양=gwangyang, 싱가포르=singapore, 상하이=shanghai, 로테르담=rotterdam, LA=la_lb, 두바이=dubai, 요코하마=yokohama, 고베=kobe, 닝보=ningbo, 선전=shenzhen, 홍콩=hongkong, 블라디보스토크=vladivostok, 포트클랑=portklang, 뭄바이=mumbai, 함부르크=hamburg, 뉴욕=newyork`;

app.post('/api/orchestrate', async (req, res) => {
  const { text, selectedShip } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const routing = await callClaude({
      systemPrompt: ORCHESTRATE_SYSTEM_PROMPT,
      userMessage: JSON.stringify({ text, selectedShip: selectedShip ?? null }),
      maxTokens: 300,
      model: 'claude-haiku-4-5',
    });
    const triggered = [];
    if (routing.agents?.includes('PORT_ANALYST'))        { runPortAnalyst(); triggered.push('PORT_ANALYST'); }
    if (routing.agents?.includes('CHOKEPOINT_WATCHER'))  { runChokepointWatcher(); triggered.push('CHOKEPOINT_WATCHER'); }
    if (routing.agents?.includes('GEOPOLITICAL_LINKER')) { runGeopoliticalLinker(); triggered.push('GEOPOLITICAL_LINKER'); }
    res.json({ ...routing, triggered });
  } catch (err) {
    console.error('[ORCHESTRATE] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 집계/방위/거리 헬퍼는 trafficAggregator.js로 이동(공유). port-stats·chokepoint-stats가 그 모듈을 사용.

// ── 읽기 무거운 GET 통계 엔드포인트 60초 인메모리 캐시 (무료 티어 Disk IO 절약) ──
// 패널을 여닫을 때마다 ships 테이블을 재스캔하던 부담을 제거. 신선도 60초면 충분.
const STATS_CACHE_TTL_MS = 60 * 1000;
const statsCache = new Map(); // key → { ts, data }
function cacheGet(key) {
  const e = statsCache.get(key);
  if (e && Date.now() - e.ts < STATS_CACHE_TTL_MS) return e.data;
  if (e) statsCache.delete(key);
  return null;
}
function cacheSet(key, data) {
  statsCache.set(key, { ts: Date.now(), data });
  if (statsCache.size > 300) statsCache.delete(statsCache.keys().next().value); // 단순 상한
}
// 동시 쿼리 폭주 방지 — items를 size개씩 순차 배치로 처리 (30-wide Promise.all IO 스파이크 제거)
async function runBatched(items, fn, size = 4) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

app.get('/api/port-stats', async (req, res) => {
  const { portId } = req.query;
  const port = PORTS?.find(p => p.id === portId);
  if (!port) return res.status(404).json({ error: 'port not found' });

  const cached = cacheGet(`port:${portId}`);
  if (cached) return res.json(cached);

  try {
    const agg = await aggregatePort(supabase, port);

    const { data: reports } = await supabase.from('agent_reports')
      .select('id, severity, title, summary, created_at')
      .eq('agent_id', 'PORT_ANALYST')
      .order('created_at', { ascending: false })
      .limit(3);

    // 평년: 충분한 실측 이력이 쌓이면 동적 평균, 그 전엔 하드코딩 기준값 (chokepoint와 동일 정책)
    const baselineWaiting = await resolveBaseline(supabase, port.id, 'waiting_ships', PORT_BASELINE?.[port.id] ?? 10);

    const payload = {
      port: { id: port.id, name: port.name, lat: port.lat, lng: port.lng },
      baseline_waiting: baselineWaiting,
      ...agg,
      recent_reports: reports ?? [],
    };
    cacheSet(`port:${portId}`, payload);
    res.json(payload);
  } catch (err) {
    console.error('[PORT_STATS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chokepoint-stats', async (req, res) => {
  const { cpId } = req.query;
  const cp = CHOKEPOINTS?.find(c => c.id === cpId);
  if (!cp) return res.status(404).json({ error: 'chokepoint not found' });

  const cached = cacheGet(`cp:${cpId}`);
  if (cached) return res.json(cached);

  try {
    const agg = await aggregateChokepoint(supabase, cp);
    const total = agg.current_ships;

    // 평년: 충분한 실측 이력이 쌓이면 동적 평균, 그 전엔 하드코딩 기준값 (chokepointWatcher와 동일 정책)
    const baseline = await resolveBaseline(supabase, cpId, 'daily_throughput', CP_BASELINE?.[cpId] ?? 50);
    const change_pct = baseline > 0 ? Math.round(((total - baseline) / baseline) * 100) : 0;

    const payload = { ...agg, baseline, change_pct };
    cacheSet(`cp:${cpId}`, payload);
    res.json(payload);
  } catch (err) {
    console.error('[CHOKEPOINT_STATS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 지역·metric → location 목록·하드코딩 기준값·표시명 레지스트리 (비교 수치 시스템 공용)
function metricRegistry(metric) {
  if (metric === 'waiting_ships') {
    return { locations: PORTS, hardcoded: PORT_BASELINE, label: (l) => l.name, higherIsBad: true };
  }
  // 기본: daily_throughput (초크포인트)
  return { locations: CHOKEPOINTS, hardcoded: CP_BASELINE, label: (l) => l.name, higherIsBad: false };
}

// 마지막 3표본 기울기로 추세 판정
function trendOf(samples) {
  if (!samples || samples.length < 3) return 'flat';
  const tail = samples.slice(-3).map(s => s.v);
  const slope = tail[2] - tail[0];
  const scale = Math.max(1, Math.abs(tail[0]));
  if (slope / scale > 0.1) return 'rising';
  if (slope / scale < -0.1) return 'falling';
  return 'flat';
}

// 레이어 2 — 시계열 추이 + 평년 밴드 + 추세
app.get('/api/baseline-history', async (req, res) => {
  const { locationId, metric = 'daily_throughput', hours = '48' } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const cacheKey = `hist:${locationId}:${metric}:${hours}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const { hardcoded } = metricRegistry(metric);
    const windowMs = Math.min(Math.max(parseInt(hours, 10) || 48, 1), 90 * 24) * 3600000;
    const stats = await resolveBaselineStats(supabase, locationId, metric, hardcoded?.[locationId], windowMs);

    const latest = stats.latest;
    const z = (stats.std && stats.std > 0 && latest)
      ? Math.round(((latest.v - stats.mean) / stats.std) * 10) / 10
      : null;

    const payload = {
      location_id: locationId,
      metric,
      series: stats.samples.map(s => ({ t: new Date(s.t).toISOString(), v: s.v })),
      baseline: stats.baseline,
      mean: stats.mean,
      std: stats.std,
      n: stats.n,
      has_dynamic: stats.hasDynamic,
      latest,
      z,
      trend: trendOf(stats.samples),
    };
    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('[BASELINE_HISTORY] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 증감 윈도우 — DoD/WoW/MoM/YoY. baselines 이력에서 "최근 24h 평균" vs "N일 전 같은 24h 평균" 비교.
// 한 쿼리로 4개 윈도우 계산. 과거 데이터가 없는 윈도우는 available:false('누적 중').
const CHANGE_DEFS = [['DoD', '전일', 1], ['WoW', '전주', 7], ['MoM', '전월', 30], ['YoY', '전년', 365]];
app.get('/api/change-windows', async (req, res) => {
  const { locationId, metric = 'daily_throughput' } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const cacheKey = `chg:${locationId}:${metric}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const DAY = 86400000, W = 24 * 3600000;
    const cutoff = new Date(Date.now() - (366 * DAY)).toISOString();
    const { data: rows } = await supabase.from('baselines')
      .select('current_value, snapshot_at')
      .eq('location_id', locationId).eq('metric', metric)
      .gte('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: true });

    const samples = (rows ?? [])
      .map(r => ({ v: parseFloat(r.current_value), t: Date.parse(r.snapshot_at) }))
      .filter(s => s.v > 0 && Number.isFinite(s.t)); // 0 = 수집 공백 제외 (resolveBaseline과 동일 정책)

    const now = Date.now();
    const avgIn = (a, b) => {
      const xs = samples.filter(s => s.t >= a && s.t < b);
      return xs.length ? xs.reduce((s, x) => s + x.v, 0) / xs.length : null;
    };
    const cur = avgIn(now - W, now);

    const windows = CHANGE_DEFS.map(([key, label, lagDays]) => {
      const base = avgIn(now - lagDays * DAY - W, now - lagDays * DAY);
      const available = cur != null && base != null && base > 0;
      return {
        key, label,
        current: cur != null ? Math.round(cur * 10) / 10 : null,
        baseline: base != null ? Math.round(base * 10) / 10 : null,
        change_pct: available ? Math.round(((cur - base) / base) * 100) : null,
        available,
      };
    });

    const payload = { location_id: locationId, metric, current_n: samples.filter(s => s.t >= now - W).length, windows };
    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('[CHANGE_WINDOWS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 원자재 유입 증감 윈도우 — traffic_snapshots.commodity_inflow에서 품목별 DoD/WoW/MoM/YoY.
// change-windows와 동일 방식(최근 24h 평균 vs N일 전 24h 평균), 단 소스가 traffic_snapshots.
const INFLOW_METRICS = [
  { key: 'est_liquid_dwt',   label: '원유·석유제품', unit: '천 DWT', scale: 1000 },
  { key: 'est_dry_bulk_dwt', label: '건화물',        unit: '천 DWT', scale: 1000 },
  { key: 'est_container_teu', label: '컨테이너',      unit: '천 TEU', scale: 1000 },
];
app.get('/api/inflow-windows', async (req, res) => {
  const { portId } = req.query;
  if (!portId) return res.status(400).json({ error: 'portId required' });

  const cacheKey = `inflow:${portId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const DAY = 86400000, W = 24 * 3600000;
    const cutoff = new Date(Date.now() - (366 * DAY)).toISOString();
    const { data } = await supabase.from('traffic_snapshots')
      .select('commodity_inflow, snapshot_at')
      .eq('location_id', portId).eq('location_type', 'port')
      .gte('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: false })
      .limit(5000);

    const samples = (data ?? [])
      .map(r => ({ ci: r.commodity_inflow || {}, t: Date.parse(r.snapshot_at) }))
      .filter(s => Number.isFinite(s.t));

    const now = Date.now();
    const avgIn = (a, b, key) => {
      const xs = samples.filter(s => s.t >= a && s.t < b).map(s => Number(s.ci[key]) || 0);
      return xs.length ? xs.reduce((p, x) => p + x, 0) / xs.length : null;
    };

    const commodities = INFLOW_METRICS.map(m => {
      const cur = avgIn(now - W, now, m.key);
      const windows = CHANGE_DEFS.map(([key, label, lagDays]) => {
        const base = avgIn(now - lagDays * DAY - W, now - lagDays * DAY, m.key);
        const available = cur != null && base != null && base > 0;
        return { key, label, change_pct: available ? Math.round(((cur - base) / base) * 100) : null, available };
      });
      return { key: m.key, label: m.label, unit: m.unit, current: cur != null ? Math.round((cur / m.scale) * 10) / 10 : null, windows };
    });

    const payload = { port_id: portId, current_n: samples.filter(s => s.t >= now - W).length, commodities };
    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('[INFLOW_WINDOWS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 레이어 3 — 전 지역 평년 대비 편차 랭킹 보드
app.get('/api/comparison-board', async (req, res) => {
  const { metric = 'waiting_ships' } = req.query;

  const cached = cacheGet(`board:${metric}`);
  if (cached) return res.json(cached);

  try {
    const { locations, hardcoded, higherIsBad } = metricRegistry(metric);

    // 단일 쿼리로 해당 metric의 최신순 표본을 한 번에 → JS에서 지역별 집계
    // (과거: 지역마다 resolveBaselineStats 30회 호출 = 적체·throttle 주범. 30쿼리→1쿼리)
    // 최신순(DESC) + limit로 최근 표본 확보 (PostgREST 행 상한 내에서 지역별 latest는 항상 포함됨)
    const cutoff90 = new Date(Date.now() - 90 * 24 * 3600000).toISOString();
    const { data } = await supabase.from('baselines')
      .select('location_id, current_value, snapshot_at')
      .eq('metric', metric)
      .gte('snapshot_at', cutoff90)
      .order('snapshot_at', { ascending: false })
      .limit(5000);

    const byLoc = {};
    (data ?? []).forEach(r => {
      const v = parseFloat(r.current_value), t = Date.parse(r.snapshot_at);
      if (!(v > 0) || !Number.isFinite(t)) return; // 0 스냅샷(수집 공백) 제외 — resolveBaseline과 동일 정책
      (byLoc[r.location_id] ??= []).push({ v, t });
    });

    const list = locations.map((loc) => {
      const samples = byLoc[loc.id];
      if (!samples?.length) return null; // 최근 스냅샷 없으면 제외
      const n = samples.length;
      let latestT = -Infinity, latestV = null, minT = Infinity, sum = 0;
      for (const s of samples) {
        sum += s.v;
        if (s.t > latestT) { latestT = s.t; latestV = s.v; } // 순서 무관하게 최신값
        if (s.t < minT) minT = s.t;
      }
      const mean = sum / n;
      const std = Math.sqrt(samples.reduce((a, x) => a + (x.v - mean) ** 2, 0) / n);
      const hasDynamic = n >= MIN_BASELINE_SAMPLES && (latestT - minT) >= MIN_BASELINE_SPAN_MS;
      const baseline = hasDynamic && mean > 0 ? Math.round(mean * 10) / 10 : (hardcoded?.[loc.id] ?? 50);
      const current = latestV;
      const pct = baseline > 0 ? Math.round(((current - baseline) / baseline) * 100) : 0;
      const z = std > 0 ? Math.round(((current - mean) / std) * 10) / 10 : null;
      return { id: loc.id, name: loc.name, current, baseline, pct, z, n };
    }).filter(Boolean)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)); // 편차 절대값 큰 순

    const payload = { metric, higher_is_bad: higherIsBad, rows: list };
    cacheSet(`board:${metric}`, payload);
    res.json(payload);
  } catch (err) {
    console.error('[COMPARISON_BOARD] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/region-news', async (req, res) => {
  const { id, type } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  // 지역별 뉴스 검색 쿼리 매핑
  const NEWS_QUERIES = {
    suez:          'Suez Canal shipping disruption latest 2024',
    malacca:       'Malacca Strait shipping maritime security news',
    hormuz:        'Strait of Hormuz Iran oil tanker sanctions news',
    panama:        'Panama Canal drought water level shipping delay',
    dover:         'English Channel Dover shipping traffic maritime',
    korea_strait:  'Korea Strait Busan shipping trade maritime',
    bab_el_mandeb: 'Bab el-Mandeb Red Sea Houthi shipping attack',
    busan:         'Busan Port container shipping Korea trade',
    incheon:       'Incheon Port Korea shipping logistics',
    gwangyang:     'Gwangyang Port POSCO steel Korea shipping',
    singapore:     'Singapore Port container shipping throughput',
    shanghai:      'Shanghai Port container China trade shipping',
    rotterdam:     'Rotterdam Port Europe container LNG shipping',
    la_lb:         'Los Angeles Long Beach Port shipping container',
    dubai:         'Dubai Jebel Ali Port DP World shipping Middle East',
    yokohama:        'Yokohama port Japan shipping trade automotive 2024',
    kobe:            'Kobe port Japan shipping cargo Kansai trade 2024',
    ningbo:          'Ningbo Zhoushan port China shipping container iron ore 2024',
    shenzhen:        'Shenzhen Yantian port China manufacturing trade supply chain 2024',
    hongkong:        'Hong Kong port shipping container trade finance 2024',
    vladivostok:     'Vladivostok port Russia Pacific trade sanctions 2024',
    portklang:       'Port Klang Malaysia ASEAN shipping container trade 2024',
    mumbai:          'Mumbai JNPT port India shipping trade container 2024',
    hamburg:         'Hamburg port Europe shipping container trade energy 2024',
    newyork:         'Port of New York New Jersey container shipping US East Coast 2024',
    guangzhou:       'Guangzhou Nansha port China shipping container Pearl River Delta 2024',
    qingdao:         'Qingdao port China shipping container Korea trade Shandong 2024',
    tianjin:         'Tianjin Xingang port China shipping Beijing container trade 2024',
    antwerp:         'Antwerp Bruges port Belgium Europe shipping container chemical 2024',
    tanjung_pelepas: 'Tanjung Pelepas port Malaysia transshipment shipping Johor 2024',
    xiamen:          'Xiamen port China Taiwan shipping container trade 2024',
    kaohsiung:       'Kaohsiung port Taiwan shipping semiconductor container trade 2024',
    laem_chabang:    'Laem Chabang port Thailand shipping automotive container ASEAN 2024',
    jakarta:         'Jakarta Tanjung Priok port Indonesia shipping container palm oil 2024',
    colombo:         'Colombo port Sri Lanka Indian Ocean transshipment shipping 2024',
    savannah:        'Port of Savannah Georgia US East Coast container shipping 2024',
    hochiminhcity:   'Ho Chi Minh City Cat Lai port Vietnam shipping container manufacturing 2024',
  };

  const query = NEWS_QUERIES[id];
  if (!query) return res.status(404).json({ error: 'unknown region' });

  try {
    if (process.env.PERPLEXITY_API_KEY) {
      // Step 1: 영어로 검색
      const perplexRes = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a maritime news analyst. Find the most recent and relevant news about the given shipping location or route. Return up to 5 key news items in English. Format each as: "- **[Headline]**: [2-3 sentence summary]. (Source: [name], [date])"',
            },
            {
              role: 'user',
              content: `Find the latest news about: ${query}. Focus on: shipping disruptions, port congestion, geopolitical tensions, sanctions, attacks, weather impacts, and trade volume changes. Return only factual recent news.`,
            },
          ],
          search_recency_filter: 'week',
          return_citations: false,
        }),
      });
      if (!perplexRes.ok) throw new Error(`Perplexity ${perplexRes.status}`);
      const perplexData = await perplexRes.json();
      const englishContent = perplexData.choices?.[0]?.message?.content ?? '';

      if (!englishContent) return res.json({ source: 'perplexity', content: '최근 뉴스 없음' });

      // Step 2: Claude Haiku로 한국어 번역
      const content = await callClaude({
        systemPrompt: '해운 뉴스 번역가입니다. 영어 뉴스를 자연스러운 한국어로 번역하세요. 형식(-, **, 출처, 날짜 표기)은 그대로 유지하세요. 번역 외 다른 말은 추가하지 마세요.',
        userMessage: englishContent,
        maxTokens: 1200,
        model: 'claude-haiku-4-5',
        rawText: true,
      });
      return res.json({ source: 'perplexity', content });
    }

    // NewsAPI 폴백
    const params = new URLSearchParams({
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      from: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      apiKey: process.env.NEWSAPI_KEY,
    });
    const newsRes = await fetch(`https://newsapi.org/v2/everything?${params}`);
    const newsData = await newsRes.json();
    const items = (newsData.articles ?? []).slice(0, 5).map(a => ({
      title: a.title,
      description: a.description,
      source: a.source?.name,
      publishedAt: a.publishedAt,
    }));
    return res.json({ source: 'newsapi', items });
  } catch (err) {
    console.error('[REGION_NEWS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/news', async (req, res) => {
  const { from, q } = req.query;
  try {
    const params = new URLSearchParams({
      q: q ?? 'strait OR canal OR shipping OR sanctions OR port OR tanker OR blockade',
      language: 'en',
      sortBy: 'publishedAt',
      from: from ?? new Date(Date.now() - 900000).toISOString(),
      apiKey: process.env.NEWSAPI_KEY,
    });
    const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
    const data = await response.json();
    res.json(data.articles ?? []);
  } catch (err) {
    console.error('[NEWS] error:', err.message);
    res.json([]);
  }
});

httpServer.listen(PORT, () => {
  console.log(`[SERVER] Seabird proxy running on port ${PORT}`);
});
