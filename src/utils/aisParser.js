import { inferCountryFromPort } from './geoUtils.js';

export function mapAISTypeToCategory(typeCode) {
  if (!typeCode) return 'Other';
  if (typeCode === 30) return 'Fishing';
  if (typeCode >= 31 && typeCode <= 39) return 'Special Craft'; // 예인·군함·범선·레저 등
  if (typeCode >= 40 && typeCode <= 49) return 'Special Craft'; // 고속선(HSC)
  if (typeCode >= 50 && typeCode <= 59) return 'Special Craft'; // 도선·예인·SAR 등
  if (typeCode >= 60 && typeCode <= 69) return 'Passenger';
  if (typeCode >= 72 && typeCode <= 74) return 'Bulk Carrier';
  if (typeCode >= 70 && typeCode <= 79) return 'Container Ship';
  if (typeCode === 84 || typeCode === 85) return 'LNG Carrier';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  return 'Other';
}

// ITU MID(MMSI 앞 3자리) → ISO3 국가코드. 전 세계 표준 테이블 (server/index.js MID_TO_FLAG와 동기화).
const MID_TO_FLAG = {
  201: 'ALB', 202: 'AND', 203: 'AUT', 204: 'PRT', 205: 'BEL', 206: 'BLR', 207: 'BGR', 208: 'VAT', 209: 'CYP', 210: 'CYP',
  211: 'DEU', 212: 'CYP', 213: 'GEO', 214: 'MDA', 215: 'MLT', 216: 'ARM', 218: 'DEU', 219: 'DNK', 220: 'DNK', 224: 'ESP',
  225: 'ESP', 226: 'FRA', 227: 'FRA', 228: 'FRA', 230: 'FIN', 231: 'FRO', 232: 'GBR', 233: 'GBR', 234: 'GBR', 235: 'GBR',
  236: 'GIB', 237: 'GRC', 238: 'HRV', 239: 'GRC', 240: 'GRC', 241: 'GRC', 242: 'MAR', 243: 'HUN', 244: 'NLD', 245: 'NLD',
  246: 'NLD', 247: 'ITA', 248: 'MLT', 249: 'MLT', 250: 'IRL', 251: 'ISL', 252: 'LIE', 253: 'LUX', 254: 'MCO', 255: 'PRT',
  256: 'MLT', 257: 'NOR', 258: 'NOR', 259: 'NOR', 261: 'POL', 262: 'MNE', 263: 'PRT', 264: 'ROU', 265: 'SWE', 266: 'SWE',
  267: 'SVK', 268: 'SMR', 269: 'CHE', 270: 'CZE', 271: 'TUR', 272: 'UKR', 273: 'RUS', 274: 'MKD', 275: 'LVA', 276: 'EST',
  277: 'LTU', 278: 'SVN', 279: 'SRB',
  301: 'AIA', 303: 'USA', 304: 'ATG', 305: 'ATG', 306: 'CUW', 307: 'ABW', 308: 'BHS', 309: 'BHS', 310: 'BMU', 311: 'BHS',
  312: 'BLZ', 314: 'BRB', 316: 'CAN', 319: 'CYM', 321: 'CRI', 323: 'CUB', 325: 'DMA', 327: 'DOM', 329: 'GLP', 330: 'GRD',
  331: 'GRL', 332: 'GTM', 334: 'HND', 336: 'HTI', 338: 'USA', 339: 'JAM', 341: 'KNA', 343: 'LCA', 345: 'MEX', 347: 'MTQ',
  348: 'MSR', 350: 'NIC', 351: 'PAN', 352: 'PAN', 353: 'PAN', 354: 'PAN', 355: 'PAN', 356: 'PAN', 357: 'PAN', 358: 'PRI',
  359: 'SLV', 361: 'SPM', 362: 'TTO', 364: 'TCA', 366: 'USA', 367: 'USA', 368: 'USA', 369: 'USA', 370: 'PAN', 371: 'PAN',
  372: 'PAN', 373: 'PAN', 374: 'PAN', 375: 'VCT', 376: 'VCT', 377: 'VCT', 378: 'VGB', 379: 'VIR',
  401: 'AFG', 403: 'SAU', 405: 'BGD', 408: 'BHR', 410: 'BTN', 412: 'CHN', 413: 'CHN', 414: 'CHN', 416: 'TWN', 417: 'LKA',
  419: 'IND', 422: 'IRN', 423: 'AZE', 425: 'IRQ', 428: 'ISR', 431: 'JPN', 432: 'JPN', 434: 'TKM', 436: 'KAZ', 437: 'UZB',
  438: 'JOR', 440: 'KOR', 441: 'KOR', 443: 'PSE', 445: 'PRK', 447: 'KWT', 450: 'LBN', 451: 'KGZ', 453: 'MAC', 455: 'MDV',
  457: 'MNG', 459: 'NPL', 461: 'OMN', 463: 'PAK', 466: 'QAT', 468: 'SYR', 470: 'ARE', 471: 'ARE', 472: 'TJK', 473: 'YEM',
  475: 'YEM', 477: 'HKG', 478: 'BIH',
  501: 'FRA', 503: 'AUS', 506: 'MMR', 508: 'BRN', 510: 'FSM', 511: 'PLW', 512: 'NZL', 514: 'KHM', 515: 'KHM', 516: 'CXR',
  518: 'COK', 520: 'FJI', 523: 'CCK', 525: 'IDN', 529: 'KIR', 531: 'LAO', 533: 'MYS', 536: 'MNP', 538: 'MHL', 540: 'NCL',
  542: 'NIU', 544: 'NRU', 546: 'PYF', 548: 'PHL', 553: 'PNG', 555: 'PCN', 557: 'SLB', 559: 'ASM', 561: 'WSM', 563: 'SGP',
  564: 'SGP', 565: 'SGP', 566: 'SGP', 567: 'THA', 570: 'TON', 572: 'TUV', 574: 'VNM', 576: 'VUT', 577: 'VUT', 578: 'WLF',
  601: 'ZAF', 603: 'AGO', 605: 'DZA', 607: 'ATF', 608: 'SHN', 609: 'BDI', 610: 'CMR', 611: 'COD', 612: 'CAF', 613: 'COG',
  615: 'COG', 616: 'COM', 617: 'CPV', 618: 'ATF', 619: 'CIV', 620: 'COM', 621: 'DJI', 622: 'EGY', 624: 'ETH', 625: 'ERI',
  626: 'GAB', 627: 'GHA', 629: 'GMB', 630: 'GNB', 631: 'GNQ', 632: 'GIN', 633: 'BFA', 634: 'KEN', 635: 'ATF', 636: 'LBR',
  637: 'LBR', 638: 'SSD', 642: 'LBY', 644: 'LSO', 645: 'MUS', 647: 'MDG', 649: 'MLI', 650: 'MOZ', 654: 'MRT', 655: 'MWI',
  656: 'NER', 657: 'NGA', 659: 'NAM', 660: 'REU', 661: 'RWA', 662: 'SDN', 663: 'SEN', 664: 'SYC', 665: 'SHN', 666: 'SOM',
  667: 'SLE', 668: 'STP', 669: 'SWZ', 670: 'TCD', 671: 'TGO', 672: 'TUN', 674: 'TZA', 675: 'UGA', 676: 'COD', 677: 'TZA',
  678: 'ZMB', 679: 'ZWE',
  701: 'ARG', 710: 'BRA', 720: 'BOL', 725: 'CHL', 730: 'COL', 735: 'ECU', 740: 'FLK', 745: 'GUF', 750: 'GUY', 755: 'PRY',
  760: 'PER', 765: 'SUR', 770: 'URY', 775: 'VEN',
};

