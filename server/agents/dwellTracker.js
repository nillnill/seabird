// 항만 체류시간(dwell) 추적 — 저비용 시간별 presence ledger.
// ship_positions(2h TTL, 과거 리소스 고갈 원인)는 쓰지 않는다. 대신 baselinesWriter가
// 매시(60분) 이미 수행하는 항만 스캔에 올라타, 그 순간 정박·대기(speed<=2kn) 선박만
// port_presence(open)에 누적한다. 일정 시간 미관측 시 출항으로 간주해 dwell_events로 마감.
//   - 저장량 = "현재 대기 중 선박"뿐 → 수백 행 규모, 비용 거의 0.
//   - 해상도 = 1시간(시간~일 단위 체류 추세에 충분).
// 산출물: dwell_events(입항→출항 1건) → xcapData.dwellSignals가 회전속도·수요압력 신호로 소비.

// 기본값은 운영용. 데모 가속이 필요하면 환경변수로 임시 오버라이드(서버 재시작 시 env 설정).
//   DWELL_DEPART_MS=360000 DWELL_MIN_HOURS=0.03  등
const DEPART_THRESHOLD_MS = Number(process.env.DWELL_DEPART_MS) || 2.5 * 3600000; // 2.5h 미관측 → 출항 간주
const MIN_DWELL_HOURS = process.env.DWELL_MIN_HOURS != null ? Number(process.env.DWELL_MIN_HOURS) : 1.0; // 드라이브바이 제외
const MIN_SCANS = Number(process.env.DWELL_MIN_SCANS) || 2; // 최소 관측 횟수
const DWELL_TTL_DAYS = 180;                 // dwell_events 보존 180일

// 현재 present 선박을 port_presence에 upsert(단일 RPC). present: [{ mmsi, vessel_type }]
async function recordPresence(db, portId, present, now) {
  if (!present || present.length === 0) return { upserted: 0 };
  const rows = present.map(s => ({ mmsi: s.mmsi, port_id: portId, vessel_type: s.vessel_type ?? null }));
  const { error } = await db.rpc('port_presence_touch', { _rows: rows, _now: now.toISOString() });
  if (error) throw new Error(`port_presence_touch: ${error.message}`);
  return { upserted: rows.length };
}

// last_seen_at이 오래된 open 행을 dwell_events로 마감(자격 충족 시) 후 일괄 삭제.
async function closeStaleVisits(db, portId, now) {
  const cutoff = new Date(now.getTime() - DEPART_THRESHOLD_MS).toISOString();
  const { data: stale, error: selErr } = await db.from('port_presence')
    .select('mmsi, port_id, vessel_type, first_seen_at, last_seen_at, scans')
    .eq('port_id', portId)
    .lt('last_seen_at', cutoff);
  if (selErr) throw new Error(`port_presence select: ${selErr.message}`);
  if (!stale || stale.length === 0) return { closed: 0, dropped: 0 };

  const events = [];
  for (const r of stale) {
    const dwellHours = (new Date(r.last_seen_at).getTime() - new Date(r.first_seen_at).getTime()) / 3600000;
    if (dwellHours >= MIN_DWELL_HOURS && (r.scans ?? 0) >= MIN_SCANS) {
      events.push({
        mmsi: r.mmsi, port_id: r.port_id, vessel_type: r.vessel_type,
        entered_at: r.first_seen_at, exited_at: r.last_seen_at,
        dwell_hours: Math.round(dwellHours * 100) / 100, scans: r.scans ?? 0,
      });
    }
  }
  // insert 먼저, delete 나중 — 사이 크래시 시 최악 다음 사이클 재마감(중복 1건, 분석용 허용).
  if (events.length) {
    const { error: insErr } = await db.from('dwell_events').insert(events);
    if (insErr) throw new Error(`dwell_events insert: ${insErr.message}`);
  }
  const { error: delErr } = await db.from('port_presence')
    .delete().eq('port_id', portId).lt('last_seen_at', cutoff);
  if (delErr) throw new Error(`port_presence delete: ${delErr.message}`);
  return { closed: events.length, dropped: stale.length - events.length };
}

// 한 항만 1사이클: present 기록 후 stale 마감. baselinesWriter 루프에서 호출.
// present가 비면(AIS 공백 의심) close를 건너뛴다 — 단일 공백 사이클을 대량 출항으로 오인 방지.
async function trackPortDwell(db, portId, presentShips, now) {
  await recordPresence(db, portId, presentShips, now);
  if (!presentShips || presentShips.length === 0) return { closed: 0, dropped: 0, skippedClose: true };
  return closeStaleVisits(db, portId, now);
}

// dwell_events 180일 초과분 삭제(느린 6h 인터벌). port_presence는 closeStaleVisits로 자가 정리.
async function cleanupDwellEvents(db) {
  const cutoff = new Date(Date.now() - DWELL_TTL_DAYS * 86400000).toISOString();
  const { error } = await db.from('dwell_events').delete().lt('exited_at', cutoff);
  if (error && !/Could not find the table/i.test(error.message)) {
    console.error('[DWELL] cleanup error:', error.message);
  }
}

module.exports = {
  recordPresence, closeStaleVisits, trackPortDwell, cleanupDwellEvents,
  DEPART_THRESHOLD_MS, MIN_DWELL_HOURS, MIN_SCANS, DWELL_TTL_DAYS,
};
