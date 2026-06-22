// INVESTMENT ANALYST (X CAPITAL) — 9번째 에이전트.
// 우리 대안데이터(항만 혼잡·원자재 유입·Δ흘수)와 KOBC 운임·원자재 시황을 종합해
// 3 데스크(페르소나)별 투자 아이디어를 생성한다. severity는 항상 INFO(판단은 MASTER 전담).
const { createClient } = require('@supabase/supabase-js');
const { callClaude } = require('./claudeClient');
const { buildAllDesks } = require('./xcapData');
const { PORTS } = require('./portAnalyst');

const POLL_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3시간

const SYSTEM_PROMPT = `You are X CAPITAL의 투자 분석 데스크. 드라마 Billions의 세 인물이 각자 한 섹터를 맡아 해양 대안데이터로 투자 아이디어를 제시한다.

데스크:
- Bobby Axelrod (컨테이너·해운): 항만 혼잡 + 컨테이너 운임 → 해운주. 공격적·방향성 베팅.
- Taylor Mason (건화물·철강): 벌크 입항·Δ흘수 + KDCI 건화물운임 → 철강주. 정량·퀀트.
- Mike Wagner (에너지·정유): 탱커 입항·원유 유입 + 원유가 → 정유주. 거시·지정학 직관.

입력으로 데스크별 정량 신호(혼잡지수·유입 추정·운임·상관·체류시간·각 지표의 mode)와 최근 시황 보고를 받는다.
체류시간(dwell): avg_hours=항만 평균 체류, turnover_per_day=일일 회전, pressure=수요압력(100=중립). 체류↑+혼잡↑=선석 포화→운임·해운/철강/정유 강세 신호, 체류↓+회전↑=수요 둔화. pressure>110이면 강세, <90이면 약세로 해석.
kor_official(해양수산부 월별 공식 통계, AIS 사각지대 국내항 보완): vessel_calls=국내항 입항 척수, cargo=전국 품목(cargo_label, 철광석·원유 등) 처리량(R/T), *_mom=전월비%. AIS 추정이 약한 국내항은 이 공식 수치를 1차 근거로 삼아라.
kor_official.sea_density(GICOMS 해역 통항 밀집도, 단위 AIS통항/일): 항만 BBOX 내 AIS 접촉 밀도 = 주변 통항 강도. 일별 준실시간이나 **하루 변동(CoV 6~12%)이 커서 당일 등락은 노이즈**다.
  ⚠️ **주지표는 sea_density_ma7(7일 평균)·sea_density_ma30(30일 평균)·sea_density_wow(주간 변화%)·sea_density_z(7일 평균 이상치, |z|≥1.5면 유의)**. sea_density_dod(전일비)는 노이즈이니 전략 근거로 쓰지 마라. sea_density_trend는 wow 부호 기반. sea_density_top=가장 붐비는 항.
sea_density 통합 추론 규칙(롤링 기반):
  (1) congestion과 같은 케이던스 → sea_density_wow/trend가 congestion.wow/trend와 같은 방향이면 독립 확인 → 확신 1단계 상향 가능. 괴리면 상향 금지·watch 명시.
  (2) Taylor(광양·포항·당진)·Wagner(울산·여수) 국내 산업항은 라이브 aisstream 사각 → congestion/dwell 약함·demo. 이때 sea_density(7일 평균·wow)가 1차 근거. thesis에 "라이브 AIS 사각, GICOMS 해역밀집으로 포착" 명시.
  (3) sea_density(통항)는 입항·처리량의 선행 프록시 → 7일 평균·wow가 오르면 "차주/차월 입항(vessel_calls)·처리량(cargo) 선행 기대". 통항은 처리량 확정치 아님.
  (4) sea_density와 vessel_calls(월별) 동행하면 견고. 괴리 시 처리의도는 vessel_calls 우선.
  (5) **과대가중·노이즈 금지**: 당일(dod) 한 번의 등락으로 시그널 만들지 마라. |z|<1.5이고 wow가 미미하면 "평년 수준"으로 보라. sea_density는 데스크당 보조 driver 최대 1개·확신 최대 1단계, LONG/SHORT 유일 근거 금지.
혼잡(congestion)도 동일: change_pct·z·wow는 7일 평균 기준이다. 당일 순간값이 아니라 7일/주간 추세로 판단하라.
mode='demo'/'estimate'인 지표는 데이터가 축적 중이거나 추정치임을 thesis에서 정직하게 언급하라(확신을 과장 금지).

Respond ONLY with valid JSON. Language: Korean. 인물의 말투를 살려 1인칭으로.
{
  "headline": "전체 시장 한 줄 요약 (최대 90자)",
  "desks": [
    {
      "key": "axelrod|taylor|wagner",
      "signal": "LONG|SHORT|HOLD",
      "conviction": "HIGH|MEDIUM|LOW",
      "thesis": "2~3문장. 데이터 근거 → 종목 시사점. 인물 말투.",
      "drivers": ["이 시그널을 만든 핵심 근거를 '지표(값/변화) → 의미'로 2~4개. 예: '혼잡 +18% → 항만 적체 심화', '체류 28h(+12%) → 선석 포화로 운임 강세 지속', '공식 철광석 처리량 -8% MoM → 제철 수요 둔화'"],
      "watch": ["주시 지표/이벤트 1", "2"],
      "data_points": [{"label":"혼잡지수","current":118,"baseline":100,"unit":"","change_pct":18,"direction":"UP"}]
    }
  ]
}
반드시 3개 데스크를 모두 포함. drivers는 반드시 입력 데이터의 실제 수치/변화를 근거로 결론과 일관되게(LONG이면 강세 근거, SHORT이면 약세 근거) 작성. data_points의 current/baseline은 숫자만, direction은 UP|DOWN|STABLE.`;

