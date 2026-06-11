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

export function mmsiToFlag(mmsi) {
  const mid = parseInt(mmsi.substring(0, 3));
  const MID_MAP = {
    338: 'USA', 235: 'GBR', 211: 'DEU', 218: 'DNK', 224: 'ESP',
    226: 'FRA', 247: 'ITA', 244: 'NLD', 232: 'GBR', 477: 'HKG',
    440: 'KOR', 441: 'KOR', 412: 'CHN', 413: 'CHN', 414: 'CHN',
    431: 'JPN', 432: 'JPN', 525: 'IDN', 563: 'SGP', 574: 'VNM',
    566: 'SGP', 548: 'PHL', 419: 'IND', 470: 'ARE', 403: 'SAU',
    503: 'AUS', 512: 'NZL', 636: 'LBR', 667: 'SLE', 620: 'MDG',
    657: 'TZA', 204: 'PRT', 209: 'CYP', 255: 'PRT', 256: 'MLT',
    269: 'CHE', 273: 'RUS', 276: 'EST', 278: 'LVA', 279: 'LTU',
  };
  return MID_MAP[mid] ?? null;
}

export function parsePositionReport(msg) {
  const m = msg.Message.PositionReport;
  const heading = m.TrueHeading !== 511 ? m.TrueHeading : m.Cog ?? null;
  return {
    mmsi: String(m.UserID),
    lat: m.Latitude,
    lng: m.Longitude,
    speed: m.Sog,
    heading,
    course: m.Cog ?? null,
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
