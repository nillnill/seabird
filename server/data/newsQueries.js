// 지역(항만·초크포인트)별 뉴스 검색 쿼리 — region-news 엔드포인트 + regionNewsCollector(일 배치) 공용.
// 7개 초크포인트 + 30개 항만 = 37개 지역.
const NEWS_QUERIES = {
  suez:          'Suez Canal shipping disruption latest',
  malacca:       'Malacca Strait shipping maritime security news',
  hormuz:        'Strait of Hormuz Iran oil tanker sanctions news',
  panama:        'Panama Canal drought water level shipping delay',
  dover:         'English Channel Dover shipping traffic maritime',
  korea_strait:  'Korea Strait Busan shipping trade maritime',
  bab_el_mandeb: 'Bab el-Mandeb Red Sea Houthi shipping attack',
  busan:         'Busan Port container shipping Korea trade',
  incheon:       'Incheon Port Korea shipping logistics',
  gwangyang:     'Gwangyang Port POSCO steel Korea shipping',
  singapore:     'Singapore Port container shipping throughput',
  shanghai:      'Shanghai Port container China trade shipping',
  rotterdam:     'Rotterdam Port Europe container LNG shipping',
  la_lb:         'Los Angeles Long Beach Port shipping container',
  dubai:         'Dubai Jebel Ali Port DP World shipping Middle East',
  yokohama:        'Yokohama port Japan shipping trade automotive',
  kobe:            'Kobe port Japan shipping cargo Kansai trade',
  ningbo:          'Ningbo Zhoushan port China shipping container iron ore',
  shenzhen:        'Shenzhen Yantian port China manufacturing trade supply chain',
  hongkong:        'Hong Kong port shipping container trade finance',
  vladivostok:     'Vladivostok port Russia Pacific trade sanctions',
  portklang:       'Port Klang Malaysia ASEAN shipping container trade',
  mumbai:          'Mumbai JNPT port India shipping trade container',
  hamburg:         'Hamburg port Europe shipping container trade energy',
  newyork:         'Port of New York New Jersey container shipping US East Coast',
  guangzhou:       'Guangzhou Nansha port China shipping container Pearl River Delta',
  qingdao:         'Qingdao port China shipping container Korea trade Shandong',
  tianjin:         'Tianjin Xingang port China shipping Beijing container trade',
  antwerp:         'Antwerp Bruges port Belgium Europe shipping container chemical',
  tanjung_pelepas: 'Tanjung Pelepas port Malaysia transshipment shipping Johor',
  xiamen:          'Xiamen port China Taiwan shipping container trade',
  kaohsiung:       'Kaohsiung port Taiwan shipping semiconductor container trade',
  laem_chabang:    'Laem Chabang port Thailand shipping automotive container ASEAN',
  jakarta:         'Jakarta Tanjung Priok port Indonesia shipping container palm oil',
  colombo:         'Colombo port Sri Lanka Indian Ocean transshipment shipping',
  savannah:        'Port of Savannah Georgia US East Coast container shipping',
  hochiminhcity:   'Ho Chi Minh City Cat Lai port Vietnam shipping container manufacturing',
};

const CHOKEPOINT_IDS = new Set(['suez', 'malacca', 'hormuz', 'panama', 'dover', 'korea_strait', 'bab_el_mandeb']);
const regionType = (id) => (CHOKEPOINT_IDS.has(id) ? 'chokepoint' : 'port');

module.exports = { NEWS_QUERIES, CHOKEPOINT_IDS, regionType };
