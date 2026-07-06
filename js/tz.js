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
  // Treat the wall time as if it were UTC, then subtract the zone's offset at
  // that instant. One correction is exact outside the ~1h DST transition window.
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}
