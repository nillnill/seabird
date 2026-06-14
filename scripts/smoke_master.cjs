// 스모크: MASTER_AGENT 1회 실행 — 최근 하위 사실 보고를 종합해 severity 판단·저장.
// 실행: node scripts/smoke_master.cjs
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { runMasterAgent } = require('../server/agents/masterAgent');
const { createClient } = require(path.join(__dirname, '../server/node_modules/@supabase/supabase-js'));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('MASTER_AGENT 실행...');
  await runMasterAgent();

  const { data } = await db.from('agent_reports')
    .select('severity, title, summary, annotations, data_points, raw_data, created_at')
    .eq('agent_id', 'MASTER_AGENT').order('created_at', { ascending: false }).limit(1);
  const r = data?.[0];
  if (!r) { console.log('(MASTER 보고 없음 — 최근 90분 하위 보고가 없어 skip됐을 수 있음)'); process.exit(0); }
  console.log('\n──────── MASTER 종합 보고 ────────');
  console.log('심각도 :', r.severity);
  console.log('제목   :', r.title);
  console.log('요약   :', r.summary);
  console.log('근본원인:', r.raw_data?.root_cause);
  console.log('소스보고:', r.raw_data?.source_reports, '건');
  console.log('핵심발견:', JSON.stringify(r.annotations));
  console.log('수치   :', JSON.stringify(r.data_points));
  console.log('────────────────────────────');
  process.exit(0);
})().catch(e => { console.error('스모크 에러:', e); process.exit(1); });