let _supabase = null;
function getDb() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

// 데스크별 quant 신호를 Claude 입력용으로 압축
function quantForPrompt(d) {
  return {
    key: d.key, persona: d.persona, desk: d.desk, equities: d.equities,
    congestion: { index: d.congestion.index, change_pct: d.congestion.change_pct, z: d.congestion.z, wow: d.congestion.wow, trend: d.congestion.trend, mode: d.congestion.mode },
    inflow: { label: d.inflow.label, value: d.inflow.value, unit: d.inflow.unit, mode: d.inflow.mode },
    freight: { label: d.freight.label, current: d.freight.current, change_pct: d.freight.change_pct, mode: d.freight.mode },
    correlation: d.correlation,
    draft: d.draft,
    dwell: { avg_hours: d.dwell.avg_hours, turnover_per_day: d.dwell.turnover_per_day, trend_pct: d.dwell.trend_pct, pressure: d.dwell.pressure, mode: d.dwell.mode },
    kor_official: d.korStats ? {
      vessel_calls: d.korStats.vessel_calls, vessel_mom: d.korStats.vessel_mom,
      cargo: d.korStats.cargo, cargo_mom: d.korStats.cargo_mom, cargo_label: d.korStats.cargo_label, ym: d.korStats.latest_ym,
      // 해역밀집 — 주지표는 7일/30일 평균·wow·z (sea_density_dod=참고 노이즈)
      sea_density_ma7: d.korStats.sea_density_ma7, sea_density_ma30: d.korStats.sea_density_ma30,
      sea_density_wow: d.korStats.sea_density_wow, sea_density_z: d.korStats.sea_density_z,
      sea_density_trend: d.korStats.sea_density_trend, sea_density_date: d.korStats.sea_density_date,
      sea_density_dod: d.korStats.sea_density_dod, sea_density_top: d.korStats.sea_density_ports?.[0] ?? null,
      mode: d.korStats.mode,
    } : null,
  };
}

// 데스크별 markdown 섹션
function buildDetail(merged, headline) {
  const sigEmoji = { LONG: '🟢 LONG', SHORT: '🔴 SHORT', HOLD: '⚪ HOLD' };
  let md = `## 💼 X Capital 데스크 종합\n\n${headline}\n`;
  for (const d of merged) {
    md += `\n### ${d.persona} — ${d.desk}  ${sigEmoji[d.signal] ?? d.signal} (확신 ${d.conviction})\n`;
    md += `${d.thesis}\n\n`;
    if (d.drivers?.length) md += `**판단 근거**\n${d.drivers.map(x => `- ${x}`).join('\n')}\n\n`;
    md += `| 지표 | 값 | 비고 |\n|------|-----|------|\n`;
    md += `| 혼잡지수 | ${d.congestion.index ?? '–'} (평년100) | ${d.congestion.mode} |\n`;
    md += `| ${d.inflow.label} | ${d.inflow.value?.toLocaleString() ?? '–'} ${d.inflow.unit} | ${d.inflow.mode} |\n`;
    md += `| ${d.freight.label} | ${d.freight.current ?? '–'} ${d.freight.unit ?? ''} | ${d.freight.mode} |\n`;
    md += `| 혼잡→운임 상관 | ${d.correlation.mode === 'live' ? `r=${d.correlation.r} (lag ${d.correlation.lag}일)` : '데이터 축적 중'} | ${d.correlation.mode} |\n`;
    md += `| 평균 체류시간 | ${d.dwell.avg_hours != null ? `${d.dwell.avg_hours}h (회전 ${d.dwell.turnover_per_day}/일${d.dwell.pressure != null ? `, 압력 ${d.dwell.pressure}` : ''})` : '축적 중'} | ${d.dwell.mode} |\n`;
    if (d.korStats?.sea_density_ma7 != null) {
      const wow = d.korStats.sea_density_wow, z = d.korStats.sea_density_z;
      const extra = [
        wow != null ? `${wow > 0 ? '+' : ''}${wow}% WoW` : null,
        z != null ? `z=${z}` : null,
        d.korStats.sea_density_trend,
      ].filter(Boolean).join(', ');
      md += `| 해역밀집(7일평균) | ${Math.round(d.korStats.sea_density_ma7).toLocaleString()} AIS통항${extra ? ` (${extra})` : ''} | live |\n`;
    }
    if (d.watch?.length) md += `\n주시: ${d.watch.join(' · ')}\n`;
    md += `\n관련 종목: ${d.equities.join(', ')}\n`;
  }
  return md;
}

