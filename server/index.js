require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

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
  if (typeCode >= 72 && typeCode <= 74) return 'Bulk Carrier';
  if (typeCode >= 70 && typeCode <= 79) return 'Container Ship';
  if (typeCode === 84 || typeCode === 85) return 'LNG Carrier';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  if (typeCode >= 50 && typeCode <= 59) return 'Special Craft';
  if (typeCode >= 30 && typeCode <= 39) return 'Fishing';
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
  const heading = m.TrueHeading !== 511 ? m.TrueHeading : (m.Cog ?? null);
  return {
    mmsi: String(m.UserID),
    lat: m.Latitude,
    lng: m.Longitude,
    speed: m.Sog ?? null,
    heading,
    course: m.Cog ?? null,
    updated_at: new Date().toISOString(),
  };
}

function parseShipStaticData(msg) {
  const m = msg.Message.ShipStaticData;
  const mmsi = String(m.UserID);
  return {
    mmsi,
    ship_name: m.Name?.trim() || null,
    vessel_type: mapAISTypeToCategory(m.Type ?? 0),
    destination: m.Destination?.trim() || null,
    draught: m.MaximumStaticDraught ?? null,
    call_sign: m.CallSign?.trim() || null,
    imo: m.ImoNumber ? String(m.ImoNumber) : null,
    flag_country: mmsiToFlag(mmsi),
    origin_country: mmsiToFlag(mmsi),
  };
}

// ── Supabase 배치 upsert (30초) ───────────────────────────────────────────────
setInterval(async () => {
  if (shipUpsertBuf.size === 0) return;
  const rows = Array.from(shipUpsertBuf.values());
  shipUpsertBuf.clear();

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

// ── TTL 정리 (1시간, 2시간 초과분 삭제) ───────────────────────────────────────
setInterval(async () => {
  const cutoff = new Date(Date.now() - 2 * 3600000).toISOString();
  const { error } = await supabase
    .from('ship_positions')
    .delete()
    .lt('recorded_at', cutoff);
  if (error) console.error('[TTL] cleanup error:', error.message);
  else console.log('[TTL] ship_positions cleanup done');
}, TTL_CLEANUP_INTERVAL_MS);

// ── aisstream.io WebSocket 연결 ───────────────────────────────────────────────
let aisWs = null;

function connectAIS() {
  console.log('[AIS] connecting to aisstream.io...');
  aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');

  aisWs.on('open', () => {
    console.log('[AIS] connected');
    aisWs.send(JSON.stringify({
      APIKey: process.env.AISSTREAM_API_KEY,
      MessageTypes: ['PositionReport', 'ShipStaticData'],
      BoundingBoxes: [[[-180, -90], [180, 90]]],
    }));
  });

  aisWs.on('message', (data) => {
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

connectAIS();

// ── HTTP 엔드포인트 ───────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ships_buffered: shipUpsertBuf.size }));

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
