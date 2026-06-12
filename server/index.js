require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { startPortAnalyst, runPortAnalyst, PORTS, HARDCODED_BASELINE: PORT_BASELINE } = require('./agents/portAnalyst');
const { startChokepointWatcher, runChokepointWatcher, CHOKEPOINTS } = require('./agents/chokepointWatcher');
const { startBaselinesWriter } = require('./agents/baselinesWriter');
const { startGeopoliticalLinker, runGeopoliticalLinker } = require('./agents/geopoliticalLinker');
const { startWeatherAgent } = require('./agents/weatherAgent');
const { startCommodityAnalyst } = require('./agents/commodityAnalyst');
const { callClaude } = require('./agents/claudeClient');
const { TRADE_PAIRS, SEASONAL_INDEX, getSeasonalCategory } = require('./data/tradePairs');

const PORT = process.env.PORT ?? 3001;
const SUPABASE_BATCH_INTERVAL_MS = 30 * 1000;
const POSITIONS_FLUSH_INTERVAL_MS = 10 * 1000;  // ship_positions: 10초마다 배치 INSERT
const TTL_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1시간마다 오래된 positions 삭제

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

// WebSocket 서버 (브라우저 relay용)
const wss = new WebSocketServer({ server: httpServer, path: '/relay' });
wss.on('connection', (ws) => {
  console.log('[RELAY] browser connected, total:', wss.clients.size);
  ws.on('close', () => console.log('[RELAY] browser disconnected, total:', wss.clients.size));
});