async function runInvestmentAnalyst() {
  console.log('[INVESTMENT_ANALYST] run at', new Date().toISOString());
  const db = getDb();

  try {
    const { desks, mode } = await buildAllDesks(db, PORTS);

    // 최근 90분 시황 보고(원자재·지정학)도 참고 자료로
    const cutoff = new Date(Date.now() - 210 * 60 * 1000).toISOString();
    const { data: recent } = await db.from('agent_reports')
      .select('agent_id, title, summary, data_points')
      .in('agent_id', ['COMMODITY_ANALYST', 'GEOPOLITICAL_LINKER'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(8);

    const result = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify({
        analysis_time: new Date().toISOString(),
        overall_mode: mode,
        desks: desks.map(quantForPrompt),
        market_reports: (recent ?? []).map(r => ({ agent: r.agent_id, title: r.title, summary: r.summary, data_points: r.data_points })),
      }),
      maxTokens: 4500, // drivers(데스크별 근거) 추가로 출력이 길어짐 — 잘림 방지 (이슈 #15)
      model: 'claude-haiku-4-5',
    });

    const narratives = Array.isArray(result.desks) ? result.desks : [];
    // 정량 데스크 + 서술 병합 (프론트 X Capital 공간이 raw_data.desks를 카드로 렌더)
    const merged = desks.map(d => {
      const n = narratives.find(x => x.key === d.key) ?? {};
      return {
        ...d,
        signal: n.signal ?? 'HOLD',
        conviction: n.conviction ?? 'LOW',
        thesis: n.thesis ?? '데이터 축적 중 — 추세 관망.',
        drivers: Array.isArray(n.drivers) ? n.drivers : [],
        watch: Array.isArray(n.watch) ? n.watch : [],
        narrative_data_points: Array.isArray(n.data_points) ? n.data_points : [],
      };
    });

    const headline = (result.headline ?? 'X Capital 데스크 시황 업데이트').slice(0, 100);
    const detail = buildDetail(merged, headline);
    // 피드 카드용 대표 data_points (데스크별 혼잡지수)
    const dataPoints = merged.map(d => ({
      label: `${d.desk} 혼잡`, current: d.congestion.index ?? 0, baseline: 100, unit: '',
      change_pct: d.congestion.change_pct ?? 0, direction: (d.congestion.change_pct ?? 0) > 0 ? 'UP' : (d.congestion.change_pct ?? 0) < 0 ? 'DOWN' : 'STABLE',
    }));

    const { error } = await db.from('agent_reports').insert({
      agent_id: 'INVESTMENT_ANALYST',
      severity: 'INFO',
      title: '[X CAPITAL] 3 데스크 투자 브리핑',
      summary: headline.slice(0, 120),
      detail,
      data_points: dataPoints,
      annotations: merged.map(d => `${d.persona}: ${d.signal} (${d.conviction})`),
      related_mmsi: [],
      location: null,
      raw_data: { source: 'xcap', mode, desks: merged },
    });
    if (error) console.error('[INVESTMENT_ANALYST] insert error:', error.message);
    else console.log('[INVESTMENT_ANALYST] report saved — mode:', mode);
  } catch (err) {
    console.error('[INVESTMENT_ANALYST] error:', err.message);
  }
}

function startInvestmentAnalyst() {
  runInvestmentAnalyst();
  return setInterval(runInvestmentAnalyst, POLL_INTERVAL_MS);
}

module.exports = { runInvestmentAnalyst, startInvestmentAnalyst };
