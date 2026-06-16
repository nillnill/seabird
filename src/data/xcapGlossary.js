// X CAPITAL 자세히 모달·차트용 한글 라벨·설명 모음.
// ※ regionData.js의 .name은 역사 인물(예: 광양→박태준)이라 항구 한글명이 없어 별도 맵을 둔다.

// 항구 id → 한글명 (xcapData DESKS의 portIds)
export const PORT_KO = {
  busan: '부산', la_lb: 'LA·롱비치', rotterdam: '로테르담',
  gwangyang: '광양', singapore: '싱가포르',
  ulsan: '울산', yeosu: '여수', pohang: '포항', dangjin: '당진',
  qingdao: '칭다오', ningbo: '닝보', shanghai: '상하이',
};

// 운임/지수 코드 → { 이름, 설명 }
export const FREIGHT_GLOSSARY = {
  KCCI: {
    name: 'KCCI · 컨테이너선운임지수',
    desc: 'KOBC(한국해양진흥공사)가 산출하는 컨테이너선 운임 종합지수. 컨테이너 해상운임의 등락을 나타내며 HMM 등 컨테이너 해운주 실적과 직결된다.',
  },
  KDCI: {
    name: 'KDCI · 건화물선운임지수',
    desc: 'KOBC 건화물(벌크) 운임 종합지수. 철광석·석탄·곡물 등 건화물 해상운임을 반영하며 벌크 해운·철강 수요의 가늠자다.',
  },
  CAPE: {
    name: 'CAPE · 케이프사이즈 일일용선료',
    desc: '최대형 건화물선(Capesize, ~18만 DWT)의 하루 용선료($/day). 철광석·석탄 대량 물동량에 민감해 원자재 사이클의 선행 지표로 본다.',
  },
  BDTI: {
    name: 'BDTI · 발틱 더티탱커 운임지수',
    desc: '원유(더티 카고)를 싣는 유조선 운임을 나타내는 Baltic Dirty Tanker Index. 원유 해상 물동량·정유 마진과 직결돼 정유·탱커주의 핵심 운임 지표다. (출처: Baltic Exchange / investing.com)',
  },
};

// 시계열 지표 메타 — 라벨·색상·축·단위키. 차트/표 공용.
// axis: 'l'(좌, 척·시간) | 'r'(우, 운임). 색상은 지표 고정(운임만 페르소나 accent 사용).
export const SERIES_META = {
  congestion: { key: 'congestion', label: '혼잡(대기선박)', color: '#60A5FA', axis: 'l', unitKey: 'congestion' },
  inbound:    { key: 'inbound',    label: '입항 선박수',    color: '#34D399', axis: 'l', unitKey: 'inbound' },
  inflow:     { key: 'inflow',     label: '유입 추정량',    color: '#A78BFA', axis: 'l', unitKey: 'inflow' },
  dwell:      { key: 'dwell',      label: '평균 체류(h)',   color: '#FB923C', axis: 'l', unitKey: 'dwell' },
  freight:    { key: 'freight',    label: '운임지수',       color: '#F59E0B', axis: 'r', unitKey: 'freight' },
  // 해양수산부 월별 공식 통계 — 월 계단선(step). AIS 사각지대(국내 철강·정유항) 보완.
  korVessel:  { key: 'korVessel',  label: '공식 입항(월)',   color: '#22D3EE', axis: 'l', unitKey: 'korVessel', step: true, official: true },
  korCargo:   { key: 'korCargo',   label: '공식 화물처리(월)', color: '#F472B6', axis: 'l', unitKey: 'korCargo', step: true, official: true },
};

// 차트 표시 순서
export const SERIES_ORDER = ['congestion', 'inbound', 'inflow', 'dwell', 'freight', 'korVessel', 'korCargo'];
