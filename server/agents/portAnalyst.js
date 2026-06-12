const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');
const { resolveBaseline } = require('./baselineUtils');

const POLL_INTERVAL_MS = 10 * 60 * 1000;

const DEDUP_WINDOWS = {
  CRITICAL: 5 * 60 * 1000,
  WARNING:  8 * 60 * 1000,
  INFO:    15 * 60 * 1000,
};

const HARDCODED_BASELINE = {
  busan: 12, incheon: 8, gwangyang: 5, singapore: 45,
  shanghai: 80, rotterdam: 35, la_lb: 40, dubai: 20,
  yokohama: 18, kobe: 12, ningbo: 35, shenzhen: 28,
  hongkong: 45, vladivostok: 8, portklang: 22, mumbai: 20,
  hamburg: 25, newyork: 30, guangzhou: 60, qingdao: 55,
  tianjin: 50, antwerp: 30, tanjung_pelepas: 25, xiamen: 28,
  kaohsiung: 22, laem_chabang: 18, jakarta: 20, colombo: 15,
  savannah: 12, hochiminhcity: 18,
};

const PORTS = [
  { id: 'busan',       name: '부산항',           lat: 35.1028, lng: 129.0403,  radius_nm: 15 },
  { id: 'incheon',     name: '인천항',           lat: 37.4563, lng: 126.6078,  radius_nm: 12 },
  { id: 'gwangyang',   name: '광양항',           lat: 34.9333, lng: 127.7167,  radius_nm: 10 },
  { id: 'singapore',   name: '싱가포르항',       lat: 1.2654,  lng: 103.8198,  radius_nm: 20 },
  { id: 'shanghai',    name: '상하이항',         lat: 31.2304, lng: 121.4737,  radius_nm: 25 },
  { id: 'rotterdam',   name: '로테르담항',       lat: 51.9225, lng: 4.4792,    radius_nm: 20 },
  { id: 'la_lb',       name: 'LA/LB항',         lat: 33.7701, lng: -118.1937, radius_nm: 20 },
  { id: 'dubai',       name: '두바이항',         lat: 25.2048, lng: 55.2708,   radius_nm: 15 },
  { id: 'yokohama',    name: '요코하마항',       lat: 35.44,   lng: 139.64,    radius_nm: 20 },
  { id: 'kobe',        name: '고베항',           lat: 34.69,   lng: 135.19,    radius_nm: 15 },
  { id: 'ningbo',      name: '닝보·주산항',     lat: 29.87,   lng: 121.56,    radius_nm: 25 },
  { id: 'shenzhen',    name: '선전·옌톈항',     lat: 22.55,   lng: 114.28,    radius_nm: 20 },
  { id: 'hongkong',    name: '홍콩항',           lat: 22.31,   lng: 114.17,    radius_nm: 20 },
  { id: 'vladivostok', name: '블라디보스토크항', lat: 43.12,   lng: 131.89,    radius_nm: 15 },
  { id: 'portklang',   name: '포트클랑',         lat: 2.99,    lng: 101.43,    radius_nm: 20 },
  { id: 'mumbai',      name: '뭄바이항',         lat: 18.93,   lng: 72.83,     radius_nm: 20 },
  { id: 'hamburg',         name: '함부르크항',       lat: 53.55,   lng: 9.98,      radius_nm: 20 },
  { id: 'newyork',         name: '뉴욕·뉴저지항',   lat: 40.66,   lng: -74.08,    radius_nm: 25 },
  { id: 'guangzhou',       name: '광저우·난사항',   lat: 22.77,   lng: 113.58,    radius_nm: 25 },
  { id: 'qingdao',         name: '칭다오항',         lat: 36.07,   lng: 120.38,    radius_nm: 20 },
  { id: 'tianjin',         name: '톈진·신강항',     lat: 38.99,   lng: 117.72,    radius_nm: 20 },
  { id: 'antwerp',         name: '앤트워프항',       lat: 51.23,   lng: 4.40,      radius_nm: 20 },
  { id: 'tanjung_pelepas', name: '탄중펠레파스항',   lat: 1.36,    lng: 103.55,    radius_nm: 15 },
  { id: 'xiamen',          name: '샤먼항',           lat: 24.48,   lng: 118.09,    radius_nm: 15 },
  { id: 'kaohsiung',       name: '가오슝항',         lat: 22.62,   lng: 120.27,    radius_nm: 15 },
  { id: 'laem_chabang',    name: '렘차방항',         lat: 13.09,   lng: 100.89,    radius_nm: 15 },
  { id: 'jakarta',         name: '자카르타항',       lat: -6.09,   lng: 106.87,    radius_nm: 20 },
  { id: 'colombo',         name: '콜롬보항',         lat: 6.94,    lng: 79.85,     radius_nm: 20 },
  { id: 'savannah',        name: '사바나항',         lat: 32.09,   lng: -81.09,    radius_nm: 15 },
  { id: 'hochiminhcity',   name: '호치민항',         lat: 10.76,   lng: 106.70,    radius_nm: 20 },
];