function broadcast(data) {
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

// ── AIS 데이터 배치 버퍼 ──────────────────────────────────────────────────────
const shipUpsertBuf = new Map(); // mmsi → ship object
const positionInsertBuf = [];    // { mmsi, lat, lng, speed, recorded_at }[]

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

function mmsiToFlag(mmsi) {
  const mid = parseInt(mmsi.substring(0, 3));
  const m = { 338:'USA',440:'KOR',441:'KOR',412:'CHN',413:'CHN',431:'JPN',432:'JPN',
              525:'IDN',563:'SGP',503:'AUS',636:'LBR',235:'GBR',211:'DEU',247:'ITA',
              244:'NLD',226:'FRA',224:'ESP',273:'RUS',419:'IND',470:'ARE' };
  return m[mid] ?? null;
}

function parsePositionReport(msg) {
  const m = msg.Message.PositionReport;
  const rawHeading = m.TrueHeading !== 511 ? m.TrueHeading : (m.Cog ?? null);
  const navStatus = (m.NavigationStatus != null && m.NavigationStatus !== 15) ? m.NavigationStatus : null;
  return {
    mmsi: String(m.UserID),
    lat: m.Latitude,
    lng: m.Longitude,
    speed: m.Sog ?? null,
    heading: rawHeading != null ? Math.round(rawHeading) : null,
    course: m.Cog != null ? Math.round(m.Cog) : null,
    nav_status: navStatus,
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
  };
}

// ── Supabase 배치 upsert (30초) ───────────────────────────────────────────────
setInterval(async () => {
  if (shipUpsertBuf.size === 0) return;
  const rows = Array.from(shipUpsertBuf.values()).filter(r => r.lat != null && r.lng != null);
  shipUpsertBuf.clear();
  if (rows.length === 0) return;

  const { error } = await supabase
    .from('ships')
    .upsert(rows, { onConflict: 'mmsi', ignoreDuplicates: false });
  if (error) console.error('[SUPABASE] ships upsert error:', error.message);
  else console.log(`[SUPABASE] upserted ${rows.length} ships`);
}, SUPABASE_BATCH_INTERVAL_MS);

// ── ship_positions 배치 INSERT (10초) ────────────────────────────────────────
setInterval(async () => {
  if (positionInsertBuf.length === 0) return;
  const rows = positionInsertBuf.splice(0, positionInsertBuf.length);

  const { error } = await supabase.from('ship_positions').insert(rows);
  if (error) console.error('[SUPABASE] positions insert error:', error.message);
}, POSITIONS_FLUSH_INTERVAL_MS);

// ── TTL 정리 (1시간 주기, 6시간 초과분 삭제) ──────────────────────────────────
setInterval(async () => {
  const cutoff = new Date(Date.now() - 6 * 3600000).toISOString();
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
      MessageTypes: ['PositionReport', 'ShipStaticData'],
      BoundingBoxes: [[[-90, -180], [90, 180]]],
    }));
  });

  aisWs.on('message', (data) => {
    lastAisMessageAt = Date.now();
    const raw = data.toString();
    // 브라우저로 relay
    broadcast(raw);

    try {
      const msg = JSON.parse(raw);

      if (msg.MessageType === 'PositionReport') {
        const parsed = parsePositionReport(msg);
        // ships 버퍼에 추가 (최신 위치로 덮어씀)
        const existing = shipUpsertBuf.get(parsed.mmsi) ?? {};
        shipUpsertBuf.set(parsed.mmsi, { ...existing, ...parsed });
        // positions 이력에 추가
        positionInsertBuf.push({
          mmsi: parsed.mmsi,
          lat: parsed.lat,
          lng: parsed.lng,
          speed: parsed.speed,
          recorded_at: parsed.updated_at,
        });
      } else if (msg.MessageType === 'ShipStaticData') {
        const parsed = parseShipStaticData(msg);
        const existing = shipUpsertBuf.get(parsed.mmsi) ?? {};
        // Type=0(미지정)이 들어올 때 기존에 알려진 선종을 덮어쓰지 않음
        if (parsed.vessel_type === 'Other' && existing.vessel_type && existing.vessel_type !== 'Other') {
          parsed.vessel_type = existing.vessel_type;
        }
        shipUpsertBuf.set(parsed.mmsi, { ...existing, ...parsed });
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

// ── HTTP 엔드포인트 ───────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ships_buffered: shipUpsertBuf.size }));

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
      model: 'claude-sonnet-4-6',
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

function nmToDegServer(nm) { return nm / 60; }

app.get('/api/port-stats', async (req, res) => {
  const { portId } = req.query;
  const port = PORTS?.find(p => p.id === portId);
  if (!port) return res.status(404).json({ error: 'port not found' });

  try {
    const deg = nmToDegServer(port.radius_nm);
    const cutoff = new Date(Date.now() - 3600000).toISOString();

    const { data: ships } = await supabase.from('ships')
      .select('vessel_type, flag_country, speed')
      .gte('lat', port.lat - deg).lte('lat', port.lat + deg)
      .gte('lng', port.lng - deg).lte('lng', port.lng + deg)
      .gte('updated_at', cutoff);

    const vesselTypeDist = {};
    const flagDist = {};
    let waitingCount = 0;
    (ships ?? []).forEach(s => {
      const type = s.vessel_type || 'Other';
      vesselTypeDist[type] = (vesselTypeDist[type] || 0) + 1;
      if (s.flag_country) flagDist[s.flag_country] = (flagDist[s.flag_country] || 0) + 1;
      if ((s.speed ?? 0) <= 2.0) waitingCount++;
    });
    const total = ships?.length ?? 0;

    const { data: reports } = await supabase.from('agent_reports')
      .select('id, severity, title, summary, created_at')
      .eq('agent_id', 'PORT_ANALYST')
      .order('created_at', { ascending: false })
      .limit(3);

    res.json({
      port: { id: port.id, name: port.name, lat: port.lat, lng: port.lng },
      total_ships: total,
      waiting_ships: waitingCount,
      baseline_waiting: PORT_BASELINE?.[port.id] ?? 10,
      vessel_type_dist: Object.entries(vesselTypeDist)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count, pct: total ? Math.round(count / total * 100) : 0 })),
      flag_dist: Object.entries(flagDist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([flag, count]) => ({ flag, count, pct: total ? Math.round(count / total * 100) : 0 })),
      recent_reports: reports ?? [],
    });
  } catch (err) {
    console.error('[PORT_STATS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chokepoint-stats', async (req, res) => {
  const { cpId } = req.query;
  const cp = CHOKEPOINTS?.find(c => c.id === cpId);
  if (!cp) return res.status(404).json({ error: 'chokepoint not found' });

  try {
    const [[latMin, lngMin], [latMax, lngMax]] = cp.bbox;
    const cutoff = new Date(Date.now() - 3600000).toISOString();

    const { data: ships } = await supabase.from('ships')
      .select('vessel_type, speed')
      .gte('lat', latMin).lte('lat', latMax)
      .gte('lng', lngMin).lte('lng', lngMax)
      .gte('updated_at', cutoff);

    const total = (ships ?? []).length;
    const CP_HARDCODED_BASELINE = { suez: 58, malacca: 247, hormuz: 89, panama: 35, dover: 312, korea_strait: 156, bab_el_mandeb: 67 };

    const { data: baselineRow } = await supabase.from('baselines')
      .select('avg_90d')
      .eq('location_id', cpId)
      .eq('metric', 'daily_throughput')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    // avg_90d가 0/null이면 하드코딩 평년값으로 폴백 (?? 는 0을 통과시키므로 || 사용)
    const baseline = (baselineRow?.avg_90d || CP_HARDCODED_BASELINE[cpId]) ?? 50;
    const change_pct = baseline > 0 ? Math.round(((total - baseline) / baseline) * 100) : 0;

    const typeDist = {};
    (ships ?? []).forEach(s => { const t = s.vessel_type || 'Other'; typeDist[t] = (typeDist[t] || 0) + 1; });

    res.json({
      current_ships: total,
      baseline,
      change_pct,
      vessel_type_dist: Object.entries(typeDist)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count, pct: total ? Math.round(count / total * 100) : 0 })),
    });
  } catch (err) {
    console.error('[CHOKEPOINT_STATS] error:', err.message);
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
