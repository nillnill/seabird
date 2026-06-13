// 인트로 페이지 콘텐츠 — "해운 문명의 항해"
// 이미지는 추후 image-asset/*.png → scripts/optimize_characters.py → public/characters/*.webp.
// 이미지 없을 때 emoji fallback으로 동작(IntroPage의 onError 패턴).

export const MALCOLM = {
  name: '맬컴 맥린',
  nameEn: 'MALCOLM McLEAN',
  title: '컨테이너화의 아버지 · 세계 해운을 바꾼 혁명가 (1913–2001)',
  quote: '"화물을 하나하나 다루지 마라. 상자째로 옮겨라."',
  greeting:
    '제독님, 환영하오. 나는 트럭 운전사로 시작해 바다를 바꾼 사람이오. 1956년, 화물을 ‘상자’에 담아 통째로 배에 실었소 — 그날 세계 무역의 속도가 바뀌었지. 이제 그 바다를 제독님이 지휘할 차례요. 범선에서 AI까지, 해운 문명의 항로를 함께 따라가 봅시다.',
  image: '/characters/Malcolm_McLean.webp', // optimize 스크립트가 stem 대소문자 보존
  fallbackEmoji: '🧑‍✈️',
  bgFrom: '#1B3A5B',
  bgTo: '#0C1B2E',
};

// Ch2 — 해운의 역사(기술 트리). image 없으면 emoji로 표시.
export const ERAS = [
  { key: 'sail',      year: '~1800s', title: '범선 시대',          desc: '바람에 의지한 항해. 무역은 계절풍과 해류가 정했다.',                emoji: '⛵' },
  { key: 'steam',     year: '1869',   title: '증기선 · 수에즈 운하', desc: '바람에서 해방된 증기선. 수에즈가 아시아–유럽 항로를 절반으로 줄였다.', emoji: '🚢' },
  { key: 'container', year: '1956',   title: '컨테이너 혁명',       desc: '맥린의 SS 아이디얼 X호, 규격 컨테이너 58개로 첫 항해 — 하역 비용이 수십분의 1로.', emoji: '📦', star: true },
  { key: 'global',    year: '1990s~', title: '글로벌 공급망 · 초대형선', desc: '컨테이너가 세계를 하나의 공장으로. 2만 TEU급 초대형선이 대양을 잇다.', emoji: '🌐' },
  { key: 'ais',       year: '2000s~', title: 'AIS 디지털 추적',     desc: '모든 선박이 위치를 송신. 바다가 처음으로 ‘실시간 데이터’가 되었다.',   emoji: '📡' },
  { key: 'ai',        year: 'NOW',    title: 'AI 시대 — Seabird',   desc: 'AIS 위에 AI의 눈을 얹다. 8인의 AI 자문관이 전 대양을 24시간 읽어낸다.', emoji: '🛰️', star: true },
];

// Ch3 — Seabird의 가치(해금된 능력)
export const ABILITIES = [
  { icon: '🛰️', name: '실시간 대양 감시',   desc: '전 세계 AIS 선박을 지도 위에서 실시간 추적. 수천 척의 움직임이 한눈에.' },
  { icon: '🤖', name: '8인의 AI 자문관',    desc: '항만·초크포인트·지정학·기상·원자재·종합·유입·화물을 전담하는 AI가 24시간 보고.' },
  { icon: '🛢️', name: '원자재 유입 추정',   desc: '입항 선박으로 원유·건화물·컨테이너·LNG 유입량을 추정해 공급망 흐름을 읽음.' },
  { icon: '🚦', name: '초크포인트·항만 감시', desc: '수에즈·말라카·호르무즈 등 요충지를 평년 대비로 비교, 이상 징후를 경보.' },
  { icon: '📊', name: '증감 분석 & 대시보드', desc: '전일·전주·전월·전년(DoD/WoW/MoM/YoY) 변동과 통계 대시보드로 추세 파악.' },
  { icon: '📦', name: '선박 화물 추정',      desc: '선박을 클릭하면 선종·제원 기반 적재 화물을 추정하고 항적을 그려 보여줌.' },
];

// Ch4 — 자문관의 조언(팁)
export const TIPS = [
  { icon: '🚢', text: '선박을 클릭하면 화물 추정과 지나온 항적이 펼쳐집니다.' },
  { icon: '⚓', text: '항만·초크포인트를 클릭하면 현황(평년 대비·증감)과 선박 동향(입항 유입)을 보고드립니다.' },
  { icon: '📊', text: '상단 ‘통계’ 버튼으로 선종·기국·목적지·혼잡도를 대시보드 한 장에.' },
  { icon: '🛢️', text: '우측 피드의 보고 카드(🛢️ FLOW 등)를 누르면 상세 리포트가 열립니다.' },
  { icon: '🎛️', text: '선종 필터로 컨테이너·탱커·벌크선만 골라 보면 관심 항로가 또렷해집니다.' },
  { icon: '📜', text: '언제든 상단 ‘인트로’ 버튼으로 이 항해 일지를 다시 펼칠 수 있습니다.' },
];

// 챕터 메타(스테퍼)
export const CHAPTERS = [
  { id: 0, kicker: 'CHAPTER 1', title: '지도자 등장' },
  { id: 1, kicker: 'CHAPTER 2', title: '해운의 역사' },
  { id: 2, kicker: 'CHAPTER 3', title: '해금된 능력' },
  { id: 3, kicker: 'CHAPTER 4', title: '자문관의 조언' },
];
