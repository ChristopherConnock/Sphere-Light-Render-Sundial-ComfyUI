import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedWallTimeToUTC } from "../js/tz.js";

test("summer wall time uses DST offset (EDT = UTC-4)", () => {
  const d = zonedWallTimeToUTC(2023, 7, 4, 12, 0, "America/New_York");
  assert.equal(d.getUTCHours(), 16);
});

test("winter wall time uses standard offset (EST = UTC-5)", () => {
  const d = zonedWallTimeToUTC(2023, 1, 15, 12, 0, "America/New_York");
  assert.equal(d.getUTCHours(), 17);
});

test("half-hour zone (India = UTC+5:30)", () => {
  const d = zonedWallTimeToUTC(2023, 1, 15, 12, 0, "Asia/Kolkata");
  assert.equal(d.getUTCHours(), 6);
  assert.equal(d.getUTCMinutes(), 30);
});

test("DST spring-forward morning resolves to correct UTC (EDT)", () => {
  // 2023-03-12 clocks jump 2:00->3:00; 03:00 local is EDT (UTC-4) -> 07:00 UTC
  const d = zonedWallTimeToUTC(2023, 3, 12, 3, 0, "America/New_York");
  assert.equal(d.getUTCHours(), 7);
});

test("DST spring-forward later morning (EDT)", () => {
  const d = zonedWallTimeToUTC(2023, 3, 12, 5, 0, "America/New_York");
  assert.equal(d.getUTCHours(), 9);
});

test("DST fall-back morning resolves to correct UTC (EST)", () => {
  // 2023-11-05 clocks fall 2:00->1:00; 03:00 local is EST (UTC-5) -> 08:00 UTC
  const d = zonedWallTimeToUTC(2023, 11, 5, 3, 0, "America/New_York");
  assert.equal(d.getUTCHours(), 8);
});
