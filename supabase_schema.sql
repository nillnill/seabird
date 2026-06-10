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

-- ── RLS (최소 설정) ──────────────────────────────────────────────────────────
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_reports" ON agent_reports FOR SELECT USING (true);
-- ships, ship_positions, baselines: 프록시 서버(service role)만 쓰기 — anon 읽기 허용
ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_ships" ON ships FOR SELECT USING (true);
