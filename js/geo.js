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

// Ranked autocomplete suggestions for a partial "city" or "city, qualifier"
// query. Exact name beats prefix beats substring; ties break by population.
// Pure — the UI layer renders whatever this returns.
export function suggestCities(query, records, limit = 8) {
  const parts = (query || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const cityQ = parts[0] || "";
  const qualQ = parts[1] || "";
  if (!cityQ) return [];
  const aliasQ = QUALIFIER_ALIASES[qualQ] || qualQ;

  const scored = [];
  for (const r of records) {
    const name = r.city.toLowerCase();
    let score;
    if (name === cityQ) score = 0;
    else if (name.startsWith(cityQ)) score = 1;
    else if (name.includes(cityQ)) score = 2;
    else continue;
    if (qualQ) {
      const rc = (r.regionCode || "").toLowerCase();
      const rg = (r.region || "").toLowerCase();
      const co = (r.country || "").toLowerCase();
      const cn = (r.countryName || "").toLowerCase();
      const ok =
        rc.startsWith(qualQ) || rg.startsWith(qualQ) || rg.startsWith(aliasQ) ||
        co === qualQ || cn.startsWith(qualQ) || cn.startsWith(aliasQ);
      if (!ok) continue;
    }
    scored.push({ r, score });
  }
  scored.sort((a, b) => a.score - b.score || (b.r.population || 0) - (a.r.population || 0));
  return scored.slice(0, limit).map((s) => s.r);
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
