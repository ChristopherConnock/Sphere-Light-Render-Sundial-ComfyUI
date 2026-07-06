import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSunAngles, normalizeDeg180 } from "./sun.js";

const FIX = [
  { city: "Austin", regionCode: "TX", region: "Texas", country: "US", countryName: "United States", lat: 30.27, lng: -97.74, tz: "America/Chicago", population: 961855 },
];

test("normalizeDeg180 wraps", () => {
  assert.equal(normalizeDeg180(190), -170);
  assert.equal(normalizeDeg180(-190), 170);
  assert.equal(normalizeDeg180(45), 45);
});

test("Austin summer morning: sun up and to the east", () => {
  const r = computeSunAngles(
    { location: "Austin, TX", year: 2023, month: 6, day: 21, hour: 8, minute: 0, heading: 0 },
    FIX
  );
  assert.equal(r.belowHorizon, false);
  assert.ok(r.elevation > 10 && r.elevation < 55, `elevation ${r.elevation}`);
  assert.ok(r.rotation > 40 && r.rotation < 130, `rotation ${r.rotation}`);
  assert.equal(r.matched.regionCode, "TX");
});

test("heading rotates the sun in the scene frame", () => {
  const base = computeSunAngles({ location: "Austin, TX", year: 2023, month: 6, day: 21, hour: 8, minute: 0, heading: 0 }, FIX);
  const turned = computeSunAngles({ location: "Austin, TX", year: 2023, month: 6, day: 21, hour: 8, minute: 0, heading: 90 }, FIX);
  assert.ok(Math.abs(normalizeDeg180(base.rotation - turned.rotation - 90)) < 0.001);
});

test("pre-dawn: below horizon, elevation clamped to 0", () => {
  const r = computeSunAngles({ location: "Austin, TX", year: 2023, month: 6, day: 21, hour: 2, minute: 0, heading: 0 }, FIX);
  assert.equal(r.belowHorizon, true);
  assert.equal(r.elevation, 0);
});

test("unknown city with no manual lat/lng returns error", () => {
  const r = computeSunAngles({ location: "Nowhere, ZZ", year: 2023, month: 6, day: 21, hour: 8, minute: 0 }, FIX);
  assert.equal(r.error, "city_not_found");
});

test("manual lat/lng fallback when city not found", () => {
  const r = computeSunAngles(
    { location: "", lat: 30.27, lng: -97.74, tz: "America/Chicago", year: 2023, month: 6, day: 21, hour: 8, minute: 0, heading: 0 },
    FIX
  );
  assert.equal(r.error, undefined);
  assert.ok(r.elevation > 10);
});
