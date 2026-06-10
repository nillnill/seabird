export function distanceNm(lat1, lng1, lat2, lng2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nmToDeg(nm) {
  return nm / 60;
}

export function calcBearing(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// 항구명 → ISO-3 국가코드 추정
const PORT_COUNTRY_MAP = {
  BUSAN: 'KOR', KRPUS: 'KOR', INCHEON: 'KOR', KRINC: 'KOR',
  GWANGYANG: 'KOR', ULSAN: 'KOR',
  SINGAPORE: 'SGP', SGSIN: 'SGP',
  SHANGHAI: 'CHN', CNSHA: 'CHN', TIANJIN: 'CHN', SHENZHEN: 'CHN',
  TOKYO: 'JPN', YOKOHAMA: 'JPN', OSAKA: 'JPN',
  ROTTERDAM: 'NLD', NLRTM: 'NLD', ANTWERP: 'BEL',
  HAMBURG: 'DEU', BREMERHAVEN: 'DEU',
  LOSANGELES: 'USA', 'LOS ANGELES': 'USA', LONGBEACH: 'USA', USLAX: 'USA',
  HOUSTON: 'USA', NEWYORK: 'USA',
  DUBAI: 'ARE', JEBEL: 'ARE', AEJEA: 'ARE',
  PORTKLANG: 'MYS', TANJUNGPELEPAS: 'MYS',
  COLOMBO: 'LKA',
  MUMBAI: 'IND', NHAVASHEVA: 'IND',
  SYDNEY: 'AUS', MELBOURNE: 'AUS', BRISBANE: 'AUS',
  JAKARTA: 'IDN', SURABAYA: 'IDN',
  'PORT SAID': 'EGY', PORTSAID: 'EGY',
  JEDDAH: 'SAU', DAMMAM: 'SAU',
};

export function inferCountryFromPort(destination) {
  if (!destination) return null;
  const key = destination.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  for (const [pattern, code] of Object.entries(PORT_COUNTRY_MAP)) {
    if (key.includes(pattern)) return code;
  }
  return null;
}

export function normalizePortName(raw) {
  if (!raw) return null;
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}
