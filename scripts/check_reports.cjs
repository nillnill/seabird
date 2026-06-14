// 최근 캐릭터 보고 점검: node scripts/check_reports.cjs
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { createClient } = require(path.join(__dirname, '../server/node_modules/@supabase/supabase-js'));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const since = new Date(Date.now() - 30 * 60000).toISOString();
  for (const agent of ['PORT_ANALYST', 'CHOKEPOINT_WATCHER']) {
    const { data } = await db.from('agent_reports')
      .select('title, raw_data, created_at')
      .eq('agent_id', agent).gte('created_at', since)
      .order('created_at', { ascending: false });
    const chars = (data ?? []).filter(r => r.raw_data?.character)
      .map(r => `${r.raw_data.character.name}(${r.raw_data.port_id || r.raw_data.cp_id})`);
    console.log(`[${agent}] 최근 30분 캐릭터 보고 ${chars.length}건:`, chars.join(', ') || '(없음)');
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