const SYSTEM_PROMPT = `You are PORT ANALYST, a maritime intelligence agent for global port congestion monitoring.

Respond ONLY with valid JSON. Language: Korean. 개조식 마크다운 형식 필수.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[항만 현황 제목 — 이상 있으면 항만명 포함]",
  "summary": "전체 항만 현황 핵심 요약 (최대 80자). 이상 없으면 '30개 모니터링 항만 정상 운영 중' 형식.",
  "detail": "## 📊 항만 현황 (30개 모니터링)\\n\\n| 항만 | 대기 | 평년 | 변화 | 상태 |\\n|------|------|------|------|------|\\n| 부산항 | 8척 | 12척 | -33% | 🟢 정상 |\\n| 로테르담항 | 835척 | 35척 | +2,286% | 🔴 CRITICAL |\\n\\n## ⚠️ 이상 감지\\n- **항만명** — 상세 이상 내용\\n\\n## 🇰🇷 한국 공급망 시사점\\n- 영향 및 권고사항",
  "ai_comment": "운영 시사점 (최대 200자)",
  "data_points": [
    {"label": "모니터링 항만", "current": 8, "baseline": 8, "unit": "개", "change_pct": 0, "direction": "STABLE"},
    {"label": "대기 급증 항만", "current": 0, "baseline": 0, "unit": "개", "change_pct": 0, "direction": "STABLE"}
  ]
}

SEVERITY: CRITICAL = +60% 이상 또는 대기 12h+, WARNING = +40% 이상 또는 6h+, INFO = 이상 없음.
이상 없을 때 detail의 이상 감지 섹션: "- 이상 없음 — 30개 항만 정상 운영 중"
데이터가 적어도(테스트/초기 환경) 반드시 분석 의견 제공.`;

function nmToDeg(nm) { return nm / 60; }

// 인메모리 dedup 캐시
let _lastReport = null;  // { severity, triggered, ts }

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

async function queryPortShips(port) {
  const deg = nmToDeg(port.radius_nm);
  const { data } = await getDb()
    .from('ships')
    .select('mmsi, vessel_type, flag_country, speed, updated_at')
    .gte('lat', port.lat - deg).lte('lat', port.lat + deg)
    .gte('lng', port.lng - deg).lte('lng', port.lng + deg)
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
  return data ?? [];
}

async function runPortAnalyst() {
  console.log('[PORT_ANALYST] run at', new Date().toISOString());
  const db = getDb();

  const portDataArr = await Promise.all(PORTS.map(async (port) => {
    const ships = await queryPortShips(port);
    const waitingShips = ships.filter(s => (s.speed ?? 0) <= 2.0);

    // 평년: 충분한 실측 이력이 쌓이면 동적 평균, 그 전엔 하드코딩 기준값 (baselineUtils 공유 정책)
    const avg90d = await resolveBaseline(db, port.id, 'waiting_ships', HARDCODED_BASELINE[port.id] ?? 10);
    const changePct = avg90d > 0 ? Math.round(((waitingShips.length - avg90d) / avg90d) * 100) : 0;
    const waitHours = waitingShips.length * 0.5;

    // 선종 분포
    const typeDist = {};
    ships.forEach(s => { const t = s.vessel_type || 'Other'; typeDist[t] = (typeDist[t] || 0) + 1; });

    return {
      port: port.name,
      portId: port.id,
      portLat: port.lat,
      portLng: port.lng,
      total_ships: ships.length,
      waiting: waitingShips.length,
      avg90d,
      change_pct: changePct,
      est_wait_hours: waitHours,
      vessel_type_dist: typeDist,
      triggered: waitingShips.length > avg90d * 1.4 || waitHours > 6,
    };
  }));

  const triggeredPorts = portDataArr.filter(d => d.triggered);
  const severity = triggeredPorts.some(d => d.est_wait_hours > 12 || d.change_pct >= 60) ? 'CRITICAL'
    : triggeredPorts.length > 0 ? 'WARNING'
    : 'INFO';

  // 인메모리 dedup 확인
  if (_lastReport && _lastReport.severity === severity && _lastReport.triggered === triggeredPorts.length) {
    const age = Date.now() - _lastReport.ts;
    const window = DEDUP_WINDOWS[severity] ?? DEDUP_WINDOWS.INFO;
    if (age < window) {
      console.log('[PORT_ANALYST] dedup skip —', severity, `(${Math.round(age/60000)}min/${Math.round(window/60000)}min)`);
      return;
    }
  }

  const focusPort = triggeredPorts[0] ?? portDataArr.reduce((a, b) => a.total_ships > b.total_ships ? a : b);

  try {
    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        analysis_time: new Date().toISOString(),
        ports: portDataArr.map(d => ({
          port: d.port,
          total_ships: d.total_ships,
          waiting: d.waiting,
          avg_90d: d.avg90d,
          change_pct: d.change_pct,
          est_wait_hours: d.est_wait_hours,
          vessel_type_dist: d.vessel_type_dist,
          triggered: d.triggered,
        })),
        triggered_count: triggeredPorts.length,
        expected_severity: severity,
      }),
      maxTokens: 4000,  // 30개 항만 마크다운 표 + 분석 → truncation 방지
      model: 'claude-haiku-4-5',
    });

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'PORT_ANALYST',
      severity: result.severity ?? severity,
      title: result.title,
      summary: result.summary,
      detail: result.detail,
      data_points: result.data_points ?? [],
      annotations: [result.ai_comment].filter(Boolean),
      related_mmsi: [],
      location: { lat: focusPort.portLat, lng: focusPort.portLng, zoom: 8 },
      raw_data: { ports: portDataArr.length, triggered: triggeredPorts.length },
    });
    if (error) {
      console.error('[PORT_ANALYST] insert error:', error.message);
    } else {
      const finalSeverity = result.severity ?? severity;
      console.log('[PORT_ANALYST] report saved:', finalSeverity);
      _lastReport = { severity: finalSeverity, triggered: triggeredPorts.length, ts: Date.now() };
    }
  } catch (err) {
    console.error('[PORT_ANALYST] error:', err.message);
  }
}

function startPortAnalyst() {
  runPortAnalyst();
  return setInterval(runPortAnalyst, POLL_INTERVAL_MS);
}

module.exports = { runPortAnalyst, startPortAnalyst, PORTS, HARDCODED_BASELINE };
