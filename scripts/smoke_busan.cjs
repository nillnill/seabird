// 스모크 테스트: 부산항 캐릭터 보고 1건을 실제로 생성·저장한다.
// 실행: node scripts/smoke_busan.cjs
// 필요 env: server/.env (ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const path = require('path');
// dotenv·에이전트 의존성은 server/node_modules에 있으므로 그쪽 경로로 로드
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PORTS, getDb, collectPortStats, reportPort } = require('../server/agents/portAnalyst');

(async () => {
  for (const k of ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[k]) { console.error('환경변수 없음:', k); process.exit(1); }
  }
  const db = getDb();
  const busan = PORTS.find(p => p.id === 'busan');

  console.log('1) 부산항 실시간 통계 수집...');
  const stat = await collectPortStats(busan, db);
  console.log('   total:', stat.total, '대기:', stat.waiting, '평년:', stat.avg90d,
    '변화:', stat.changePct + '%', 'severity:', stat.severity);
  console.log('   선종분포:', JSON.stringify(stat.typeDist));

  if (stat.total === 0) {
    console.warn('⚠️  부산항 반경 내 신선한 선박 0척 — ships 테이블이 비었거나 커버리지 공백.');
    console.warn('   실제 runPortAnalyst는 0척이면 skip하지만, 스모크는 강제로 보고를 생성한다.');
  }

  console.log('2) 캐릭터(장보고) 1인칭 보고 생성 + 저장...');
  const ok = await reportPort(stat, db);
  if (!ok) { console.error('❌ 보고 생성/저장 실패'); process.exit(1); }

  console.log('3) 방금 저장된 보고 확인...');
  const { data } = await db
    .from('agent_reports')
    .select('id, severity, title, summary, detail, annotations, data_points, raw_data, created_at')
    .eq('agent_id', 'PORT_ANALYST')
    .order('created_at', { ascending: false })
    .limit(1);
  const r = data?.[0];
  if (!r) { console.error('❌ 저장 행 조회 실패'); process.exit(1); }

  console.log('\n──────── 저장된 보고 ────────');
  console.log('캐릭터 :', r.raw_data?.character?.name, '·', r.raw_data?.character?.title);
  console.log('이미지 :', r.raw_data?.character?.image);
  console.log('심각도 :', r.severity);
  console.log('제목   :', r.title);
  console.log('요약   :', r.summary);
  console.log('수치   :', JSON.stringify(r.data_points));
  console.log('코멘트 :', JSON.stringify(r.annotations));
  console.log('\n[detail]\n' + r.detail);
  console.log('────────────────────────────');
  console.log('\n✅ 스모크 통과 — 프론트 피드 "항구" 탭에서 확인 가능');
  process.exit(0);
})().catch(e => { console.error('스모크 에러:', e); process.exit(1); });
