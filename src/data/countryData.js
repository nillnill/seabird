// 국가별 지정학 Fulcrum 데이터 (Civ 리더 컨셉)
// Marko Papic 'Geopolitical Alpha'의 4제약(정치·정치경제 / 거시·시장 / 지정학 / 헌법·법률)을
// "사실 나열 + 시각화"로 보여주기 위한 큐레이션 베이스. 라이브/공식 데이터는 에이전트가 오버레이한다.
//
// 설계: 이 파일은 '구조적(거의 불변)' 사실 + 데이터 수급 메타(WB 지표 코드·검색 언어·공급원 항구)만 담는다.
//       변동 수치(실업률·가격·의존%)는 country_indicators / freight_history / country_supply_routes(원자 레이어)에 쌓고,
//       countryFulcrumAgent가 이를 읽어 country_fulcrum(합성)으로 조립한다.

// ── World Bank 지표 (무키 API, 전 국가 공용) — domain별 metric_key·코드·라벨·단위 ──
export const WB_INDICATORS = [
  { domain: 'political', key: 'unemployment',     code: 'SL.UEM.TOTL.ZS',    label: '실업률',        unit: '%' },
  { domain: 'political', key: 'manuf_share',      code: 'NV.IND.MANF.ZS',    label: '제조업 비중',   unit: '% GDP' },
  { domain: 'market',    key: 'gdp_growth',       code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP 성장률',    unit: '%' },
  { domain: 'market',    key: 'inflation',        code: 'FP.CPI.TOTL.ZG',    label: '소비자물가',    unit: '%' },
  { domain: 'market',    key: 'trade_openness',   code: 'NE.TRD.GNFS.ZS',    label: '무역의존도',    unit: '% GDP' },
  { domain: 'market',    key: 'current_account',  code: 'BN.CAB.XOKA.GD.ZS', label: '경상수지',      unit: '% GDP' },
  { domain: 'geopolitics', key: 'energy_import_dep', code: 'EG.IMP.CONS.ZS', label: '에너지 수입의존', unit: '% 에너지사용' },
  { domain: 'geopolitics', key: 'fuel_import_share', code: 'TM.VAL.FUEL.ZS.UN', label: '연료 수입비중', unit: '% 상품수입' },
  { domain: 'legal',     key: 'rule_of_law',      code: 'RL.EST',            label: '법치 지수',     unit: 'WGI(-2.5~2.5)' },
  { domain: 'legal',     key: 'gov_effectiveness',code: 'GE.EST',            label: '정부 효율성',   unit: 'WGI(-2.5~2.5)' },
  { domain: 'legal',     key: 'political_stability', code: 'PV.EST',         label: '정치 안정성',   unit: 'WGI(-2.5~2.5)' },
];

// ── 추적 원자재·광물 (HS 코드 = UN Comtrade, instruments = 상장 선물/ETF/주식 = Yahoo) ──
// commodityInstruments.js(서버)가 instruments로 가격을 수급. 여기선 품목 메타만.
export const COMMODITIES = {
  crude:    { label: '원유',     emoji: '🛢️', hs: '2709', unit: 'bbl' },
  refined:  { label: '석유제품', emoji: '⛽', hs: '2710', unit: 't' },
  lng:      { label: 'LNG·가스', emoji: '🔥', hs: '2711', unit: 't' },
  coal:     { label: '석탄',     emoji: '⚫', hs: '2701', unit: 't' },
  iron_ore: { label: '철광석',   emoji: '⛏️', hs: '2601', unit: 't' },
  copper:   { label: '구리',     emoji: '🟤', hs: '2603', unit: 't' },
  nickel:   { label: '니켈',     emoji: '🔩', hs: '7502', unit: 't' },
  lng_short: { label: 'LNG', emoji: '🔥', hs: '2711', unit: 't' },
  rare_earth: { label: '희토류', emoji: '🧲', hs: '2846', unit: 't' },
  grain:    { label: '곡물',     emoji: '🌾', hs: '1001', unit: 't' },
};

// ── 공급원(국가)×품목 → 대표 수출항 좌표 [lng,lat] (searoute origin용) ──
// 수입국 supplyChains의 supplier가 이 표를 참조. 좌표는 대표 수출 터미널 근사.
export const EXPORT_PORTS = {
  SAU: { crude: [50.16, 26.69], lng: [49.6, 27.5] },          // Ras Tanura
  ARE: { crude: [54.68, 24.95] },                             // Fujairah/Jebel Dhanna 근사
  KWT: { crude: [48.13, 29.07] },                             // Mina Al Ahmadi
  IRQ: { crude: [48.8, 29.95] },                              // Basra
  IRN: { crude: [56.4, 26.6], lng: [52.6, 27.4] },           // Kharg/Bandar
  USA: { crude: [-93.9, 29.7], lng: [-93.9, 29.7], coal: [-76.3, 36.9] }, // USGC / Norfolk
  QAT: { lng: [51.6, 25.9] },                                 // Ras Laffan
  AUS: { lng: [114.6, -20.6], iron_ore: [118.6, -20.31], coal: [151.8, -32.9] }, // NW Shelf / Port Hedland / Newcastle
  IDN: { coal: [117.6, -0.5], nickel: [122.5, -3.0] },        // Kalimantan / Sulawesi
  RUS: { crude: [131.9, 42.8], lng: [52.3, 71.2], coal: [131.9, 42.8] }, // Kozmino / Sabetta
  BRA: { iron_ore: [-44.3, -23.0], crude: [-43.1, -22.9] },   // Itaguaí / Tubarão 근사
  CHL: { copper: [-71.6, -33.0] },                            // Valparaíso/Ventanas
  PER: { copper: [-77.1, -12.05] },                           // Callao
  ZAF: { coal: [32.06, -28.8] },                              // Richards Bay
  CAN: { crude: [-123.1, 49.3] },                             // Vancouver
  NGA: { crude: [7.0, 4.3] },                                 // Bonny (나이지리아)
  NOR: { crude: [5.3, 60.8], lng: [5.5, 59.3] },             // Mongstad / Kårstø
  DZA: { lng: [-0.62, 35.8], crude: [3.06, 36.76] },         // Arzew / Algiers (알제리)
  LBY: { crude: [18.3, 30.6] },                               // Es Sider (리비아)
  AZE: { crude: [35.8, 36.9] },                               // BTC→Ceyhan 경유 근사 (아제르바이잔)
};

// ── 12개국 큐레이션 ──
// leader/persona: Civ 리더 컨셉(국기·상징·인용). image 없으면 flagEmoji fallback.
// coords: 대표 수도/관문 [lng,lat]. lang: Perplexity 현지언론 검색 언어.
// structural: 거의 불변 구조 제약(에이전트 시드/검증용, 점수 아님).
// supplyChains: 수입 의존 품목 + 공급원(approx % = 큐레이션 폴백; 라이브는 UN Comtrade로 교체).
//   importMainPort: searoute destination(수입국 대표 양하항).
export const COUNTRY_DATA = {
  KOR: {
    code: 'KOR', name: '대한민국', flagEmoji: '🇰🇷', symbolEmoji: '⚓',
    coords: [126.98, 37.57], lang: 'ko',
    leader: { name: '세종', title: '조선 제4대 국왕 · 해양·과학 진흥', quote: '"백성이 나라의 근본이니, 그 삶이 곧 국력이다."', bgFrom: '#0A2A43', bgTo: '#0E4F7A', image: '/characters/country_kor.webp' },
    structural: {
      industries: ['반도체', '조선', '자동차', '석유화학', '철강'],
      energyMaritimeDependence: '에너지의 거의 100%를 해상 수입(원유·LNG·석탄)',
      keyChokepoints: ['hormuz', 'malacca', 'korea_strait'],
      hypothesisFulcrum: 'geopolitics: 해상 에너지 수입 안보 (호르무즈→말라카→대한해협 단일 회랑 의존)',
    },
    importMainPort: [129.04, 35.10], // 부산/울산권
    supplyChains: {
      crude:    [{ supplier: 'SAU', pct: 32 }, { supplier: 'USA', pct: 14 }, { supplier: 'KWT', pct: 11 }, { supplier: 'ARE', pct: 10 }, { supplier: 'IRQ', pct: 8 }],
      lng:      [{ supplier: 'QAT', pct: 25 }, { supplier: 'AUS', pct: 23 }, { supplier: 'USA', pct: 18 }],
      coal:     [{ supplier: 'AUS', pct: 40 }, { supplier: 'IDN', pct: 22 }, { supplier: 'RUS', pct: 14 }],
      iron_ore: [{ supplier: 'AUS', pct: 60 }, { supplier: 'BRA', pct: 28 }],
    },
  },
  CHN: {
    code: 'CHN', name: '중국', flagEmoji: '🇨🇳', symbolEmoji: '🐉',
    coords: [116.40, 39.90], lang: 'zh',
    leader: { name: '정화 (鄭和)', title: '명대 대항해 제독', quote: '"바닷길을 여는 자가 천하의 부를 잇는다."', bgFrom: '#3A0B0B', bgTo: '#7A1212', image: '/characters/country_chn.webp' },
    structural: {
      industries: ['제조업 전반', '전자', '철강', '조선', '전기차·배터리'],
      energyMaritimeDependence: '원유 70%+ 수입, 대부분 말라카 경유',
      keyChokepoints: ['malacca', 'hormuz', 'bab_el_mandeb'],
      hypothesisFulcrum: "geopolitics: '말라카 딜레마' — 원유 수입의 말라카 해협 단일 의존",
    },
    importMainPort: [122.0, 30.0], // 닝보·저우산권
    supplyChains: {
      crude:    [{ supplier: 'SAU', pct: 18 }, { supplier: 'RUS', pct: 16 }, { supplier: 'IRQ', pct: 11 }, { supplier: 'ARE', pct: 10 }, { supplier: 'IRN', pct: 9 }],
      iron_ore: [{ supplier: 'AUS', pct: 60 }, { supplier: 'BRA', pct: 23 }],
      lng:      [{ supplier: 'AUS', pct: 34 }, { supplier: 'QAT', pct: 22 }, { supplier: 'RUS', pct: 11 }],
      coal:     [{ supplier: 'IDN', pct: 45 }, { supplier: 'AUS', pct: 12 }, { supplier: 'RUS', pct: 18 }],
    },
  },
  JPN: {
    code: 'JPN', name: '일본', flagEmoji: '🇯🇵', symbolEmoji: '🗾',
    coords: [139.69, 35.69], lang: 'ja',
    leader: { name: '사카모토 료마', title: '막말 해운·통상 개혁가', quote: '"세계는 바다로 연결된다."', bgFrom: '#2A0A1A', bgTo: '#7A1240', image: '/characters/country_jpn.webp' },
    structural: {
      industries: ['자동차', '전자', '기계', '소재·부품', '조선'],
      energyMaritimeDependence: '에너지 자급률 낮음 — 원유·LNG·석탄 거의 전량 해상 수입',
      keyChokepoints: ['hormuz', 'malacca', 'korea_strait'],
      hypothesisFulcrum: 'geopolitics: 중동 원유·호주 LNG 해상 회랑 의존',
    },
    importMainPort: [139.7, 35.45], // 도쿄만
    supplyChains: {
      crude:    [{ supplier: 'SAU', pct: 40 }, { supplier: 'ARE', pct: 35 }, { supplier: 'KWT', pct: 8 }],
      lng:      [{ supplier: 'AUS', pct: 40 }, { supplier: 'QAT', pct: 12 }, { supplier: 'USA', pct: 10 }],
      coal:     [{ supplier: 'AUS', pct: 65 }, { supplier: 'IDN', pct: 12 }],
    },
  },
  USA: {
    code: 'USA', name: '미국', flagEmoji: '🇺🇸', symbolEmoji: '🦅',
    coords: [-77.04, 38.91], lang: 'en',
    leader: { name: 'A.T. 머핸', title: '해양력 이론가 (제독)', quote: '"바다를 지배하는 자가 세계 무역을 지배한다."', bgFrom: '#0A1A3A', bgTo: '#12397A', image: '/characters/country_usa.webp' },
    structural: {
      industries: ['에너지(셰일)', '항공우주', '반도체 설계', '농업', '금융'],
      energyMaritimeDependence: '에너지 순수출국 — 원유·LNG·석탄 수출, 일부 중질원유 수입',
      keyChokepoints: ['panama', 'hormuz', 'malacca'],
      hypothesisFulcrum: 'geopolitics: 해군력 기반 해상로 보장(수입 의존 낮음, 동맹 공급 보증자)',
    },
    importMainPort: [-93.9, 29.7], // USGC
    supplyChains: {
      crude: [{ supplier: 'CAN', pct: 60 }, { supplier: 'SAU', pct: 7 }, { supplier: 'BRA', pct: 5 }],
    },
  },
  SAU: {
    code: 'SAU', name: '사우디아라비아', flagEmoji: '🇸🇦', symbolEmoji: '🛢️',
    coords: [46.72, 24.69], lang: 'ar',
    leader: { name: '이븐 사우드', title: '사우디 건국 국왕', quote: '"사막 아래 부(富)가 세계를 움직인다."', bgFrom: '#0A2A14', bgTo: '#125A2A', image: '/characters/country_sau.webp' },
    structural: {
      industries: ['원유·가스', '석유화학', '정유'],
      energyMaritimeDependence: '세계 최대 원유 수출국 — 호르무즈·홍해(바브엘만데브) 통한 수출',
      keyChokepoints: ['hormuz', 'bab_el_mandeb', 'suez'],
      hypothesisFulcrum: 'geopolitics: 원유 수출로 안보(호르무즈·홍해) + 시장 제약(유가)',
    },
    importMainPort: null,
    supplyChains: {}, // 주로 공급원(수출국)
  },
  IRN: {
    code: 'IRN', name: '이란', flagEmoji: '🇮🇷', symbolEmoji: '☪️',
    coords: [51.39, 35.69], lang: 'fa',
    leader: { name: '키루스 대왕', title: '아케메네스 페르시아 창건자', quote: '"관문을 쥔 자가 길을 정한다."', bgFrom: '#1A1A1A', bgTo: '#3A5A2A', image: '/characters/country_irn.webp' },
    structural: {
      industries: ['원유·가스', '석유화학'],
      energyMaritimeDependence: '원유 수출국 — 제재 하 수출, 호르무즈 통제력 보유',
      keyChokepoints: ['hormuz'],
      hypothesisFulcrum: 'legal/geopolitics: 제재(법·금융 제약) + 호르무즈 통제 레버',
    },
    importMainPort: null,
    supplyChains: {},
  },
  EGY: {
    code: 'EGY', name: '이집트', flagEmoji: '🇪🇬', symbolEmoji: '🐫',
    coords: [31.24, 30.04], lang: 'ar',
    leader: { name: '가말 압델 나세르', title: '수에즈 국유화 (1956)', quote: '"수에즈는 이집트인의 것이다."', bgFrom: '#2D1A02', bgTo: '#713F12', image: '/characters/country_egy.webp' },
    structural: {
      industries: ['수에즈 통항료', '관광', '농업', '천연가스'],
      energyMaritimeDependence: '수에즈 운하 통항료가 핵심 외화 — 통항량에 재정 민감',
      keyChokepoints: ['suez', 'bab_el_mandeb'],
      hypothesisFulcrum: 'market: 수에즈 통항 수입(통항량↓→외화·재정 압박)',
    },
    importMainPort: [32.3, 31.2],
    supplyChains: {
      grain: [{ supplier: 'RUS', pct: 50 }, { supplier: 'USA', pct: 12 }],
    },
  },
  SGP: {
    code: 'SGP', name: '싱가포르', flagEmoji: '🇸🇬', symbolEmoji: '🦁',
    coords: [103.82, 1.35], lang: 'en',
    leader: { name: '리콴유', title: '싱가포르 건국 총리', quote: '"작은 나라는 길목을 장악해 산다."', bgFrom: '#2A0A2A', bgTo: '#7A1255', image: '/characters/country_sgp.webp' },
    structural: {
      industries: ['환적 항만', '정유·벙커링', '금융', '반도체'],
      energyMaritimeDependence: '원유 전량 수입·정제 후 재수출(말라카 길목 입지)',
      keyChokepoints: ['malacca'],
      hypothesisFulcrum: 'geopolitics: 말라카 환적·벙커링 허브 입지(통항량이 곧 경제)',
    },
    importMainPort: [103.7, 1.26],
    supplyChains: {
      crude: [{ supplier: 'SAU', pct: 22 }, { supplier: 'ARE', pct: 18 }, { supplier: 'KWT', pct: 12 }],
    },
  },
  AUS: {
    code: 'AUS', name: '호주', flagEmoji: '🇦🇺', symbolEmoji: '🦘',
    coords: [149.13, -35.28], lang: 'en',
    leader: { name: '매슈 플린더스', title: '호주 일주 항해가', quote: '"대륙을 두른 바다가 곧 부의 통로다."', bgFrom: '#1A2A0A', bgTo: '#4F7A12', image: '/characters/country_aus.webp' },
    structural: {
      industries: ['철광석', '석탄', 'LNG', '농업'],
      energyMaritimeDependence: '자원 수출국 — 철광석·석탄·LNG 최대 수출국(동아시아向)',
      keyChokepoints: ['malacca', 'korea_strait'],
      hypothesisFulcrum: 'market: 자원 수출가(철광석·석탄)·동아시아 수요 의존',
    },
    importMainPort: null,
    supplyChains: {},
  },
  IND: {
    code: 'IND', name: '인도', flagEmoji: '🇮🇳', symbolEmoji: '🕉️',
    coords: [77.21, 28.61], lang: 'hi',
    leader: { name: '찬드라굽타 마우리아', title: '마우리아 제국 창건자', quote: '"바다를 통한 교역이 제국을 살찌운다."', bgFrom: '#2A1A02', bgTo: '#7A5012', image: '/characters/country_ind.webp' },
    structural: {
      industries: ['정유', 'IT 서비스', '제약', '철강', '섬유'],
      energyMaritimeDependence: '원유 85%+ 수입 — 호르무즈·러시아산 비중 급증',
      keyChokepoints: ['hormuz', 'bab_el_mandeb', 'malacca'],
      hypothesisFulcrum: 'geopolitics/market: 원유 수입 의존 + 러시아산 할인 활용',
    },
    importMainPort: [72.95, 22.4], // 잠나가르/구자라트
    supplyChains: {
      crude: [{ supplier: 'RUS', pct: 36 }, { supplier: 'IRQ', pct: 18 }, { supplier: 'SAU', pct: 14 }, { supplier: 'ARE', pct: 8 }],
      coal:  [{ supplier: 'IDN', pct: 30 }, { supplier: 'AUS', pct: 25 }, { supplier: 'ZAF', pct: 18 }],
    },
  },
  RUS: {
    code: 'RUS', name: '러시아', flagEmoji: '🇷🇺', symbolEmoji: '🐻',
    coords: [37.62, 55.75], lang: 'ru',
    leader: { name: '표트르 대제', title: '러시아 해군 창설 황제', quote: '"바다로 난 창(窓)이 제국을 깨운다."', bgFrom: '#1A1A2A', bgTo: '#3A3A6A', image: '/characters/country_rus.webp' },
    structural: {
      industries: ['원유·가스', '석탄', '곡물', '금속'],
      energyMaritimeDependence: '에너지·곡물 수출국 — 제재 하 아시아向 해상 수출 재편',
      keyChokepoints: ['malacca', 'bab_el_mandeb', 'suez'],
      hypothesisFulcrum: 'legal: 제재(금융·해운 보험·가격상한) 제약 + 아시아 수출 전환',
    },
    importMainPort: null,
    supplyChains: {},
  },
  DEU: {
    code: 'DEU', name: '독일', flagEmoji: '🇩🇪', symbolEmoji: '⚙️',
    coords: [13.40, 52.52], lang: 'de',
    leader: { name: '한자동맹', title: '북유럽 해상 무역 연맹', quote: '"교역의 자유가 도시를 부유하게 한다."', bgFrom: '#1A1A1A', bgTo: '#4A4A4A', image: '/characters/country_deu.webp' },
    structural: {
      industries: ['자동차', '기계', '화학', '전기전자'],
      energyMaritimeDependence: '러시아 PNG 이탈 후 LNG 해상 수입 급증(원유·LNG·석탄)',
      keyChokepoints: ['suez', 'dover'],
      hypothesisFulcrum: 'market/geopolitics: 에너지 수입가·공급 다변화(러 이탈 후 LNG 전환)',
    },
    importMainPort: [8.5, 53.55], // 함부르크/빌헬름스하펜
    supplyChains: {
      lng:   [{ supplier: 'USA', pct: 45 }, { supplier: 'QAT', pct: 12 }],
      crude: [{ supplier: 'USA', pct: 23 }, { supplier: 'SAU', pct: 12 } ],
      coal:  [{ supplier: 'USA', pct: 20 }, { supplier: 'AUS', pct: 15 }, { supplier: 'ZAF', pct: 12 }],
    },
  },
  // ── G20 추가국 (2026-06) ──
  GBR: {
    code: 'GBR', name: '영국', flagEmoji: '🇬🇧', symbolEmoji: '🦁',
    coords: [-0.13, 51.51], lang: 'en',
    leader: { name: '허레이쇼 넬슨', title: '트라팔가르 해전 제독', quote: '"영국은 모두가 본분을 다하길 기대한다."', bgFrom: '#0A1A3A', bgTo: '#1E3A6A', image: '/characters/country_gbr.webp' },
    structural: {
      industries: ['금융', '항공우주', '제약', '자동차'],
      energyMaritimeDependence: '북해 생산 감소 → LNG·원유 해상 수입 의존 증가',
      keyChokepoints: ['dover', 'suez'],
      hypothesisFulcrum: 'market: 에너지 수입 전환(북해 감소)·금융 개방경제',
    },
    importMainPort: [1.3, 51.95], // Felixstowe
    supplyChains: {
      lng:   [{ supplier: 'USA', pct: 40 }, { supplier: 'QAT', pct: 30 }],
      crude: [{ supplier: 'USA', pct: 25 }, { supplier: 'NOR', pct: 22 }, { supplier: 'SAU', pct: 10 }],
    },
  },
  FRA: {
    code: 'FRA', name: '프랑스', flagEmoji: '🇫🇷', symbolEmoji: '🐓',
    coords: [2.35, 48.85], lang: 'fr',
    leader: { name: '장바티스트 콜베르', title: '루이14세의 중상주의·해군 재상', quote: '"무역과 해군이 국부의 두 기둥이다."', bgFrom: '#0A1A4A', bgTo: '#3A2A7A', image: '/characters/country_fra.webp' },
    structural: {
      industries: ['항공우주', '원자력', '명품', '농식품'],
      energyMaritimeDependence: '원자력 비중 높으나 원유·가스는 해상 수입 의존',
      keyChokepoints: ['suez', 'dover', 'bab_el_mandeb'],
      hypothesisFulcrum: 'political/legal: 연금·에너지 개혁 정치 + 원자력 정책',
    },
    importMainPort: [0.1, 49.48], // Le Havre
    supplyChains: {
      crude: [{ supplier: 'USA', pct: 18 }, { supplier: 'SAU', pct: 14 }, { supplier: 'NGA', pct: 12 }],
      lng:   [{ supplier: 'USA', pct: 35 }, { supplier: 'QAT', pct: 15 }, { supplier: 'DZA', pct: 12 }],
    },
  },
  ITA: {
    code: 'ITA', name: '이탈리아', flagEmoji: '🇮🇹', symbolEmoji: '🏛️',
    coords: [12.48, 41.89], lang: 'it',
    leader: { name: '안드레아 도리아', title: '제노바 해군 제독', quote: '"지중해를 쥐는 자가 교역을 쥔다."', bgFrom: '#0A3A1A', bgTo: '#1A5A3A', image: '/characters/country_ita.webp' },
    structural: {
      industries: ['기계', '자동차', '명품', '정유'],
      energyMaritimeDependence: '가스·원유 수입 의존(러 의존 탈피→알제리·LNG)',
      keyChokepoints: ['suez', 'bab_el_mandeb'],
      hypothesisFulcrum: 'market: 에너지 수입가·공급 다변화',
    },
    importMainPort: [8.9, 44.4], // Genoa
    supplyChains: {
      crude: [{ supplier: 'LBY', pct: 18 }, { supplier: 'AZE', pct: 16 }, { supplier: 'SAU', pct: 12 }],
      lng:   [{ supplier: 'DZA', pct: 35 }, { supplier: 'USA', pct: 18 }, { supplier: 'QAT', pct: 14 }],
    },
  },
  CAN: {
    code: 'CAN', name: '캐나다', flagEmoji: '🇨🇦', symbolEmoji: '🍁',
    coords: [-75.70, 45.42], lang: 'en',
    leader: { name: '존 A. 맥도널드', title: '캐나다 초대 총리', quote: '"대륙을 잇는 길이 곧 국가다."', bgFrom: '#3A0A0A', bgTo: '#7A1A1A', image: '/characters/country_can.webp' },
    structural: {
      industries: ['에너지(오일샌드)', '광물', '농업', '임업'],
      energyMaritimeDependence: '에너지 순수출국 — 원유·가스·광물·곡물 수출',
      keyChokepoints: ['panama'],
      hypothesisFulcrum: 'market: 원자재 수출가·대미 의존(파이프라인·항만)',
    },
    importMainPort: null,
    supplyChains: {},
  },
  MEX: {
    code: 'MEX', name: '멕시코', flagEmoji: '🇲🇽', symbolEmoji: '🦅',
    coords: [-99.13, 19.43], lang: 'es',
    leader: { name: '베니토 후아레스', title: '멕시코 개혁 대통령', quote: '"타인의 권리 존중이 곧 평화다."', bgFrom: '#0A3A1A', bgTo: '#1A6A3A', image: '/characters/country_mex.webp' },
    structural: {
      industries: ['제조(자동차)', '석유', '농업', '전자'],
      energyMaritimeDependence: '원유 수출국이나 정제유(가솔린) 수입 의존',
      keyChokepoints: ['panama'],
      hypothesisFulcrum: 'political/market: 대미 무역(USMCA)·니어쇼어링',
    },
    importMainPort: [-94.4, 18.1], // Coatzacoalcos
    supplyChains: {
      refined: [{ supplier: 'USA', pct: 70 }],
    },
  },
  BRA: {
    code: 'BRA', name: '브라질', flagEmoji: '🇧🇷', symbolEmoji: '🌳',
    coords: [-47.88, -15.79], lang: 'pt',
    leader: { name: '페드루 2세', title: '브라질 제국 황제', quote: '"광대한 자원이 미래를 연다."', bgFrom: '#0A3A1A', bgTo: '#2A7A1A', image: '/characters/country_bra.webp' },
    structural: {
      industries: ['철광석', '대두·곡물', '원유', '항공기'],
      energyMaritimeDependence: '원유·철광석·대두 수출국(중국 수요 의존)',
      keyChokepoints: ['panama', 'suez'],
      hypothesisFulcrum: 'market: 원자재 수출가·중국 수요',
    },
    importMainPort: null,
    supplyChains: {},
  },
  IDN: {
    code: 'IDN', name: '인도네시아', flagEmoji: '🇮🇩', symbolEmoji: '🌋',
    coords: [106.85, -6.21], lang: 'id',
    leader: { name: '수카르노', title: '인도네시아 건국 대통령', quote: '"바다가 우리를 갈라놓지 않고 잇는다."', bgFrom: '#3A0A0A', bgTo: '#7A1A1A', image: '/characters/country_idn.webp' },
    structural: {
      industries: ['석탄', '니켈', '팜유', '제조'],
      energyMaritimeDependence: '석탄·니켈 수출 거점이나 원유·정제유는 수입',
      keyChokepoints: ['malacca'],
      hypothesisFulcrum: 'geopolitics/market: 말라카 입지 + 니켈·석탄 수출 레버',
    },
    importMainPort: [106.9, -6.1],
    supplyChains: {
      crude: [{ supplier: 'SAU', pct: 30 }, { supplier: 'NGA', pct: 15 }],
    },
  },
  TUR: {
    code: 'TUR', name: '튀르키예', flagEmoji: '🇹🇷', symbolEmoji: '🌙',
    coords: [32.85, 39.93], lang: 'tr',
    leader: { name: '무스타파 케말 아타튀르크', title: '튀르키예 공화국 건국자', quote: '"해협을 쥔 자가 두 대륙을 잇는다."', bgFrom: '#3A0A0A', bgTo: '#7A1212', image: '/characters/country_tur.webp' },
    structural: {
      industries: ['제조·자동차', '섬유', '건설', '방산'],
      energyMaritimeDependence: '에너지 수입 의존 + 보스포루스·다르다넬스 해협 통제',
      keyChokepoints: ['suez', 'bab_el_mandeb'],
      hypothesisFulcrum: 'geopolitics: 에너지 수입 + 해협 통제·지역 강국 레버',
    },
    importMainPort: [29.9, 40.7], // Izmit
    supplyChains: {
      crude: [{ supplier: 'RUS', pct: 30 }, { supplier: 'IRQ', pct: 20 }, { supplier: 'SAU', pct: 10 }],
      lng:   [{ supplier: 'RUS', pct: 25 }, { supplier: 'USA', pct: 18 }, { supplier: 'DZA', pct: 14 }],
    },
  },
  ARG: {
    code: 'ARG', name: '아르헨티나', flagEmoji: '🇦🇷', symbolEmoji: '☀️',
    coords: [-58.38, -34.60], lang: 'es',
    leader: { name: '호세 데 산마르틴', title: '남미 독립 해방자', quote: '"자유는 바다 건너에서도 지켜져야 한다."', bgFrom: '#0A2A4A', bgTo: '#2A5A8A', image: '/characters/country_arg.webp' },
    structural: {
      industries: ['농업(대두·곡물)', '에너지(Vaca Muerta 셰일)', '광업'],
      energyMaritimeDependence: '곡물·셰일 수출 잠재력이나 정제유·가스 수입 변동',
      keyChokepoints: ['panama', 'suez'],
      hypothesisFulcrum: 'market: 인플레·환율·곡물 수출 사이클',
    },
    importMainPort: null,
    supplyChains: {},
  },
  ZAF: {
    code: 'ZAF', name: '남아프리카공화국', flagEmoji: '🇿🇦', symbolEmoji: '💎',
    coords: [28.19, -25.75], lang: 'en',
    leader: { name: '넬슨 만델라', title: '남아공 초대 민주 대통령', quote: '"불가능해 보이던 것도 이루기 전까진 늘 그렇다."', bgFrom: '#0A3A1A', bgTo: '#1A6A3A', image: '/characters/country_zaf.webp' },
    structural: {
      industries: ['광업(백금·금·석탄)', '제조', '농업'],
      energyMaritimeDependence: '석탄·광물 수출국이나 원유 수입 + 희망봉 우회 요충',
      keyChokepoints: ['bab_el_mandeb', 'suez'],
      hypothesisFulcrum: 'market/political: 광물 수출가·전력난(Eskom)',
    },
    importMainPort: [31.0, -29.87], // Durban
    supplyChains: {
      crude: [{ supplier: 'SAU', pct: 30 }, { supplier: 'NGA', pct: 20 }],
    },
  },
};

// 국가별 자국 언론 도메인 — Perplexity search_domain_filter로 검색을 해당국 매체로 제한.
// (미국 뉴스를 한국 매체가 인용하는 문제 방지. 본문은 한국어로 번역하되 출처는 자국 매체.)
export const MEDIA_DOMAINS = {
  KOR: ['yna.co.kr', 'chosun.com', 'donga.com', 'hani.co.kr', 'mk.co.kr', 'hankyung.com'],
  USA: ['nytimes.com', 'washingtonpost.com', 'wsj.com', 'politico.com', 'reuters.com', 'apnews.com'],
  CHN: ['xinhuanet.com', 'people.com.cn', 'caixin.com', 'globaltimes.cn', 'chinadaily.com.cn'],
  JPN: ['nhk.or.jp', 'asahi.com', 'nikkei.com', 'yomiuri.co.jp', 'mainichi.jp'],
  DEU: ['spiegel.de', 'faz.net', 'zeit.de', 'handelsblatt.com', 'tagesschau.de'],
  SAU: ['spa.gov.sa', 'arabnews.com', 'alarabiya.net', 'saudigazette.com.sa'],
  IRN: ['irna.ir', 'presstv.ir', 'tehrantimes.com', 'en.mehrnews.com'],
  EGY: ['ahram.org.eg', 'egypttoday.com', 'almasryalyoum.com', 'dailynewsegypt.com'],
  SGP: ['straitstimes.com', 'channelnewsasia.com', 'businesstimes.com.sg'],
  AUS: ['abc.net.au', 'smh.com.au', 'theaustralian.com.au', 'afr.com'],
  IND: ['thehindu.com', 'timesofindia.indiatimes.com', 'indianexpress.com', 'economictimes.indiatimes.com'],
  RUS: ['tass.com', 'themoscowtimes.com', 'kommersant.ru', 'interfax.ru'],
  GBR: ['bbc.com', 'theguardian.com', 'ft.com', 'telegraph.co.uk', 'reuters.com'],
  FRA: ['lemonde.fr', 'lefigaro.fr', 'lesechos.fr', 'france24.com'],
  ITA: ['corriere.it', 'repubblica.it', 'ilsole24ore.com', 'ansa.it'],
  CAN: ['cbc.ca', 'theglobeandmail.com', 'nationalpost.com', 'financialpost.com'],
  MEX: ['eluniversal.com.mx', 'milenio.com', 'jornada.com.mx', 'eleconomista.com.mx'],
  BRA: ['globo.com', 'folha.uol.com.br', 'estadao.com.br', 'valor.globo.com'],
  IDN: ['kompas.com', 'detik.com', 'thejakartapost.com', 'tempo.co'],
  TUR: ['hurriyet.com.tr', 'sabah.com.tr', 'dailysabah.com', 'aa.com.tr'],
  ARG: ['clarin.com', 'lanacion.com.ar', 'infobae.com', 'ambito.com'],
  ZAF: ['news24.com', 'iol.co.za', 'businesslive.co.za', 'timeslive.co.za'],
};

export const COUNTRY_LIST = Object.values(COUNTRY_DATA);
