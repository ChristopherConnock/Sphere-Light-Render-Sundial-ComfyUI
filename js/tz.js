// Timezone math using the browser/Node-native Intl API (full ICU). No library.

export function zoneOffsetMs(instant, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - instant.getTime();
}

export function zonedWallTimeToUTC(year, month, day, hour, minute, timeZone) {
  // Treat the wall time as if it were UTC, then subtract the zone's offset.
  // A second pass recomputes the offset at the first-pass instant so times in
  // the multi-hour window around a DST transition resolve to the correct side.
  // The only irreducible ambiguity is the ~1h nonexistent/repeated wall-clock
  // hour at the transition itself.
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = guess - zoneOffsetMs(new Date(guess), timeZone);
  utc = guess - zoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}