export function mmsiToFlag(mmsi) {
  if (!mmsi) return null;
  return MID_TO_FLAG[parseInt(String(mmsi).substring(0, 3))] ?? null;
}

export function parsePositionReport(msg) {
  const m = msg.Message.PositionReport;
  const heading = m.TrueHeading !== 511 ? m.TrueHeading : m.Cog ?? null;
  const mmsi = String(m.UserID);
  const flag = mmsiToFlag(mmsi);
  return {
    mmsi,
    lat: m.Latitude,
    lng: m.Longitude,
    speed: m.Sog,
    heading,
    course: m.Cog ?? null,
    // 국적은 MMSI MID로 모든 메시지에서 결정 가능 → 위치보고에도 채워 통계/마커 커버리지 ~100%
    flag_country: flag,
    origin_country: flag,
    updated_at: new Date().toISOString(),
  };
}

export function parseShipStaticData(msg) {
  const m = msg.Message.ShipStaticData;
  const mmsi = String(m.UserID);
  const destination = m.Destination?.trim() || null;
  return {
    mmsi,
    ship_name: m.Name?.trim() || null,
    vessel_type: mapAISTypeToCategory(m.Type ?? 0),
    destination,
    draught: m.MaximumStaticDraught ?? null,
    call_sign: m.CallSign?.trim() || null,
    imo: m.ImoNumber ? String(m.ImoNumber) : null,
    flag_country: mmsiToFlag(mmsi),
    origin_country: mmsiToFlag(mmsi),
    dest_country: inferCountryFromPort(destination),
  };
}

export function toGeoJSONFeature(ship) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [ship.lng, ship.lat] },
    properties: {
      mmsi: ship.mmsi,
      ship_name: ship.ship_name ?? '',
      vessel_type: ship.vessel_type ?? 'Other',
      speed: ship.speed ?? 0,
      heading: ship.heading ?? 0,
      destination: ship.destination ?? '',
    },
  };
}
