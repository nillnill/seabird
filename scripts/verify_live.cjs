// 라이브 검증: 최근 N분 보고를 agent별 severity 분포로 — 하위=INFO만, MASTER만 WARNING/CRITICAL인지 확인.
// 실행: node scripts/verify_live.cjs [분, 기본 20]
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { createClient } = require(path.join(__dirname, '../server/node_modules/@supabase/supabase-js'));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const mins = Number(process.argv[2] || 20);

(async () => {
  const since = new Date(Date.now() - mins * 60000).toISOString();
  const { data } = await db.from('agent_reports')
    .select('agent_id, severity, title, raw_data, created_at')
    .gte('created_at', since).order('created_at', { ascending: false });
  const rows = data ?? [];
  console.log(`최근 ${mins}분 보고 ${rows.length}건\n`);

  const byAgent = {};
  for (const r of rows) {
    const a = (byAgent[r.agent_id] ??= { INFO: 0, WARNING: 0, CRITICAL: 0, total: 0 });
    a[r.severity] = (a[r.severity] ?? 0) + 1; a.total++;
  }
  for (const [agent, c] of Object.entries(byAgent)) {
    const flag = (agent !== 'MASTER_AGENT' && (c.WARNING || c.CRITICAL)) ? '  ⚠️ 하위인데 WARNING/CRITICAL 있음!' : '';
    console.log(`${agent.padEnd(20)} 총${c.total}  INFO ${c.INFO} · WARN ${c.WARNING} · CRIT ${c.CRITICAL}${flag}`);
  }

  const master = rows.filter(r => r.agent_id === 'MASTER_AGENT');
  console.log('\n[MASTER_AGENT 최신]', master[0]
    ? `${master[0].severity} — ${master[0].title} (${new Date(master[0].created_at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})})`
    : '(아직 없음 — 재시작 +120초 후 기동)');

  // 캐릭터 다양성(항구/초크포인트)
  const chars = [...new Set(rows.filter(r => r.raw_data?.character).map(r => r.raw_data.character.name))];
  console.log(`캐릭터 보고 지역 ${chars.length}곳:`, chars.slice(0, 20).join(', '));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
