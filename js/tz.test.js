import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedWallTimeToUTC } from "./tz.js";

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
