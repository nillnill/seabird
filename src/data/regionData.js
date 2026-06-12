// 15개 지역 (초크포인트 7 + 항만 8) 캐릭터 · 통계 · 역사 데이터

export const REGION_DATA = {
  // ── 초크포인트 ──────────────────────────────────────────────────────────────

  suez: {
    type: 'chokepoint',
    character: {
      name: '가말 압델 나세르',
      nameEn: 'Gamal Abdel Nasser',
      title: '이집트 제2대 대통령 · 수에즈 국유화 1956',
      flagEmoji: '🇪🇬',
      symbolEmoji: '🦅',
      quote: '"수에즈 운하는 이집트인의 것이다. 우리가 피로 건설했고, 우리가 지킬 것이다."',
      bgFrom: '#2D1A02',
      bgTo: '#713F12',
      image: '/characters/region_suez.webp',
    },
    stats: {
      worldRank: '세계 1위 전략 운하',
      dailyShips: '약 50척',
      annualShips: '연간 19,000척',
      tradeShare: '세계 무역량 약 13%',
      topCargoes: ['원유 · LNG', '컨테이너', '곡물'],
      keyUsers: ['중국 🇨🇳', '인도 🇮🇳', '사우디 🇸🇦', '한국 🇰🇷'],
    },
    history: `**1869년 11월 17일** 개통된 수에즈 운하는 지중해와 홍해를 연결하는 193km의 세계 최중요 해상 동맥입니다.

프랑스 외교관 레셉스가 이집트 케디브의 지원으로 10년 공사 끝에 완성, 유럽↔아시아 항로를 **약 7,000km 단축**시켰습니다.

- **1956년** 나세르 국유화 → 수에즈 위기
- **1967~1975년** 6일 전쟁으로 8년간 폐쇄
- **2021년** 에버기버 좌초 → 6일 봉쇄, 피해 $96억
- **2023~24년** 후티 공격 → 통항량 40% 감소, 운임 3배 급등`,
    newsQuery: 'Suez Canal shipping disruption latest 2024',
  },

  malacca: {
    type: 'chokepoint',
    character: {
      name: '항 투아',
      nameEn: 'Hang Tuah',
      title: '말라카 전설의 제독 · 15세기',
      flagEmoji: '🇲🇾',
      symbolEmoji: '🗡️',
      quote: '"항 투아는 죽지 않는다. 말라카가 살아있는 한."',
      bgFrom: '#052E16',
      bgTo: '#166534',
      image: '/characters/region_malacca.webp',
    },
    stats: {
      worldRank: '세계 최다 통항 해협',
      dailyShips: '약 300척',
      annualShips: '연간 약 10만척',
      tradeShare: '세계 해상 무역의 25%',
      topCargoes: ['원유', '컨테이너', '가스', '팜유'],
      keyUsers: ['중국 🇨🇳', '일본 🇯🇵', '한국 🇰🇷', '인도 🇮🇳'],
    },
    history: `말라카 해협은 말레이반도와 수마트라 섬 사이 800km의 해협으로, **인도양↔태평양**을 연결하는 가장 통항량이 많은 해협입니다. 가장 좁은 곳은 불과 **2.7km**.

전설의 제독 항 투아는 15세기 말라카 술탄국의 수호자로 숭앙받는 해양 영웅입니다.

- **1511년** 포르투갈 알부케르크의 말라카 정복
- **1641년** 네덜란드 동인도회사 장악
- **1990년대** 소말리아식 해적 성행 → IMO 특별 해역 지정
- **현재** 싱가포르·인도네시아·말레이시아 3국 공동 해역 경비`,
    newsQuery: 'Malacca Strait shipping maritime security news 2024',
  },

  hormuz: {
    type: 'chokepoint',
    character: {
      name: '다리우스 대왕',
      nameEn: 'Darius the Great',
      title: '페르시아 아케메네스 제국 3대 왕 · 기원전 550~486',
      flagEmoji: '🇮🇷',
      symbolEmoji: '👑',
      quote: '"페르시아만은 제국의 혈맥이다. 이 바다를 지배하는 자가 동서를 지배한다."',
      bgFrom: '#3B0000',
      bgTo: '#7F1D1D',
      image: '/characters/region_hormuz.webp',
    },
    stats: {
      worldRank: '원유 수송 세계 1위 해협',
      dailyShips: '유조선 약 20척/일',
      annualShips: '연간 약 2만척',
      tradeShare: '세계 원유 20%, LNG 30%',
      topCargoes: ['원유', 'LNG', '석유화학제품'],
      keyUsers: ['중국 🇨🇳', '일본 🇯🇵', '한국 🇰🇷', '인도 🇮🇳'],
    },
    history: `호르무즈 해협은 이란과 오만 사이 38km의 최협부를 가진 페르시아만 유일의 출구입니다. **한국 원유 수입의 약 70%**가 이 해협을 경유합니다.

- **1515년** 포르투갈 알부케르크 호르무즈 왕국 정복
- **1980~88년** 이란-이라크 전쟁 중 "유조선 전쟁"
- **2019년** 이란의 영국 유조선 나포
- **2023~24년** 이란-이스라엘 갈등 고조 → 봉쇄 위협 반복`,
    newsQuery: 'Strait of Hormuz Iran oil tanker shipping news 2024',
  },

  panama: {
    type: 'chokepoint',
    character: {
      name: '오마르 토리호스',
      nameEn: 'Omar Torrijos',
      title: '파나마 최고지도자 · 운하 반환 협상가 1968~1981',
      flagEmoji: '🇵🇦',
      symbolEmoji: '🌿',
      quote: '"파나마 운하는 파나마인의 것이다. 나는 그것을 되찾을 것이다."',
      bgFrom: '#0F172A',
      bgTo: '#1E3A5F',
      image: '/characters/region_panama.webp',
    },
    stats: {
      worldRank: '세계 2위 전략 운하',
      dailyShips: '약 36척',
      annualShips: '연간 약 14,000척',
      tradeShare: '세계 해상 무역의 약 5%',
      topCargoes: ['컨테이너', '곡물', '자동차', 'LNG'],
      keyUsers: ['미국 🇺🇸', '중국 🇨🇳', '일본 🇯🇵', '한국 🇰🇷'],
    },
    history: `파나마 운하는 1914년 개통된 82km의 인공 수로로, **대서양↔태평양**을 연결해 케이프 혼 대비 약 15,000km를 단축합니다.

프랑스의 실패(1881~1889년, 말라리아·공사 난이도) 이후 루스벨트 대통령이 파나마 독립을 지원하고 건설을 완수했습니다.

- **1977년** 카터-토리호스 조약 → 파나마 반환 결정
- **1999년** 파나마에 완전 이양
- **2016년** 네오파나막스 갑문 확장 개통
- **2023~24년** 가뭄으로 수위 저하 → 통항 35% 감소, 적체 발생`,
    newsQuery: 'Panama Canal drought water level shipping disruption 2024',
  },

  dover: {
    type: 'chokepoint',
    character: {
      name: '호레이쇼 넬슨 제독',
      nameEn: 'Admiral Horatio Nelson',
      title: '영국 해군 원수 · 트라팔가르 해전 영웅 1805',
      flagEmoji: '🇬🇧',
      symbolEmoji: '⚓',
      quote: '"영국은 모든 장병이 각자의 임무를 다할 것을 기대한다."',
      bgFrom: '#111827',
      bgTo: '#374151',
      image: '/characters/region_dover.webp',
    },
    stats: {
      worldRank: '세계 최다 연간 통항 해협',
      dailyShips: '약 500척',
      annualShips: '연간 12만척+',
      tradeShare: 'EU-영국 해상 무역 핵심 동맥',
      topCargoes: ['컨테이너', '자동차 RoRo', '여객', '화학'],
      keyUsers: ['영국 🇬🇧', '네덜란드 🇳🇱', '독일 🇩🇪', '프랑스 🇫🇷'],
    },
    history: `영불해협은 영국과 프랑스 사이 최협부 33km의 해협으로, **연간 12만척 이상**이 통항하는 세계 최대 교통량 해협입니다.

기원전 55년 카이사르의 브리타니아 원정 이후 유럽 역사의 무대가 되었습니다.

- **1066년** 노르만 정복왕 윌리엄의 도하로 영국 정복
- **1805년** 트라팔가르 해전 (넬슨 제독의 나폴레옹 함대 격파)
- **1944년** D-Day 노르망디 상륙작전
- **1994년** 유로터널(채널 터널) 개통
- **2020년** 브렉시트로 영-EU 통관 복잡성 급증`,
    newsQuery: 'English Channel Dover shipping maritime traffic news 2024',
  },

  korea_strait: {
    type: 'chokepoint',
    character: {
      name: '이순신',
      nameEn: 'Yi Sun-sin',
      title: '조선 삼도수군통제사 · 1545~1598',
      flagEmoji: '🇰🇷',
      symbolEmoji: '🐢',
      quote: '"죽고자 하면 살고, 살고자 하면 죽는다."',
      bgFrom: '#2D0A0A',
      bgTo: '#881337',
      image: '/characters/region_korea_strait.webp',
    },
    stats: {
      worldRank: '동북아 핵심 통항로',
      dailyShips: '약 200척',
      annualShips: '연간 약 7만척',
      tradeShare: '동북아 컨테이너 무역 요충',
      topCargoes: ['컨테이너', '자동차', '철강', '화학'],
      keyUsers: ['한국 🇰🇷', '일본 🇯🇵', '중국 🇨🇳', '러시아 🇷🇺'],
    },
    history: `대한해협은 한반도와 일본 규슈 사이 폭 180~220km의 해협으로, **동해↔황해**를 연결하는 동북아시아 전략 관문입니다.

1592년 임진왜란에서 이순신 장군이 거북선을 이용, 한산도·명량 해전에서 일본 수군을 격파하여 조선을 구했습니다.

- **1592년** 한산도 해전 — 학익진 전법으로 대승
- **1905년** 쓰시마 해전 — 러시아 발틱 함대 궤멸
- **현재** 부산항 발착 컨테이너의 주요 통로
- 독도/다케시마 영유권 분쟁으로 한일 긴장 지속`,
    newsQuery: 'Korea Strait Busan shipping maritime trade news 2024',
  },

  bab_el_mandeb: {
    type: 'chokepoint',
    character: {
      name: '시바의 여왕',
      nameEn: 'Queen of Sheba',
      title: '예멘·에티오피아의 전설적 여왕 · 기원전 10세기',
      flagEmoji: '🇾🇪',
      symbolEmoji: '👸',
      quote: '"두 바다가 만나는 이 관문을 지배하는 자는 세상의 절반을 손에 쥔 것이다."',
      bgFrom: '#042F2E',
      bgTo: '#134E4A',
      image: '/characters/region_bab_el_mandeb.webp',
    },
    stats: {
      worldRank: '홍해-아덴만 유일 관문',
      dailyShips: '약 50척',
      annualShips: '연간 약 2만척',
      tradeShare: '세계 원유·상품 무역 10%',
      topCargoes: ['원유', 'LNG', '컨테이너', '곡물'],
      keyUsers: ['중국 🇨🇳', '유럽 🇪🇺', '한국 🇰🇷', '인도 🇮🇳'],
    },
    history: `바브엘만데브("눈물의 문")는 예멘과 지부티·에리트레아 사이 26km 해협으로, **수에즈 운하 루트의 남쪽 관문**입니다.

통과 불가 시 케이프 오브 굿호프 우회(+14일, +$200만 연료비)가 필요합니다.

- **2008년~** 소말리아 해적 주요 활동 해역
- **2023년 10월~** 후티 반군의 이스라엘 관련 선박 공격 개시
- **2024년** 머스크·MSC·CMA CGM 등 주요 해운사 홍해 우회 발표
- **한국 영향**: 유럽 향 컨테이너 운임 **3배 급등**, 납기 2~3주 지연`,
    newsQuery: 'Bab el-Mandeb Red Sea Houthi shipping attack news 2024',
  },

  // ── 항만 ────────────────────────────────────────────────────────────────────

  busan: {
    type: 'port',
    character: {
      name: '장보고',
      nameEn: 'Jang Bogo',
      title: '신라 해상왕 · 9세기 동아시아 무역 제패',
      flagEmoji: '🇰🇷',
      symbolEmoji: '⛵',
      quote: '"바다를 지배하는 자가 무역을 지배한다."',
      bgFrom: '#0C1A3D',
      bgTo: '#1E3A8A',
      image: '/characters/region_busan.webp',
    },
    stats: {
      worldRank: '세계 7위 컨테이너항',
      annualTeu: '연간 약 2,200만 TEU',
      berths: '선석 396개, 안벽 46km',
      tradeShare: '한국 수출입의 약 75%',
      topCargoes: ['컨테이너', '자동차', '철강', '석유화학'],
      keyUsers: ['중국 🇨🇳', '일본 🇯🇵', '미국 🇺🇸', '유럽 🇪🇺'],
    },
    history: `부산항은 한반도 남동단의 한국 최대 무역항으로, **동북아 물류 허브**입니다.

9세기 장보고 대사가 청해진을 설치하고 당(唐)·일(日)을 잇는 삼각무역을 제패하여 "해상왕"으로 불렸습니다.

- **1876년** 강화도 조약으로 최초 개항
- **1950년** 한국전쟁 미군 보급 기지 · 최대 피란항
- **1978년** 컨테이너 전용 부두 개장
- **2006년** 신항(북컨터미널) 개장
- **2023년** 물동량 2,200만 TEU 달성`,
    newsQuery: 'Busan Port container shipping Korea trade 2024',
  },

  incheon: {
    type: 'port',
    character: {
      name: '강감찬',
      nameEn: 'Gang Gam-chan',
      title: '고려 명장 · 귀주대첩으로 거란 격퇴 1019',
      flagEmoji: '🇰🇷',
      symbolEmoji: '⚔️',
      quote: '"나라를 지키는 것은 군사의 수가 아니라 불굴의 의지다."',
      bgFrom: '#052E16',
      bgTo: '#166534',
      image: '/characters/region_incheon.webp',
    },
    stats: {
      worldRank: '한국 제2항만',
      annualTeu: '연간 약 330만 TEU',
      berths: '안벽 12.4km',
      tradeShare: '수도권(서울) 물류 관문',
      topCargoes: ['컨테이너', '자동차', '냉장화물', '잡화'],
      keyUsers: ['중국 🇨🇳', '일본 🇯🇵', '미국 🇺🇸', '동남아 🌏'],
    },
    history: `인천항은 한반도 서해안 최대 항구로, 수도 서울에서 약 30km 떨어진 **수도권의 해상 관문**입니다.

1950년 9월 15일, 맥아더 장군의 인천상륙작전(Operation Chromite)은 2만 5천 해병대를 상륙시켜 한국전쟁의 전세를 역전시킨 역사적 작전입니다.

- **1882년** 한미수호통상조약 후 최초 개항
- **1950년 9.15** 인천상륙작전 — 서울 탈환의 발판
- **2001년** 인천국제공항 개항 → 복합 물류 허브화
- **2020년~** 제2신항 확장 공사 진행 중`,
    newsQuery: 'Incheon Port Korea shipping logistics news 2024',
  },

  gwangyang: {
    type: 'port',
    character: {
      name: '박태준',
      nameEn: 'Park Tae-joon',
      title: '포스코 설립자 · 한국 철강산업의 아버지',
      flagEmoji: '🇰🇷',
      symbolEmoji: '🏭',
      quote: '"철은 국가의 쌀이다."',
      bgFrom: '#2D1000',
      bgTo: '#7C2D12',
      image: '/characters/region_gwangyang.webp',
    },
    stats: {
      worldRank: '한국 제3항만',
      annualTeu: '연간 약 250만 TEU',
      berths: '안벽 10.1km',
      tradeShare: '한국 철강 수출 핵심 거점',
      topCargoes: ['철강', '자동차', '석유화학', '컨테이너'],
      keyUsers: ['중국 🇨🇳', '일본 🇯🇵', '미국 🇺🇸', '인도 🇮🇳'],
    },
    history: `광양항은 전라남도 광양시에 위치한 **한국 최대 철강 수출항**으로, 포스코 광양제철소의 전용 부두와 함께 발전했습니다.

박태준 초대 포스코 회장은 박정희 대통령의 지원 아래 "철은 국가의 쌀"이라는 신념으로 1968년 포스코를 설립, 한국을 철강 강국으로 이끌었습니다.

- **1987년** 포스코 광양제철소 1기 고로 화입
- **1997년** 컨테이너 전용 부두 개장
- **2001년** 광양만 경제자유구역(GFEZ) 지정
- **현재** 국내 최대 자동차 수출 전용 부두 운영`,
    newsQuery: 'Gwangyang Port POSCO steel Korea trade 2024',
  },

  singapore: {
    type: 'port',
    character: {
      name: '리콴유',
      nameEn: 'Lee Kuan Yew',
      title: '싱가포르 초대 총리 · 건국의 아버지 1959~1990',
      flagEmoji: '🇸🇬',
      symbolEmoji: '🦁',
      quote: '"작은 나라가 생존하려면 세계 최고의 항구가 되어야 한다."',
      bgFrom: '#3B0000',
      bgTo: '#9F1239',
      image: '/characters/region_singapore.webp',
    },
    stats: {
      worldRank: '세계 2위 컨테이너항',
      annualTeu: '연간 약 3,700만 TEU',
      berths: '선석 600+, 안벽 38km',
      tradeShare: '세계 최대 벙커링(선박 연료) 기지',
      topCargoes: ['컨테이너', '원유', 'LNG', '석유화학'],
      keyUsers: ['중국 🇨🇳', '말레이시아 🇲🇾', '미국 🇺🇸', '한국 🇰🇷'],
    },
    history: `싱가포르항은 **1819년 래플스 경**이 개항한 이래 200년 넘게 아시아 최대 환적 허브로 성장했습니다. 말라카 해협 입구의 전략적 위치가 핵심입니다.

세계 최대 벙커링 기지로, 연간 약 5,000만 톤의 선박 연료를 공급합니다.

- **1819년** 래플스 경 싱가포르 개항 (영국 동인도회사)
- **1965년** 말레이시아 독립 → 항만 국가 전략 채택
- **2022년** 세계 2위 (상하이에 이어) 유지
- **탄종파가 신항(Tuas)**: 2040년 완공 시 세계 1위 목표`,
    newsQuery: 'Singapore Port shipping container throughput 2024',
  },

  shanghai: {
    type: 'port',
    character: {
      name: '정화',
      nameEn: 'Zheng He',
      title: '명나라 대항해사 · 1405~1433년 7차 대원정',
      flagEmoji: '🇨🇳',
      symbolEmoji: '🧭',
      quote: '"동서를 잇는 거대한 함대가 천하에 중국의 힘을 알린다."',
      bgFrom: '#422006',
      bgTo: '#92400E',
      image: '/characters/region_shanghai.webp',
    },
    stats: {
      worldRank: '세계 1위 컨테이너항 (2010~)',
      annualTeu: '연간 약 4,700만 TEU',
      berths: '양산 심수항 포함 선석 150+',
      tradeShare: '중국 전체 무역의 약 20%',
      topCargoes: ['컨테이너', '자동차', '전자제품', '기계'],
      keyUsers: ['미국 🇺🇸', '일본 🇯🇵', '한국 🇰🇷', '유럽 🇪🇺'],
    },
    history: `상하이항은 **1843년 개항** 이래 중국 최대 무역항으로 성장하여 2010년부터 세계 1위를 유지하고 있습니다.

명나라 정화 제독은 1405~1433년 7차례 대항해로 동남아·인도·아프리카까지 항해하며 중화 문명을 전파했습니다.

- **1843년** 남경조약으로 개방
- **1978년** 개혁개방 → 항만 급성장
- **2005년** 양산 심수항 개장 (인공섬 위 세계 최대)
- **2022년** 상하이 봉쇄(코로나) → 세계 공급망 혼란
- **2023년** 4,750만 TEU 달성, 세계 1위 지속`,
    newsQuery: 'Shanghai Port container China trade shipping 2024',
  },

  rotterdam: {
    type: 'port',
    character: {
      name: '에라스무스',
      nameEn: 'Desiderius Erasmus',
      title: '로테르담 출신 인문학자 · 1469~1536',
      flagEmoji: '🇳🇱',
      symbolEmoji: '⚖️',
      quote: '"지식과 무역이 만나는 곳에 문명이 피어난다."',
      bgFrom: '#3D1A00',
      bgTo: '#B45309',
      image: '/characters/region_rotterdam.webp',
    },
    stats: {
      worldRank: '유럽 최대항, 세계 11위',
      annualTeu: '연간 약 1,500만 TEU',
      berths: '마스블라크테 포함 안벽 약 40km',
      tradeShare: 'EU 수입의 약 40% 처리',
      topCargoes: ['원유', '컨테이너', '화학품', 'LNG'],
      keyUsers: ['중국 🇨🇳', '독일 🇩🇪', '영국 🇬🇧', '미국 🇺🇸'],
    },
    history: `로테르담항은 **유럽의 관문**으로, 라인강을 통해 독일·스위스·프랑스 내륙까지 화물을 운반하는 유럽 최대 항만입니다.

에라스무스의 고향 로테르담은 14세기부터 해운 도시로 발전, 네덜란드 황금시대(17세기)에 세계 최대 무역 도시가 되었습니다.

- **1940년** 2차 세계대전 독일 폭격으로 도심 파괴
- **1960년대** 유럽 최대 항만으로 성장
- **2013년** 마스블라크테 2 신항 개장 → 최대 컨테이너선 수용
- **2022~23년** 러시아 가스 대체 → LNG 터미널 처리량 급증`,
    newsQuery: 'Rotterdam Port Europe shipping container energy LNG 2024',
  },

  la_lb: {
    type: 'port',
    character: {
      name: '매슈 페리 제독',
      nameEn: 'Commodore Matthew Perry',
      title: '미 해군 제독 · 태평양 무역로 개척 1853',
      flagEmoji: '🇺🇸',
      symbolEmoji: '🚢',
      quote: '"태평양은 미국의 내해가 될 것이다. 우리는 그 무역을 지배해야 한다."',
      bgFrom: '#0C1A3D',
      bgTo: '#1D4ED8',
      image: '/characters/region_la_lb.webp',
    },
    stats: {
      worldRank: '미국 최대 항만 복합체',
      annualTeu: '연간 약 1,700만 TEU (합산)',
      berths: '두 항만 선석 300+',
      tradeShare: '미국 아시아 수입품의 약 40%',
      topCargoes: ['컨테이너', '자동차', '가전', '의류'],
      keyUsers: ['중국 🇨🇳', '일본 🇯🇵', '한국 🇰🇷', '대만 🇹🇼'],
    },
    history: `LA/LB(로스앤젤레스·롱비치) 항만 복합체는 **미국 최대, 세계 9위** 컨테이너 항만으로, 아시아-미국 태평양 무역의 핵심 관문입니다.

1542년 스페인 탐험가 카브리요가 이 해안에 도착하면서 캘리포니아의 역사가 시작되었습니다.

- **2021년** 코로나 물류 대란 — 100척 이상 앙커리지 대기, 6개월 적체
- 미중 무역 전쟁(2018~) → 일부 물량 동부 항만으로 전환
- **2023년** 항만 자동화 투자 확대 (AGV, 자동크레인)
- 캘리포니아 탄소규제로 전기 트럭 전환 가속`,
    newsQuery: 'Los Angeles Long Beach Port shipping container US trade 2024',
  },

  dubai: {
    type: 'port',
    character: {
      name: '라시드 빈 사이드',
      nameEn: 'Sheikh Rashid bin Saeed Al Maktoum',
      title: '두바이 근대화의 아버지 · 재위 1958~1990',
      flagEmoji: '🇦🇪',
      symbolEmoji: '🌙',
      quote: '"아버지는 낙타를, 나는 랜드로버를. 내 아들은 비행기를, 손자는 다시 낙타를 탈 것이다."',
      bgFrom: '#3D2900',
      bgTo: '#B45309',
      image: '/characters/region_dubai.webp',
    },
    stats: {
      worldRank: '세계 9위 컨테이너항',
      annualTeu: '연간 약 1,400만 TEU',
      berths: '제벨알리 자유무역지대 포함',
      tradeShare: '중동 최대 환적 허브',
      topCargoes: ['컨테이너', '원유', '가전', '명품·소비재'],
      keyUsers: ['인도 🇮🇳', '중국 🇨🇳', '사우디 🇸🇦', '미국 🇺🇸'],
    },
    history: `두바이 제벨알리항은 **1979년 개항**한 세계 최대 인공항만으로, 두바이를 중동 물류 허브로 변모시켰습니다.

라시드 국왕의 선견지명으로 건설된 제벨알리 자유무역지대(JAFZA)에는 포춘 500대 기업 100여 곳이 입주해 있습니다.

- **1979년** 제벨알리항 개항 (당시 세계 최대 인공항)
- **2003년** DP World 설립 → 전 세계 항만 운영사로 성장
- **2021년** 수에즈 에버기버 좌초 수혜 — 우회 물량 급증
- **현재** 인도-중동-유럽 물류 코리더(IMEC) 핵심 거점`,
    newsQuery: 'Dubai Jebel Ali Port DP World shipping Middle East 2024',
  },

  // ── 신규 항만 (10개 추가) ────────────────────────────────────────────────────

  yokohama: {
    type: 'port',
    character: {
      name: '사카모토 료마',
      nameEn: 'Sakamoto Ryoma',
      title: '막말 지사 · 일본 개국·근대화 선구자 1836~1867',
      flagEmoji: '🇯🇵',
      symbolEmoji: '⚔️',
      quote: '"일본을 바꾸고 싶다면, 먼저 바다로 나가라."',
      bgFrom: '#1A1A2E',
      bgTo: '#16213E',
      image: '/characters/region_yokohama.webp',
    },
    stats: {
      worldRank: '세계 34위 컨테이너항',
      annualTeu: '연간 약 270만 TEU',
      berths: '선석 190개, 안벽 25km',
      tradeShare: '일본 수출입의 약 12%',
      topCargoes: ['자동차', '기계류', '전자제품', '화학품'],
      keyUsers: ['중국 🇨🇳', '한국 🇰🇷', '미국 🇺🇸', '독일 🇩🇪'],
    },
    history: `요코하마항은 1859년 개항한 **일본의 첫 국제 무역항**으로, 에도 막부 말기 일본이 서양 문물을 받아들인 창구입니다.

사카모토 료마는 도사번 출신 지사로 해운회사(카이엔타이)를 설립, 일본 최초의 상사를 만들고 개국·근대화를 추진했습니다.

- **1859년** 미일 수호통상조약으로 개항
- **1923년** 관동대지진으로 壊滅, 재건
- **1945년** 미군 점령 → 일본 경제 부흥 기지
- **현재** 도쿄항과 함께 게이힌(京浜) 항만권 형성, 일본 최대 무역항 복합체`,
    newsQuery: 'Yokohama port Japan shipping trade automotive 2024',
  },

  kobe: {
    type: 'port',
    character: {
      name: '타이라노 키요모리',
      nameEn: 'Taira no Kiyomori',
      title: '헤이안 말기 무장 · 효고 항구 개발자 1118~1181',
      flagEmoji: '🇯🇵',
      symbolEmoji: '🏯',
      quote: '"항구를 지배하는 자가 천하의 부를 지배한다."',
      bgFrom: '#2D1B1B',
      bgTo: '#4A1515',
      image: '/characters/region_kobe.webp',
    },
    stats: {
      worldRank: '세계 약 55위 컨테이너항',
      annualTeu: '연간 약 220만 TEU',
      berths: '선석 240개',
      tradeShare: '일본 제조업 수출 핵심 거점',
      topCargoes: ['자동차', '고무', '기계류', '컨테이너'],
      keyUsers: ['중국 🇨🇳', '미국 🇺🇸', '한국 🇰🇷', '유럽 🇪🇺'],
    },
    history: `고베항(옛 효고항)은 **1868년 개항**한 일본 서부 최대 무역항으로, 간사이 경제권의 해상 관문입니다.

12세기 타이라노 키요모리는 효고 항구(현 고베)를 일본-송(宋) 무역의 거점으로 정비한 최초의 인물로 평가받습니다.

- **1868년** 개항 → 외국인 거류지(기타노이진칸) 형성
- **1995년** 한신·아와지 대지진 — 항만 시설 대파, 급속 재건
- **2000년대** 상하이·부산에 환적 물량 상실 → 특화 전략 전환
- **현재** 의료기기·식품·패션 수출 특화 고부가가치 항만`,
    newsQuery: 'Kobe port Japan shipping cargo trade Kansai 2024',
  },

  ningbo: {
    type: 'port',
    character: {
      name: '왕직',
      nameEn: 'Wang Zhi',
      title: '명나라 해상 무역상 · 동아시아 밀무역의 왕 ?~1559',
      flagEmoji: '🇨🇳',
      symbolEmoji: '⛵',
      quote: '"바다에는 국경이 없다. 오직 바람과 이익만 있을 뿐이다."',
      bgFrom: '#0D1B2A',
      bgTo: '#1B3A4B',
      image: '/characters/region_ningbo.webp',
    },
    stats: {
      worldRank: '세계 3위 컨테이너항',
      annualTeu: '연간 약 3,500만 TEU',
      berths: '주산 섬 포함 선석 600+',
      tradeShare: '중국 수출입 약 15%',
      topCargoes: ['컨테이너', '철광석', '원유', '화학품'],
      keyUsers: ['미국 🇺🇸', '한국 🇰🇷', '일본 🇯🇵', '유럽 🇪🇺'],
    },
    history: `닝보·주산항은 **세계 화물 톤수 기준 1위** 항만으로, 닝보 시와 주산 군도에 걸쳐 있는 중국 최대 원자재 수입·제조업 수출 거점입니다.

명나라 닝보 출신 왕직은 일본 규슈를 기지로 동아시아 밀무역 네트워크를 장악, "5봉두목"으로 불리며 사실상 동아시아 해상 무역을 지배했습니다.

- **7세기 당나라** 시대부터 일본·신라와의 무역 거점
- **2005년** 컨테이너 처리량 세계 3위 진입
- **2021년 8월** 메이산 터미널 봉쇄(코로나) → 글로벌 공급망 혼란
- **현재** 세계 최대 광석 수입항, 연간 철광석 약 3억 톤 처리`,
    newsQuery: 'Ningbo Zhoushan port China shipping container iron ore 2024',
  },

  shenzhen: {
    type: 'port',
    character: {
      name: '덩샤오핑',
      nameEn: 'Deng Xiaoping',
      title: '중국 최고 지도자 · 개혁개방·선전 경제특구 창설 1904~1997',
      flagEmoji: '🇨🇳',
      symbolEmoji: '💼',
      quote: '"먼저 일부가 부유해지게 하라. 그러면 나머지도 따라올 것이다."',
      bgFrom: '#0A1628',
      bgTo: '#0E2D4F',
      image: '/characters/region_shenzhen.webp',
    },
    stats: {
      worldRank: '세계 4위 컨테이너항',
      annualTeu: '연간 약 3,200만 TEU',
      berths: '옌톈·치완·서쿠 터미널 포함',
      tradeShare: '중국 전자·제조업 수출 핵심',
      topCargoes: ['컨테이너', '전자제품', '의류', '장난감'],
      keyUsers: ['미국 🇺🇸', '유럽 🇪🇺', '한국 🇰🇷', '일본 🇯🇵'],
    },
    history: `선전항은 **1980년 경제특구 지정** 이후 어촌에서 세계 4위 컨테이너항으로 성장한 "기적의 항만"입니다.

덩샤오핑이 1980년 선전을 중국 첫 경제특구로 지정하면서 항만과 제조업이 함께 폭발적으로 성장했습니다.

- **1980년** 선전 경제특구 지정
- **1990년대** 홍콩 반환 대비 물류 인프라 급확장
- **2004년** 세계 4위 진입
- **현재** 미중 무역분쟁·탈중국 공급망 재편의 최전선`,
    newsQuery: 'Shenzhen Yantian port China manufacturing trade supply chain 2024',
  },

  hongkong: {
    type: 'port',
    character: {
      name: '린쩌쉬',
      nameEn: 'Lin Zexu',
      title: '청나라 흠차대신 · 아편전쟁 저항의 영웅 1785~1850',
      flagEmoji: '🇨🇳',
      symbolEmoji: '⚖️',
      quote: '"불의한 교역은 일시적 이익을 주지만, 결국 천하를 병들게 한다."',
      bgFrom: '#1A0A0A',
      bgTo: '#3B1515',
      image: '/characters/region_hongkong.webp',
    },
    stats: {
      worldRank: '세계 8위 컨테이너항',
      annualTeu: '연간 약 1,600만 TEU',
      berths: '콰이청 터미널 선석 24개',
      tradeShare: '중국 본토 환적 허브',
      topCargoes: ['컨테이너', '전자제품', '금융화물', '귀금속'],
      keyUsers: ['중국 🇨🇳', '미국 🇺🇸', '유럽 🇪🇺', '동남아 🌏'],
    },
    history: `홍콩항은 **1842년 난징 조약** 이후 영국령으로 개발된 아시아 최대 자유항으로, 중국 본토와 세계를 잇는 금융·물류 허브입니다.

린쩌쉬는 1839년 광저우에서 영국 아편 2만 상자를 소각하며 저항했으나, 아편전쟁 패배 후 홍콩이 영국에 양도되는 결과를 낳았습니다.

- **1842년** 난징 조약 → 영국령 홍콩 탄생
- **1997년** 중국 반환 — "일국양제" 체제
- **2020년** 국가보안법 시행 → 자유항 지위 논란
- **현재** 상하이·선전에 밀려 순위 하락세, 금융 중심 역할 유지`,
    newsQuery: 'Hong Kong port shipping container trade finance 2024',
  },

  vladivostok: {
    type: 'port',
    character: {
      name: '무라비요프-아무르스키',
      nameEn: 'Nikolai Muravyov-Amursky',
      title: '러시아 동시베리아 총독 · 블라디보스토크 창건 1809~1881',
      flagEmoji: '🇷🇺',
      symbolEmoji: '🐻',
      quote: '"태평양은 러시아의 미래다. 우리는 이 항구를 세계의 동방 수도로 만들 것이다."',
      bgFrom: '#0D1117',
      bgTo: '#1A2744',
      image: '/characters/region_vladivostok.webp',
    },
    stats: {
      worldRank: '러시아 태평양 최대항',
      annualTeu: '연간 약 100만 TEU',
      berths: '선석 80+',
      tradeShare: '러시아 극동 수출입 60%+',
      topCargoes: ['석탄', '목재', '수산물', '컨테이너'],
      keyUsers: ['중국 🇨🇳', '한국 🇰🇷', '일본 🇯🇵', '러시아 내륙 🇷🇺'],
    },
    history: `블라디보스토크("동방을 지배하라")는 **1860년 베이징 조약**으로 러시아가 청나라로부터 획득한 연해주에 건설된 러시아 태평양 함대의 모항입니다.

총독 무라비요프-아무르스키가 아무르강 유역을 러시아 영토로 편입하고 이 부동항을 개발했습니다.

- **1860년** 러시아 해군 초소 설치
- **1916년** 시베리아 횡단철도(TSR) 연결
- **1991년** 소련 붕괴 후 자유항 지정
- **2022년~** 우크라이나 제재로 동방 전환(Pivot East) 가속, 한국·중국과 교역 증가`,
    newsQuery: 'Vladivostok port Russia Pacific trade sanctions 2024',
  },

  portklang: {
    type: 'port',
    character: {
      name: '파라메스와라',
      nameEn: 'Parameswara',
      title: '말라카 술탄국 창건자 · 동남아 무역 제국 1344~1414',
      flagEmoji: '🇲🇾',
      symbolEmoji: '👑',
      quote: '"교역의 왕국은 칼이 아닌 바다 위에 세워진다."',
      bgFrom: '#0D2818',
      bgTo: '#1A4A2A',
      image: '/characters/region_portklang.webp',
    },
    stats: {
      worldRank: '세계 12위 컨테이너항',
      annualTeu: '연간 약 1,300만 TEU',
      berths: '웨스트포트·노스포트 합산',
      tradeShare: '말레이시아 무역의 약 60%',
      topCargoes: ['컨테이너', '팜유', '고무', '전자제품'],
      keyUsers: ['중국 🇨🇳', '싱가포르 🇸🇬', '한국 🇰🇷', '인도 🇮🇳'],
    },
    history: `포트클랑은 말라카 해협 입구에 위치한 **말레이시아 최대 항만**으로, 14~15세기 번성한 말라카 술탄국의 후신입니다.

수마트라 왕자 파라메스와라가 1400년경 말라카를 세우고 향신료 무역의 황금 왕국을 건설했으며, 이 지역은 현재도 세계 최대 교통량 해협의 핵심 거점입니다.

- **1400년경** 말라카 술탄국 건국 — 아시아 최대 무역 왕국
- **1511년** 포르투갈 정복 → 식민 무역 시대
- **1971년** 포트클랑 현대 컨테이너 터미널 개장
- **현재** 싱가포르와 말라카 해협 패권 경쟁 중`,
    newsQuery: 'Port Klang Malaysia ASEAN shipping container trade 2024',
  },

  mumbai: {
    type: 'port',
    character: {
      name: '시바지 마하라지',
      nameEn: 'Chhatrapati Shivaji Maharaj',
      title: '마라타 제국 창건자 · 인도 최초 근대 해군 건설 1630~1680',
      flagEmoji: '🇮🇳',
      symbolEmoji: '🏰',
      quote: '"해군 없이는 독립도 없다. 바다를 지배하는 자가 인도를 지배한다."',
      bgFrom: '#2A1A00',
      bgTo: '#4A3000',
      image: '/characters/region_mumbai.webp',
    },
    stats: {
      worldRank: '인도 최대 항만 복합체',
      annualTeu: '연간 약 600만 TEU (JNPT 포함)',
      berths: '뭄바이항+자와할랄 네루항 합산',
      tradeShare: '인도 컨테이너 무역 약 55%',
      topCargoes: ['컨테이너', '원유', '섬유', '화학품'],
      keyUsers: ['미국 🇺🇸', '중국 🇨🇳', 'UAE 🇦🇪', '유럽 🇪🇺'],
    },
    history: `뭄바이항은 **인도 서부 최대 무역항**으로, 1661년 영국 동인도회사가 포르투갈로부터 획득하면서 현대 항만의 기초가 닦였습니다.

마라타 왕 시바지는 17세기 인도 서해안에 요새와 함대를 건설, "인도 해군의 아버지"로 불리며 포르투갈·무굴 제국의 해상 패권에 맞섰습니다.

- **1661년** 영국 동인도회사 수령
- **1914년** 현대 부두 건설
- **1989년** 자와할랄 네루항(JNPT) 개장 — 컨테이너 전용
- **현재** 인도 GDP 성장과 함께 물동량 급증, 항만 확장 진행 중`,
    newsQuery: 'Mumbai JNPT port India shipping trade container 2024',
  },

  hamburg: {
    type: 'port',
    character: {
      name: '사자공 하인리히',
      nameEn: 'Henry the Lion',
      title: '작센·바이에른 공작 · 함부르크 항만 창건 1129~1195',
      flagEmoji: '🇩🇪',
      symbolEmoji: '🦁',
      quote: '"한자의 깃발이 닿는 곳이 곧 우리의 영토다."',
      bgFrom: '#1A1A0A',
      bgTo: '#2D2D1B',
      image: '/characters/region_hamburg.webp',
    },
    stats: {
      worldRank: '유럽 2위, 세계 17위 컨테이너항',
      annualTeu: '연간 약 850만 TEU',
      berths: '엘베강 하구 안벽 약 43km',
      tradeShare: 'EU 중부·동부 유럽 물류 관문',
      topCargoes: ['컨테이너', '화학품', '자동차', '기계류'],
      keyUsers: ['중국 🇨🇳', '미국 🇺🇸', '한국 🇰🇷', '러시아 🇷🇺'],
    },
    history: `함부르크항은 **1189년 하인리히 공작**이 엘베강 관세 면제 특권을 부여하면서 시작된 "자유 제국 도시"의 역사를 가진 유럽 2위 항만입니다.

중세 한자동맹(Hanseatic League)의 핵심 도시로, 북해·발트해 무역을 독점하며 유럽 경제를 주도했습니다.

- **1241년** 뤼베크와 한자동맹 결성 → 북유럽 무역 지배
- **1943년** 2차 대전 함부르크 대화재(Operation Gomorrah)
- **1989년** 독일 통일 후 동유럽 무역 급증
- **2021년** COSCO(중국해운) 함부르크 터미널 지분 매입 논란`,
    newsQuery: 'Hamburg port Europe shipping container trade energy 2024',
  },

  newyork: {
    type: 'port',
    character: {
      name: '알렉산더 해밀턴',
      nameEn: 'Alexander Hamilton',
      title: '미국 초대 재무장관 · 뉴욕 금융·무역 체계 설계 1755~1804',
      flagEmoji: '🇺🇸',
      symbolEmoji: '💵',
      quote: '"무역은 문명의 언어다. 자유로운 교역만이 국가를 위대하게 만든다."',
      bgFrom: '#0A0A1A',
      bgTo: '#1A1A3D',
      image: '/characters/region_newyork.webp',
    },
    stats: {
      worldRank: '미국 동부 최대항, 세계 약 23위',
      annualTeu: '연간 약 950만 TEU',
      berths: '뉴저지·뉴욕 합산 선석 200+',
      tradeShare: '미국 동부 수입품의 약 40%',
      topCargoes: ['컨테이너', '의류·신발', '가전', '식품·농산물'],
      keyUsers: ['중국 🇨🇳', '인도 🇮🇳', '유럽 🇪🇺', '한국 🇰🇷'],
    },
    history: `뉴욕·뉴저지항은 **미국 동부 최대 항만**으로, 대서양 무역의 관문이자 미국 최대 소비 시장 공급 기지입니다.

해밀턴은 1789년 초대 재무장관으로서 미국 관세청(Customs Service)을 설립하고 뉴욕을 미국 금융·무역의 중심으로 설계했습니다.

- **1626년** 네덜란드 동인도회사의 뉴암스테르담 건설
- **1869년** 수에즈 운하 개통 → 대서양-지중해 무역 급성장
- **2012년** 허리케인 샌디로 항만 침수 피해
- **2021년** 코로나 물류 대란 — LA/LB 과부하로 동부 전환 수혜`,
    newsQuery: 'Port of New York New Jersey container shipping US East Coast 2024',
  },

  // ── 세계 30대 항만 추가 (12개) ────────────────────────────────────────────────

  guangzhou: {
    type: 'port',
    character: {
      name: '쑨원',
      nameEn: 'Sun Yat-sen',
      title: '중화민국 임시대총통 · 중국 근대 혁명의 아버지 1866~1925',
      flagEmoji: '🇨🇳',
      symbolEmoji: '☀️',
      quote: '"천하는 모두의 것이다. 혁명은 아직 끝나지 않았다."',
      bgFrom: '#2D0A0A',
      bgTo: '#7F1D1D',
      image: '/characters/region_guangzhou.webp',
    },
    stats: {
      worldRank: '세계 5위 컨테이너항',
      annualTeu: '연간 약 2,500만 TEU',
      berths: '난사·황포 터미널 선석 200+',
      tradeShare: '광둥성 수출입 핵심 거점',
      topCargoes: ['컨테이너', '전자제품', '의류', '가전'],
      keyUsers: ['미국 🇺🇸', '유럽 🇪🇺', '한국 🇰🇷', '일본 🇯🇵'],
    },
    history: `광저우항은 **2,000년 역사**를 가진 중국 최고(最古) 무역항으로, 한나라 시대부터 해상 실크로드의 출발점이었습니다.

광둥성 출신 쑨원은 1912년 중화민국을 수립하고, 광저우를 중국 근대 혁명의 근거지로 삼았습니다.

- **기원전 214년** 진나라 시대 최초 항구 기록
- **1757~1842년** 광저우 독점 무역 시대(Canton System)
- **1978년** 개혁개방 → 세계 제조업 허브로 성장
- **현재** 난사 신항 확장으로 세계 5위 유지`,
    newsQuery: 'Guangzhou Nansha port China shipping container trade 2024',
  },

  qingdao: {
    type: 'port',
    character: {
      name: '강태공',
      nameEn: 'Jiang Taigong',
      title: '주나라 개국공신 · 제나라(산둥) 시조 기원전 11세기',
      flagEmoji: '🇨🇳',
      symbolEmoji: '🎣',
      quote: '"때를 기다리는 자만이 큰 물고기를 낚는다."',
      bgFrom: '#0A1A2D',
      bgTo: '#1A3A5F',
      image: '/characters/region_qingdao.webp',
    },
    stats: {
      worldRank: '세계 6위 컨테이너항',
      annualTeu: '연간 약 2,500만 TEU',
      berths: '전자동 터미널 포함 선석 100+',
      tradeShare: '산둥성 무역의 약 70%',
      topCargoes: ['컨테이너', '철광석', '원유', '화학품'],
      keyUsers: ['한국 🇰🇷', '일본 🇯🇵', '미국 🇺🇸', '독일 🇩🇪'],
    },
    history: `칭다오항은 산둥반도 남부의 **중국 북부 핵심 항만**으로, 1898~1914년 독일 조차지 시절 근대적 항만 인프라가 구축됐습니다.

기원전 11세기 강태공이 산둥(제나라)의 시조가 되어 어업과 염업으로 제나라를 부강하게 만들었습니다.

- **1898년** 독일 조차 → 현대 항만 건설 시작
- **1914년** 일본 점령 → 칭다오 맥주(青岛啤酒) 탄생
- **2017년** 세계 최초 완전 자동화 항만 터미널 개장
- **현재** 한중 무역 최대 컨테이너 항로 기점`,
    newsQuery: 'Qingdao port China shipping container Korea trade 2024',
  },

  tianjin: {
    type: 'port',
    character: {
      name: '이홍장',
      nameEn: 'Li Hongzhang',
      title: '청나라 직예총독 · 양무운동 주도 1823~1901',
      flagEmoji: '🇨🇳',
      symbolEmoji: '📜',
      quote: '"서양의 기술을 받아들이되, 중국의 근본을 지켜야 한다."',
      bgFrom: '#1A0A00',
      bgTo: '#4A2000',
      image: '/characters/region_tianjin.webp',
    },
    stats: {
      worldRank: '세계 8위 컨테이너항',
      annualTeu: '연간 약 2,100만 TEU',
      berths: '신강·동강 터미널 선석 150+',
      tradeShare: '베이징·허베이 물류 관문',
      topCargoes: ['컨테이너', '철강', '자동차', '원유'],
      keyUsers: ['한국 🇰🇷', '일본 🇯🇵', '독일 🇩🇪', '미국 🇺🇸'],
    },
    history: `톈진·신강항은 **수도 베이징의 해상 관문**으로, 직선거리 약 180km에 위치한 중국 북방 최대 무역항입니다.

이홍장은 직예총독으로 톈진을 기반으로 청나라 근대화(양무운동)를 이끌었으며, 조선(한국)과의 무역·외교도 이곳에서 처리했습니다.

- **1860년** 제2차 아편전쟁 후 개항
- **1871년** 이홍장 직예총독 부임 → 전략 항만으로 육성
- **1976년** 탕산 대지진 피해 및 재건
- **현재** 한중 최단 항로(인천~톈진 24시간) 기점`,
    newsQuery: 'Tianjin Xingang port China shipping Beijing trade 2024',
  },

  antwerp: {
    type: 'port',
    character: {
      name: '피터 폴 루벤스',
      nameEn: 'Peter Paul Rubens',
      title: '앤트워프 출신 바로크 화가 · 외교관 1577~1640',
      flagEmoji: '🇧🇪',
      symbolEmoji: '🎨',
      quote: '"앤트워프는 세계가 만나는 곳이다. 예술처럼, 무역도 경계가 없다."',
      bgFrom: '#1A0A1A',
      bgTo: '#4A1A4A',
      image: '/characters/region_antwerp.webp',
    },
    stats: {
      worldRank: '유럽 2위, 세계 13위 컨테이너항',
      annualTeu: '연간 약 1,300만 TEU',
      berths: '스헬더강 안벽 약 58km',
      tradeShare: 'EU 화학품 수출의 약 60%',
      topCargoes: ['컨테이너', '화학품', '자동차', '원유'],
      keyUsers: ['중국 🇨🇳', '미국 🇺🇸', '독일 🇩🇪', '네덜란드 🇳🇱'],
    },
    history: `앤트워프항은 **스헬더강 하구**에 위치한 벨기에 최대 항만으로, 16세기에는 세계 최대 상업 도시였습니다.

루벤스는 앤트워프 출신으로 바로크 예술을 꽃피우는 한편 외교관으로도 활약, 앤트워프 황금시대의 상징입니다.

- **16세기** 세계 최대 무역 도시 (인구 10만, 세계 교역의 40%)
- **1585년** 스페인 점령으로 황금시대 종료
- **1944년** 2차 대전 독일로부터 해방 — V-2 로켓 집중 공격
- **현재** 유럽 최대 화학 클러스터 집결지, 로테르담과 함께 ARA 항만권 구성`,
    newsQuery: 'Antwerp Bruges port Belgium Europe shipping container chemical 2024',
  },

  tanjung_pelepas: {
    type: 'port',
    character: {
      name: '술탄 아부 바카르',
      nameEn: 'Sultan Abu Bakar of Johor',
      title: '조호르 술탄국 아버지 · 근대 조호르 창건 1833~1895',
      flagEmoji: '🇲🇾',
      symbolEmoji: '🏰',
      quote: '"조호르의 문을 열면, 세계가 들어온다."',
      bgFrom: '#0A1A0A',
      bgTo: '#1A4A2A',
      image: '/characters/region_tanjung_pelepas.webp',
    },
    stats: {
      worldRank: '세계 15위 컨테이너항',
      annualTeu: '연간 약 1,100만 TEU',
      berths: '말라카해협 최남단 선석 50+',
      tradeShare: '말레이시아 북부 환적 물량 50%+',
      topCargoes: ['컨테이너 환적', '팜유', '고무', '전자제품'],
      keyUsers: ['중국 🇨🇳', '한국 🇰🇷', '일본 🇯🇵', '유럽 🇪🇺'],
    },
    history: `탄중펠레파스항은 말레이시아 조호르주 말라카 해협 최남단에 위치한 **전략적 환적 허브**로, 2000년 머스크·에버그린이 싱가포르에서 이전하면서 급성장했습니다.

조호르 술탄 아부 바카르는 영국과의 외교로 조호르 독립을 유지하며 근대 국가 체계를 구축, "조호르의 아버지"로 불립니다.

- **1999년** 개항 — 싱가포르 항만에 대한 전략적 대안
- **2000년** 머스크(Maersk) 기항 이전 → 세계적 환적항으로 도약
- **현재** 말라카 해협 통과 대형 선박의 핵심 환적지`,
    newsQuery: 'Tanjung Pelepas port Malaysia transshipment shipping 2024',
  },

  xiamen: {
    type: 'port',
    character: {
      name: '정성공',
      nameEn: 'Koxinga (Zheng Chenggong)',
      title: '명나라 충신 · 샤먼 기반 해상 왕국 건설 1624~1662',
      flagEmoji: '🇨🇳',
      symbolEmoji: '⚓',
      quote: '"바다는 경계가 없다. 내 함대가 닿는 곳이 중화의 땅이다."',
      bgFrom: '#0A1A2D',
      bgTo: '#1A3D5F',
      image: '/characters/region_xiamen.webp',
    },
    stats: {
      worldRank: '세계 16위 컨테이너항',
      annualTeu: '연간 약 1,200만 TEU',
      berths: '하이창·위안당 터미널 선석 70+',
      tradeShare: '푸젠성 대만 해협 무역 핵심',
      topCargoes: ['컨테이너', '전자제품', '신발', '화학품'],
      keyUsers: ['대만 🇹🇼', '미국 🇺🇸', '한국 🇰🇷', '유럽 🇪🇺'],
    },
    history: `샤먼항은 대만해협 서안의 **중국 동남부 전략 항만**으로, 역사적으로 대만·동남아와의 해상 무역 거점이었습니다.

정성공(국성야/鄭成功)은 청나라에 저항해 샤먼을 기지로 삼고 1661년 네덜란드로부터 대만을 수복한 해상 영웅으로, 중국과 대만 양측에서 추앙받습니다.

- **1684년** 청나라 통치 후 공식 개항
- **1980년** 경제특구 지정 → 급성장
- **현재** 대만 해협 양안 무역 최전선, 연간 대만↔샤먼 항로 1,000항차+`,
    newsQuery: 'Xiamen port China Taiwan shipping trade container 2024',
  },

  kaohsiung: {
    type: 'port',
    character: {
      name: '리덩후이',
      nameEn: 'Lee Teng-hui',
      title: '중화민국 제9대 총통 · 대만 민주화의 아버지 1923~2020',
      flagEmoji: '🇹🇼',
      symbolEmoji: '🌺',
      quote: '"대만은 바다로 태어난 나라다. 우리의 미래는 세계와 교역하는 것이다."',
      bgFrom: '#0A1A2D',
      bgTo: '#1A3A5F',
      image: '/characters/region_kaohsiung.webp',
    },
    stats: {
      worldRank: '세계 17위 컨테이너항',
      annualTeu: '연간 약 1,000만 TEU',
      berths: '예류·중저우 터미널 선석 100+',
      tradeShare: '대만 수출입의 약 80%',
      topCargoes: ['컨테이너', '반도체', '전자부품', '기계류'],
      keyUsers: ['중국 🇨🇳', '미국 🇺🇸', '일본 🇯🇵', '한국 🇰🇷'],
    },
    history: `가오슝항은 대만 최대 항만으로 **1970~80년대 대만 경제 기적**의 물류 기반이었습니다. 한때 세계 3위 컨테이너항이었으나 중국 항만의 부상으로 순위가 하락했습니다.

리덩후이 총통은 대만 첫 직선 대통령으로 민주화와 경제 자유화를 이끌어 대만을 반도체·전자 강국으로 성장시켰습니다.

- **1895년** 일본 통치기에 근대 항만 건설 시작
- **1970~80년대** 세계 3위 컨테이너항
- **2000년대** 중국 항만 부상으로 순위 하락
- **현재** TSMC 등 반도체 수출의 주요 관문`,
    newsQuery: 'Kaohsiung port Taiwan shipping semiconductor container trade 2024',
  },

  laem_chabang: {
    type: 'port',
    character: {
      name: '쭐랄롱꼰 대왕',
      nameEn: 'King Chulalongkorn (Rama V)',
      title: '태국 국왕 라마 5세 · 근대화 개혁 1853~1910',
      flagEmoji: '🇹🇭',
      symbolEmoji: '👑',
      quote: '"문명은 항구에서 온다. 문을 열어야 나라가 산다."',
      bgFrom: '#1A0A00',
      bgTo: '#4A2000',
      image: '/characters/region_laem_chabang.webp',
    },
    stats: {
      worldRank: '세계 18위 컨테이너항',
      annualTeu: '연간 약 800만 TEU',
      berths: '3단계 확장 포함 선석 60+',
      tradeShare: '태국 수출입의 약 90%',
      topCargoes: ['컨테이너', '자동차', '전자제품', '고무'],
      keyUsers: ['미국 🇺🇸', '중국 🇨🇳', '일본 🇯🇵', '유럽 🇪🇺'],
    },
    history: `렘차방항은 방콕 남동쪽 약 130km 태국만에 위치한 **태국 최대 항만**으로, 1991년 개항 이후 동남아 제조업 허브 태국의 물류 관문이 됐습니다.

쭐랄롱꼰 대왕(라마 5세)은 태국을 식민지화하지 않고 서양과의 외교·근대화로 독립을 유지한 동남아 최고의 개혁 군주입니다.

- **1991년** 개항 — 방콕 클롱토이항 포화로 신규 건설
- **1996년** 심수 컨테이너 터미널 완공
- **현재** 일본계 자동차(도요타·혼다) 수출 최대 거점, 동남아 자동차 수출 1위`,
    newsQuery: 'Laem Chabang port Thailand shipping automotive container trade 2024',
  },

  jakarta: {
    type: 'port',
    character: {
      name: '수카르노',
      nameEn: 'Sukarno',
      title: '인도네시아 초대 대통령 · 독립운동 지도자 1901~1970',
      flagEmoji: '🇮🇩',
      symbolEmoji: '🦅',
      quote: '"우리는 이 섬들의 바다에서 태어났다. 독립은 바다처럼 자유롭다."',
      bgFrom: '#1A0A0A',
      bgTo: '#4A1515',
      image: '/characters/region_jakarta.webp',
    },
    stats: {
      worldRank: '세계 21위 컨테이너항',
      annualTeu: '연간 약 700만 TEU',
      berths: '탄중프리욕 터미널 선석 80+',
      tradeShare: '인도네시아 수출입의 약 55%',
      topCargoes: ['컨테이너', '팜유', '석탄', '고무'],
      keyUsers: ['중국 🇨🇳', '싱가포르 🇸🇬', '일본 🇯🇵', '인도 🇮🇳'],
    },
    history: `자카르타(탄중프리욕)항은 인도네시아 수도 자카르타에 위치한 **동남아 4위 컨테이너항**으로, 2억 7천만 인구 대국 인도네시아의 최대 무역 관문입니다.

수카르노는 네덜란드 식민 지배에 맞서 독립운동을 이끌어 1945년 인도네시아 독립을 선언, 초대 대통령이 됐습니다.

- **17세기** 네덜란드 동인도회사(VOC)의 바타비아(현 자카르타) 건설
- **1945년** 독립 선언 후 항만 국유화
- **현재** 신(新) 탄중프리욕항 확장으로 세계 15위 목표`,
    newsQuery: 'Jakarta Tanjung Priok port Indonesia shipping container palm oil 2024',
  },

  colombo: {
    type: 'port',
    character: {
      name: '파라크라마바후 1세',
      nameEn: 'Parakramabahu I',
      title: '스리랑카 폴론나루와 왕국 왕 · 1123~1186',
      flagEmoji: '🇱🇰',
      symbolEmoji: '🐘',
      quote: '"바다가 선물을 가져다주듯, 지혜로운 왕은 천하와 교역한다."',
      bgFrom: '#1A0A1A',
      bgTo: '#4A1A3A',
      image: '/characters/region_colombo.webp',
    },
    stats: {
      worldRank: '세계 22위 컨테이너항 (인도양 최대 환적항)',
      annualTeu: '연간 약 700만 TEU',
      berths: '콜롬보 사우스항 포함 선석 50+',
      tradeShare: '인도양 환적 물량의 약 30%',
      topCargoes: ['컨테이너 환적', '의류·섬유', '차', '고무'],
      keyUsers: ['인도 🇮🇳', '중국 🇨🇳', '유럽 🇪🇺', '미국 🇺🇸'],
    },
    history: `콜롬보항은 스리랑카 수도 콜롬보에 위치한 **인도양 최대 환적 허브**로, 중동↔아시아 항로의 핵심 중간 기항지입니다.

파라크라마바후 1세는 스리랑카 황금시대를 이끈 왕으로 대규모 관개 시스템과 해상 무역 왕국을 구축했습니다.

- **1505년** 포르투갈 도래 → 식민지 무역 시작
- **1815년** 영국 통치 → 근대 항만 건설
- **2021년** 콜롬보 사우스항(China Merchants 운영) 완공
- **현재** 인도의 JNPT 포화로 환적 물량 급증`,
    newsQuery: 'Colombo port Sri Lanka Indian Ocean transshipment shipping 2024',
  },

  savannah: {
    type: 'port',
    character: {
      name: '제임스 오글소프',
      nameEn: 'James Oglethorpe',
      title: '조지아 식민지 창건자 · 사바나 도시 설계 1696~1785',
      flagEmoji: '🇺🇸',
      symbolEmoji: '🌳',
      quote: '"자유로운 땅 위에 세워진 도시는 자유로운 무역으로 번성한다."',
      bgFrom: '#0A1A0A',
      bgTo: '#1A4A1A',
      image: '/characters/region_savannah.webp',
    },
    stats: {
      worldRank: '미국 2위, 세계 약 25위 컨테이너항',
      annualTeu: '연간 약 570만 TEU',
      berths: '가든시티 터미널 선석 90+',
      tradeShare: '미국 남동부 수출입 관문',
      topCargoes: ['컨테이너', '자동차', '농산물', '목재'],
      keyUsers: ['중국 🇨🇳', '독일 🇩🇪', '한국 🇰🇷', '인도 🇮🇳'],
    },
    history: `사바나항은 조지아주에 위치한 **미국 동부 2위 컨테이너항**으로, 2021~22년 코로나 물류 대란 시 LA/LB 포화의 대안으로 급성장했습니다.

오글소프 장군은 1733년 사바나를 격자 구조의 계획도시로 설계하고 조지아 식민지를 창건, 미국 남동부 개발의 기틀을 마련했습니다.

- **1733년** 제임스 오글소프의 사바나 창건
- **1996년** 올림픽 요트 경기 개최
- **2021~22년** 코로나 물류 대란 → LA/LB 대체 급성장
- **현재** 멕시코만 파나마 운하 확장 수혜 — 네오파나막스 선박 직기항`,
    newsQuery: 'Port of Savannah Georgia US East Coast container shipping 2024',
  },

  hochiminhcity: {
    type: 'port',
    character: {
      name: '호찌민',
      nameEn: 'Ho Chi Minh',
      title: '베트남 민주공화국 초대 주석 · 독립운동 지도자 1890~1969',
      flagEmoji: '🇻🇳',
      symbolEmoji: '⭐',
      quote: '"아무것도 자유보다 소중하지 않다. 독립과 자유를 위해 싸운다."',
      bgFrom: '#1A0A0A',
      bgTo: '#5C1A1A',
      image: '/characters/region_hochiminhcity.webp',
    },
    stats: {
      worldRank: '세계 20위 컨테이너항',
      annualTeu: '연간 약 800만 TEU',
      berths: '캇라이·탄뀌·껀저 터미널 합산',
      tradeShare: '베트남 수출입의 약 50%',
      topCargoes: ['컨테이너', '의류·신발', '전자제품', '커피'],
      keyUsers: ['미국 🇺🇸', '중국 🇨🇳', '한국 🇰🇷', '일본 🇯🇵'],
    },
    history: `호치민시(구 사이공) 항만은 베트남 최대 상업도시의 **해상 관문**으로, 미중 무역 전쟁 이후 중국 대체 생산기지로 급성장 중입니다.

호찌민은 프랑스 식민 지배에 맞서 독립운동을 이끌어 1945년 베트남 독립을 선언했습니다.

- **1859년** 프랑스 점령 → 코친차이나 무역 거점
- **1975년** 사이공 함락 → 사회주의 통일 베트남
- **1986년** 도이머이(Doi Moi) 개혁개방
- **현재** 삼성·LG 등 한국 기업의 핵심 생산기지 수출항`,
    newsQuery: 'Ho Chi Minh City Cat Lai port Vietnam shipping container trade 2024',
  },
};
