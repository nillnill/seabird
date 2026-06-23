-- Seabird — Supabase 스키마
-- Supabase SQL 에디터에서 전체 실행

-- ── ships: AIS 현재 상태 캐시 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ships (
  mmsi            VARCHAR(9) PRIMARY KEY,
  ship_name       VARCHAR(100),
  vessel_type     VARCHAR(50) DEFAULT 'Other',
  lat             DECIMAL(9, 6) NOT NULL,
  lng             DECIMAL(9, 6) NOT NULL,
  speed           DECIMAL(5, 2),
  heading         SMALLINT,
  course          SMALLINT,
  nav_status      SMALLINT,
  draught         DECIMAL(4, 1),
  max_draught     DECIMAL(4, 1),
  dwt             INTEGER,
  destination     VARCHAR(100),
  eta             TIMESTAMP,
  flag_country    VARCHAR(3),
  imo             VARCHAR(7),
  call_sign       VARCHAR(8),
  origin_country  VARCHAR(3),
  dest_country    VARCHAR(3),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ships_location   ON ships (lat, lng);
CREATE INDEX IF NOT EXISTS idx_ships_vessel_type ON ships (vessel_type);
CREATE INDEX IF NOT EXISTS idx_ships_speed       ON ships (speed);
CREATE INDEX IF NOT EXISTS idx_ships_updated_at  ON ships (updated_at);

-- ── ship_positions: AIS 위치 이력 (ANOMALY DETECTOR용, 2h TTL) ──────────────
CREATE TABLE IF NOT EXISTS ship_positions (
  id          BIGSERIAL PRIMARY KEY,
  mmsi        VARCHAR(9) NOT NULL,
  lat         DECIMAL(9, 6) NOT NULL,
  lng         DECIMAL(9, 6) NOT NULL,
  speed       DECIMAL(5, 2),
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_positions_mmsi_time ON ship_positions (mmsi, recorded_at DESC);
-- TTL 정리(DELETE ... WHERE recorded_at < cutoff)가 풀스캔하지 않도록 recorded_at 단독 인덱스
CREATE INDEX IF NOT EXISTS idx_ship_positions_recorded_at ON ship_positions (recorded_at);

-- ── agent_reports: 에이전트 생성 보고 카드 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     VARCHAR(30) NOT NULL,
  severity     VARCHAR(10) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  title        VARCHAR(60) NOT NULL,
  summary      VARCHAR(120) NOT NULL,
  detail       TEXT,
  data_points  JSONB,
  annotations  JSONB,
  related_mmsi JSONB,
  location     JSONB,
  raw_data     JSONB,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_id  ON agent_reports (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_severity  ON agent_reports (severity);
CREATE INDEX IF NOT EXISTS idx_agent_reports_created_at ON agent_reports (created_at DESC);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE agent_reports;

-- ── baselines: 스냅샷 누적 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baselines (
  id            BIGSERIAL PRIMARY KEY,
  location_id   VARCHAR(30) NOT NULL,
  metric        VARCHAR(50) NOT NULL,
  current_value DECIMAL(12, 4) NOT NULL,
  avg_90d       DECIMAL(12, 4),
  snapshot_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baselines_location_metric ON baselines (location_id, metric);
CREATE INDEX IF NOT EXISTS idx_baselines_snapshot_at     ON baselines (snapshot_at DESC);

-- ── traffic_snapshots: 항만·초크포인트 분해 시계열 (입출항·선종·기국·목적지·원자재 유입 추정) ──
-- baselinesWriter가 30분마다 적재. FLOW REPORTER가 이력에서 원자재 유입 추세 산출.
CREATE TABLE IF NOT EXISTS traffic_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  location_id   VARCHAR(30) NOT NULL,
  location_type VARCHAR(12) NOT NULL,        -- 'port' | 'chokepoint'
  total_ships   INT NOT NULL DEFAULT 0,
  inbound       INT,
  outbound      INT,
  passing       INT,
  vessel_type_dist  JSONB,                   -- [{type,count,pct}]
  flag_dist         JSONB,                   -- [{flag,count,pct}]
  dest_country_dist JSONB,                   -- [{country,count,pct}] (port)
  inbound_by_type   JSONB,                   -- {Tanker:n, 'Bulk Carrier':n, ...} (port)
  commodity_inflow  JSONB,                   -- {tanker_ships, est_liquid_dwt, est_dry_bulk_dwt, est_container_teu, ...} (port)
  snapshot_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_traffic_loc ON traffic_snapshots (location_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_at  ON traffic_snapshots (snapshot_at DESC);

-- ── anomaly_history: ANOMALY DETECTOR 이력 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi         VARCHAR(9) NOT NULL,
  anomaly_type VARCHAR(30) NOT NULL,
  risk_score   SMALLINT NOT NULL,
  flags        JSONB NOT NULL,
  report_id    UUID REFERENCES agent_reports(id),
  detected_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_history_mmsi ON anomaly_history (mmsi);

-- ── freight_history: 운임·선가 지수 시계열 (KOBC 스크래핑) ───────────────────
-- X CAPITAL(투자 인텔리전스)의 운임 시계열 소스. KOBC가 과거 날짜를 반환하므로 즉시 백필 가능.
CREATE TABLE IF NOT EXISTS freight_history (
  id         BIGSERIAL PRIMARY KEY,
  index_code VARCHAR(30) NOT NULL,   -- 'KDCI','CAPE','PANAMAX','NCFI','NEWBUILD_CAPE' 등
  category   VARCHAR(20) NOT NULL,   -- 'drybulk','container','shipprice','port'
  obs_date   DATE NOT NULL,
  value      DECIMAL,
  unit       VARCHAR(16),
  UNIQUE (index_code, obs_date)
);
CREATE INDEX IF NOT EXISTS idx_freight_code_date ON freight_history (index_code, obs_date DESC);

-- ── draft_events: 선박 입항/출항 흘수 변화 (Δdraft 화물량 추정) ──────────────
-- 무료 AIS는 흘수 수신이 희소 → 천천히 축적. 충분해지기 전엔 X CAPITAL이 '데모 모드'로 표시.
CREATE TABLE IF NOT EXISTS draft_events (
  id          BIGSERIAL PRIMARY KEY,
  mmsi        VARCHAR(15) NOT NULL,
  port_id     VARCHAR(30),
  vessel_type VARCHAR(30),
  draught_in  DECIMAL,
  draught_out DECIMAL,
  delta       DECIMAL,
  dwt         INT,
  event_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_draft_events_port ON draft_events (port_id, event_at DESC);

-- ── port_presence: 진행 중(open) 항만 체류 — mmsi×port 당 1행 ─────────────────
-- baselinesWriter가 매시(60분) "현재 정박·대기(speed<=2kn)" 선박을 upsert(port_presence_touch).
-- last_seen_at이 DEPART_THRESHOLD보다 오래되면 dwell_events로 마감 후 이 행 삭제. 내부 작업 상태(anon 미노출).
CREATE TABLE IF NOT EXISTS port_presence (
  mmsi          VARCHAR(15) NOT NULL,
  port_id       VARCHAR(30) NOT NULL,
  vessel_type   VARCHAR(50),
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  scans         INT NOT NULL DEFAULT 1,
  PRIMARY KEY (mmsi, port_id)
);
-- 마감 스윕(WHERE last_seen_at < cutoff)이 풀스캔하지 않도록
CREATE INDEX IF NOT EXISTS idx_port_presence_last_seen ON port_presence (last_seen_at);

-- ── dwell_events: 마감(closed)된 체류 1건 = 입항→출항 ─────────────────────────
-- X CAPITAL이 항만 회전속도·대기 적체·수요압력 신호로 사용. 미생성 시 dwell은 demo 모드.
CREATE TABLE IF NOT EXISTS dwell_events (
  id          BIGSERIAL PRIMARY KEY,
  mmsi        VARCHAR(15) NOT NULL,
  port_id     VARCHAR(30) NOT NULL,
  vessel_type VARCHAR(50),
  entered_at  TIMESTAMP NOT NULL,
  exited_at   TIMESTAMP NOT NULL,
  dwell_hours DECIMAL(8, 2) NOT NULL,
  scans       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dwell_events_port_exit ON dwell_events (port_id, exited_at DESC);
CREATE INDEX IF NOT EXISTS idx_dwell_events_exit ON dwell_events (exited_at);

-- port_presence를 항구당 1 RPC로 upsert. first_seen_at은 conflict 시 보존, scans는 +1.
CREATE OR REPLACE FUNCTION port_presence_touch(_rows jsonb, _now timestamptz)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO port_presence (mmsi, port_id, vessel_type, first_seen_at, last_seen_at, scans)
  SELECT r->>'mmsi', r->>'port_id', r->>'vessel_type', _now, _now, 1
  FROM jsonb_array_elements(_rows) AS r
  ON CONFLICT (mmsi, port_id) DO UPDATE
    SET last_seen_at = _now,
        scans        = port_presence.scans + 1,
        vessel_type  = COALESCE(EXCLUDED.vessel_type, port_presence.vessel_type);
END $$;

-- ── kor_port_monthly: 해양수산부 공공데이터(월별 공식 통계) — AIS 사각지대 국내항 보완 ──
-- vessel: 항만별 입·출항 척수(SsopVsslEtryndHarbor2). cargo: 전국 품목별 처리량(SsopCargFrghtPrdlst2, port_id='KR').
-- X CAPITAL Taylor(철광석·유연탄)·Wagner(원유·석유정제품)·Axelrod(부산 입항)에 월별 계단선으로 병합.
CREATE TABLE IF NOT EXISTS kor_port_monthly (
  id         BIGSERIAL PRIMARY KEY,
  port_id    VARCHAR(30) NOT NULL,         -- 우리 port id, 전국 통계는 'KR'
  category   VARCHAR(16) NOT NULL,         -- 'vessel' | 'cargo'
  item       VARCHAR(40) NOT NULL,         -- vessel='in'|'out', cargo=품목코드(frghtPrdlstCd)
  period_ym  CHAR(6)     NOT NULL,         -- 'YYYYMM'
  value      DECIMAL,
  unit       VARCHAR(16),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (port_id, category, item, period_ym)
);
CREATE INDEX IF NOT EXISTS idx_kor_port_monthly ON kor_port_monthly (port_id, category, period_ym DESC);

-- ── sea_density_daily: GICOMS 연안 AIS 해역 통항 밀집도 (일별 준실시간) ─────────
-- GICOMS WFS가 2026-06-22 수정되어 일별·당일까지 제공(이전엔 월별·수개월 지연이라 kor_port_monthly에
-- 월 1일만 저장했음). aisstream 무료티어가 못 보는 국내 산업항(광양·포항·당진·울산·여수)을
-- 라이브 AIS와 동일한 일별 케이던스의 1차 신호로 X CAPITAL이 사용. freight_history(obs_date) 패턴 미러.
CREATE TABLE IF NOT EXISTS sea_density_daily (
  id         BIGSERIAL PRIMARY KEY,
  port_id    VARCHAR(30) NOT NULL,        -- 우리 port id (busan·ulsan·gwangyang 등)
  obs_date   DATE NOT NULL,
  ais_sum    DECIMAL,                     -- 항구 BBOX 내 3개 2h 윈도우 AIS 접촉 합(통항 강도)
  cells      INT,                         -- 응답 격자 셀 수(데이터 유무 판단)
  unit       VARCHAR(16) DEFAULT 'AIS통항',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (port_id, obs_date)
);
CREATE INDEX IF NOT EXISTS idx_sea_density_daily ON sea_density_daily (port_id, obs_date DESC);

-- ── 지정학 Fulcrum (Geopolitical Alpha) — 국가별 제약·공급루트 ─────────────────
-- 데이터 모델: 원자(재사용·시계열·출처) ↔ 합성(표현) 분리 → 2·3차 가공 대비.
-- country_indicators = 원자(모든 공식/파생 지표 1행=1지표). country_fulcrum = 합성(4제약 사실목록+fulcrum).
-- country_supply_routes = 에너지·광물 수입 의존(공급원×%)+해상 루트 지오메트리(searoute)+초크포인트 위험포인트.
CREATE TABLE IF NOT EXISTS country_indicators (
  id           BIGSERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,                 -- ISO3
  domain       TEXT NOT NULL,                 -- political|market|geopolitics|legal|maritime
  metric_key   TEXT NOT NULL,                 -- unemployment|gdp_growth|energy_import_dep|oil_dependence_pct ...
  value        NUMERIC,
  text_value   TEXT,
  unit         TEXT,
  source       TEXT,                          -- WorldBank|OECD|UNComtrade|EIA|USGS|Perplexity|Seabird
  as_of        DATE,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, domain, metric_key, as_of)
);
CREATE INDEX IF NOT EXISTS idx_country_indicators ON country_indicators (country_code, domain, as_of DESC);

CREATE TABLE IF NOT EXISTS country_fulcrum (
  country_code        TEXT PRIMARY KEY,
  country_name        TEXT,
  fulcrum_constraint  TEXT,                   -- political|market|geopolitics|legal
  fulcrum_summary     TEXT,                   -- 넷 어세스먼트 서술(점수 아님)
  fulcrum_direction   TEXT,                   -- tightening|loosening|stable
  constraints         JSONB,                  -- {political:[{fact,value,unit,source,as_of,trend?}], market:[...], geopolitics:[...], legal:[...]}
  maritime_streams    JSONB,                  -- 우리 라이브 스트림(초크포인트 의존·기국·유입·운임)
  sources             JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS country_supply_routes (
  id            BIGSERIAL PRIMARY KEY,
  importer_code TEXT NOT NULL,                -- 수입국 ISO3
  commodity     TEXT NOT NULL,               -- crude|refined|lng|coal|iron_ore|copper|nickel|rare_earth|grain
  supplier_code TEXT,                         -- 공급원 ISO3
  supplier_name TEXT,
  share_pct     NUMERIC,                      -- 공급원별 수입 비중 %
  route_geojson JSONB,                        -- searoute LineString Feature
  chokepoints   JSONB,                        -- 루트가 지나는 초크포인트 id 목록(위험포인트)
  distance_nm   NUMERIC,
  source        TEXT,                         -- UNComtrade|EIA|curated
  as_of         DATE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (importer_code, commodity, supplier_code)
);
CREATE INDEX IF NOT EXISTS idx_country_supply_routes ON country_supply_routes (importer_code, commodity);

-- ── region_news: 항만·초크포인트 뉴스 일배치 저장(지역당 1행, 최신 1주) ─────────
-- regionNewsCollector(매일)가 Perplexity 수집→Claude 번역→upsert. /api/region-news가 저장본을 즉시 서빙.
CREATE TABLE IF NOT EXISTS region_news (
  region_id   VARCHAR(30) PRIMARY KEY,
  region_type VARCHAR(12),               -- 'port' | 'chokepoint'
  content     TEXT,                       -- 한국어 번역 뉴스(개조식)
  source      VARCHAR(20),                -- 'perplexity'
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS (최소 설정) ──────────────────────────────────────────────────────────
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_reports" ON agent_reports FOR SELECT USING (true);
-- ships, ship_positions, baselines: 프록시 서버(service role)만 쓰기 — anon 읽기 허용
ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_ships" ON ships FOR SELECT USING (true);
ALTER TABLE ship_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_positions" ON ship_positions FOR SELECT USING (true);
-- dwell_events: anon 읽기 허용(분석용). port_presence는 내부 작업 상태라 정책 없음(service role만).
ALTER TABLE dwell_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_dwell" ON dwell_events FOR SELECT USING (true);
ALTER TABLE kor_port_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_kor_port_monthly" ON kor_port_monthly FOR SELECT USING (true);
ALTER TABLE sea_density_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_sea_density_daily" ON sea_density_daily FOR SELECT USING (true);
ALTER TABLE region_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_region_news" ON region_news FOR SELECT USING (true);
