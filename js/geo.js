export function findCity(query, records) {
  if (!query) return null;
  const parts = query.split(",").map((s) => s.trim()).filter(Boolean);
  const cityQ = (parts[0] || "").toLowerCase();
  const qualQ = (parts[1] || "").toLowerCase();
  if (!cityQ) return null;

  let matches = records.filter((r) => r.city.toLowerCase() === cityQ);
  if (qualQ) {
    matches = matches.filter(
      (r) =>
        (r.regionCode && r.regionCode.toLowerCase() === qualQ) ||
        (r.region && r.region.toLowerCase() === qualQ) ||
        (r.country && r.country.toLowerCase() === qualQ) ||
        (r.countryName && r.countryName.toLowerCase() === qualQ)
    );
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => (b.population || 0) - (a.population || 0));
  return matches[0];
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
