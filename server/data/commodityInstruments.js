// 원자재·광물 → 상장 선물·ETF·주식(Yahoo Finance 심볼) 매핑. (사용자 요청: 상장 상품 최대 활용)
// marketScraper가 이 표로 일별 종가를 수집 → freight_history(category='market').
// kind: 'future'(선물) | 'etf' | 'equity'(대표 생산·정제 기업). label은 한글 표기.
// ⚠️ Yahoo 심볼: 선물은 연속물(=F). 일부 광물(니켈·철광석)은 거래소 선물이 Yahoo에 약해 ETF/주식 프록시 사용.
module.exports = {
  COMMODITY_INSTRUMENTS: {
    crude: [
      { symbol: 'CL=F', kind: 'future', label: 'WTI 원유선물' },
      { symbol: 'BZ=F', kind: 'future', label: '브렌트 원유선물' },
      { symbol: 'USO',  kind: 'etf',    label: 'USO 원유 ETF' },
    ],
    refined: [
      { symbol: 'RB=F', kind: 'future', label: 'RBOB 휘발유선물' },
      { symbol: 'HO=F', kind: 'future', label: '난방유선물' },
      { symbol: 'CRAK', kind: 'etf',    label: 'CRAK 정유 ETF' },
    ],
    lng: [
      { symbol: 'NG=F', kind: 'future', label: '천연가스선물(Henry Hub)' },
      { symbol: 'TTF=F', kind: 'future', label: '유럽 TTF 가스선물' },
      { symbol: 'UNG',  kind: 'etf',    label: 'UNG 천연가스 ETF' },
    ],
    coal: [
      { symbol: 'BTU',  kind: 'equity', label: 'Peabody Energy(석탄)' },
      { symbol: 'ARCH', kind: 'equity', label: 'Arch Resources(석탄)' },
      { symbol: 'KOL',  kind: 'etf',    label: '석탄 ETF(있을 시)' },
    ],
    iron_ore: [
      { symbol: 'BHP',  kind: 'equity', label: 'BHP(철광석)' },
      { symbol: 'RIO',  kind: 'equity', label: 'Rio Tinto(철광석)' },
      { symbol: 'VALE', kind: 'equity', label: 'Vale(철광석)' },
      { symbol: 'SLX',  kind: 'etf',    label: 'SLX 철강 ETF' },
    ],
    copper: [
      { symbol: 'HG=F', kind: 'future', label: '구리선물' },
      { symbol: 'COPX', kind: 'etf',    label: 'COPX 구리광산 ETF' },
      { symbol: 'CPER', kind: 'etf',    label: 'CPER 구리 ETF' },
    ],
    nickel: [
      { symbol: 'PICK', kind: 'etf',    label: 'PICK 금속·광산 ETF' },
      { symbol: 'VALE', kind: 'equity', label: 'Vale(니켈)' },
    ],
    rare_earth: [
      { symbol: 'REMX', kind: 'etf',    label: 'REMX 희토류·전략금속 ETF' },
      { symbol: 'MP',   kind: 'equity', label: 'MP Materials(희토류)' },
    ],
    uranium: [
      { symbol: 'URA',  kind: 'etf',    label: 'URA 우라늄 ETF' },
      { symbol: 'CCJ',  kind: 'equity', label: 'Cameco(우라늄)' },
    ],
    grain: [
      { symbol: 'ZW=F', kind: 'future', label: '밀선물' },
      { symbol: 'ZC=F', kind: 'future', label: '옥수수선물' },
      { symbol: 'WEAT', kind: 'etf',    label: 'WEAT 밀 ETF' },
    ],
  },
};
