import { sunPosition } from "./solar.js";
import { zonedWallTimeToUTC } from "./tz.js";
import { findCity } from "./geo.js";

export function normalizeDeg180(a) {
  return (((a + 180) % 360) + 360) % 360 - 180;
}

export function computeSunAngles(params, records) {
  const { location, year, month, day, hour, minute, heading = 0 } = params;

  let lat, lng, tz, matched;
  const city = findCity(location, records);
  if (city) {
    ({ lat, lng, tz } = city);
    matched = city;
  } else if (Number.isFinite(params.lat) && Number.isFinite(params.lng)) {
    lat = params.lat;
    lng = params.lng;
    tz = params.tz || "UTC";
    matched = null;
  } else {
    return { error: "city_not_found" };
  }

  const utc = zonedWallTimeToUTC(year, month, day, hour, minute, tz);
  const { altitude, azimuth } = sunPosition(lat, lng, utc);
  const belowHorizon = altitude <= 0;

  return {
    rotation: normalizeDeg180(azimuth - heading),
    elevation: belowHorizon ? 0 : altitude,
    belowHorizon,
    altitude,
    azimuth,
    matched,
  };
}
