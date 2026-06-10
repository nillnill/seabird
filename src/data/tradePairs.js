// UN Comtrade 2023 기반 주요 교역 쌍별 화물 구성
export const TRADE_PAIRS = {
  'IDN_KOR': {
    top_cargo: [
      { name: '니켈 광석/제품', hs_code: '7502', share_pct: 38, margin: 8 },
      { name: '석탄', hs_code: '2701', share_pct: 25, margin: 5 },
      { name: '팜유', hs_code: '1511', share_pct: 15, margin: 6 },
      { name: '고무', hs_code: '4001', share_pct: 12, margin: 7 },
      { name: '기타', hs_code: '9999', share_pct: 10, margin: 4 },
    ],
    source: 'UN Comtrade 2023',
  },
  'AUS_KOR': {
    top_cargo: [
      { name: '철광석', hs_code: '2601', share_pct: 42, margin: 6 },
      { name: 'LNG', hs_code: '2711', share_pct: 30, margin: 5 },
      { name: '석탄', hs_code: '2701', share_pct: 18, margin: 5 },
      { name: '기타', hs_code: '9999', share_pct: 10, margin: 4 },
    ],
    source: 'UN Comtrade 2023',
  },
  'SAU_KOR': {
    top_cargo: [
      { name: '원유', hs_code: '2709', share_pct: 72, margin: 4 },
      { name: '석유제품', hs_code: '2710', share_pct: 18, margin: 5 },
      { name: '석유화학원료', hs_code: '2901', share_pct: 8, margin: 6 },
      { name: '기타', hs_code: '9999', share_pct: 2, margin: 3 },
    ],
    source: 'UN Comtrade 2023',
  },
  'QAT_KOR': {
    top_cargo: [
      { name: 'LNG', hs_code: '2711', share_pct: 85, margin: 5 },
      { name: '기타', hs_code: '9999', share_pct: 15, margin: 3 },
    ],
    source: 'UN Comtrade 2023',
  },
  'USA_KOR': {
    top_cargo: [
      { name: 'LNG', hs_code: '2711', share_pct: 30, margin: 5 },
      { name: '반도체장비', hs_code: '8486', share_pct: 20, margin: 15 },
      { name: '대두', hs_code: '1201', share_pct: 18, margin: 6 },
      { name: '옥수수', hs_code: '1005', share_pct: 12, margin: 5 },
      { name: '기타', hs_code: '9999', share_pct: 20, margin: 4 },
    ],
    source: 'UN Comtrade 2023',
  },
  'BRA_KOR': {
    top_cargo: [
      { name: '철광석', hs_code: '2601', share_pct: 45, margin: 6 },
      { name: '대두', hs_code: '1201', share_pct: 28, margin: 6 },
      { name: '원당', hs_code: '1701', share_pct: 12, margin: 5 },
      { name: '기타', hs_code: '9999', share_pct: 15, margin: 4 },
    ],
    source: 'UN Comtrade 2023',
  },
  'RUS_KOR': {
    top_cargo: [
      { name: '유연탄', hs_code: '2701', share_pct: 40, margin: 5 },
      { name: 'LNG', hs_code: '2711', share_pct: 30, margin: 5 },
      { name: '원유', hs_code: '2709', share_pct: 20, margin: 4 },
      { name: '기타', hs_code: '9999', share_pct: 10, margin: 3 },
    ],
    source: 'UN Comtrade 2023',
  },
  'CHN_USA': {
    top_cargo: [
      { name: '전자제품', hs_code: '8517', share_pct: 28, margin: 12 },
      { name: '기계류', hs_code: '8479', share_pct: 20, margin: 10 },
      { name: '가구', hs_code: '9403', share_pct: 12, margin: 8 },
      { name: '의류', hs_code: '6204', share_pct: 10, margin: 9 },
      { name: '기타', hs_code: '9999', share_pct: 30, margin: 7 },
    ],
    source: 'UN Comtrade 2023',
  },
  'CHN_EUR': {
    top_cargo: [
      { name: '전자제품', hs_code: '8517', share_pct: 25, margin: 12 },
      { name: '기계류', hs_code: '8479', share_pct: 22, margin: 10 },
      { name: '전기차/부품', hs_code: '8703', share_pct: 15, margin: 14 },
      { name: '의류/섬유', hs_code: '6204', share_pct: 10, margin: 9 },
      { name: '기타', hs_code: '9999', share_pct: 28, margin: 7 },
    ],
    source: 'UN Comtrade 2023',
  },
  'SGP_JPN': {
    top_cargo: [
      { name: '석유제품', hs_code: '2710', share_pct: 35, margin: 6 },
      { name: '전자부품', hs_code: '8542', share_pct: 25, margin: 14 },
      { name: '화학제품', hs_code: '2901', share_pct: 18, margin: 8 },
      { name: '기타', hs_code: '9999', share_pct: 22, margin: 5 },
    ],
    source: 'UN Comtrade 2023',
  },
  'IND_CHN': {
    top_cargo: [
      { name: '철광석', hs_code: '2601', share_pct: 30, margin: 5 },
      { name: '면화', hs_code: '5201', share_pct: 20, margin: 6 },
      { name: '화학원료', hs_code: '2935', share_pct: 18, margin: 8 },
      { name: '수산물', hs_code: '0306', share_pct: 10, margin: 7 },
      { name: '기타', hs_code: '9999', share_pct: 22, margin: 5 },
    ],
    source: 'UN Comtrade 2023',
  },
  'ARE_IND': {
    top_cargo: [
      { name: '원유', hs_code: '2709', share_pct: 55, margin: 4 },
      { name: '석유제품', hs_code: '2710', share_pct: 25, margin: 5 },
      { name: '천연가스', hs_code: '2711', share_pct: 12, margin: 5 },
      { name: '기타', hs_code: '9999', share_pct: 8, margin: 4 },
    ],
    source: 'UN Comtrade 2023',
  },
  'NLD_CHN': {
    top_cargo: [
      { name: '반도체/장비', hs_code: '8486', share_pct: 35, margin: 18 },
      { name: '의약품', hs_code: '3004', share_pct: 20, margin: 20 },
      { name: '화학제품', hs_code: '2901', share_pct: 15, margin: 10 },
      { name: '기타', hs_code: '9999', share_pct: 30, margin: 8 },
    ],
    source: 'UN Comtrade 2023',
  },
  'MYS_CHN': {
    top_cargo: [
      { name: '전자부품', hs_code: '8542', share_pct: 40, margin: 14 },
      { name: '팜유', hs_code: '1511', share_pct: 20, margin: 6 },
      { name: '천연고무', hs_code: '4001', share_pct: 12, margin: 7 },
      { name: '기타', hs_code: '9999', share_pct: 28, margin: 6 },
    ],
    source: 'UN Comtrade 2023',
  },
  'KOR_USA': {
    top_cargo: [
      { name: '자동차', hs_code: '8703', share_pct: 30, margin: 12 },
      { name: '반도체', hs_code: '8542', share_pct: 25, margin: 20 },
      { name: '선박', hs_code: '8901', share_pct: 12, margin: 10 },
      { name: '가전제품', hs_code: '8521', share_pct: 10, margin: 12 },
      { name: '기타', hs_code: '9999', share_pct: 23, margin: 7 },
    ],
    source: 'UN Comtrade 2023',
  },
};

// 월별 계절 인덱스 (Jan-Dec)
export const SEASONAL_INDEX = {
  LNG:      [1.3, 1.2, 1.0, 0.8, 0.7, 0.7, 0.7, 0.8, 1.0, 1.1, 1.2, 1.4],
  GRAIN:    [0.8, 0.8, 1.0, 1.2, 1.3, 1.1, 0.9, 0.8, 0.9, 1.0, 1.1, 1.0],
  OIL:      [1.1, 1.0, 1.0, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.1, 1.1],
  COAL:     [1.2, 1.1, 1.0, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.1],
  CONTAINER:[1.0, 0.9, 1.0, 1.0, 1.1, 1.1, 1.0, 1.0, 1.1, 1.2, 1.2, 1.1],
};

// HS 코드 → 계절 카테고리 매핑
export function getSeasonalCategory(hsCode) {
  if (['2711'].includes(hsCode)) return 'LNG';
  if (['1201', '1005', '1001'].includes(hsCode)) return 'GRAIN';
  if (['2709', '2710'].includes(hsCode)) return 'OIL';
  if (['2701'].includes(hsCode)) return 'COAL';
  return 'CONTAINER';
}
