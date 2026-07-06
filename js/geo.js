// Common ways people write a country that don't match GeoNames' code or name.
const QUALIFIER_ALIASES = {
  uk: "united kingdom", "u.k.": "united kingdom",
  usa: "united states", us: "united states", "u.s.": "united states",
  "u.s.a.": "united states", america: "united states",
  uae: "united arab emirates",
};

export function findCity(query, records) {
  if (!query) return null;
  const parts = query.split(",").map((s) => s.trim()).filter(Boolean);
  const cityQ = (parts[0] || "").toLowerCase();
  const qualQ = (parts[1] || "").toLowerCase();
  if (!cityQ) return null;

  const quals = qualQ
    ? (QUALIFIER_ALIASES[qualQ] ? [qualQ, QUALIFIER_ALIASES[qualQ]] : [qualQ])
    : [];
  const qualOk = (r) =>
    quals.length === 0 ||
    quals.some(
      (q) =>
        (r.regionCode && r.regionCode.toLowerCase() === q) ||
        (r.region && r.region.toLowerCase() === q) ||
        (r.country && r.country.toLowerCase() === q) ||
        (r.countryName && r.countryName.toLowerCase() === q)
    );

  // Exact city name first; if nothing matches, fall back to a prefix match so
  // common short forms resolve ("New York" -> "New York City"). The chosen
  // result is shown to the user, so a surprising prefix match is visible.
  let matches = records.filter((r) => r.city.toLowerCase() === cityQ && qualOk(r));
  if (matches.length === 0) {
    matches = records.filter((r) => r.city.toLowerCase().startsWith(cityQ) && qualOk(r));
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => (b.population || 0) - (a.population || 0));
  return matches[0];
}

// Closest record to a lat/lng, by squared degree distance. Used to borrow a
// timezone for manually-entered coordinates that aren't a listed city.
export function nearestCity(lat, lng, records) {
  let best = null;
  let bestD = Infinity;
  for (const r of records) {
    const dLat = r.lat - lat;
    const dLng = r.lng - lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

let _cache = null;
export async function loadCities() {
  if (_cache) return _cache;
  const url = new URL("./cities.json", import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cities.json load failed: ${res.status}`);
  _cache = await res.json();
  return _cache;
}
