import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSunAngles } from "../js/sun.js";

const FIX = [
  { city: "Austin", regionCode: "TX", region: "Texas", country: "US", countryName: "United States", lat: 30.27, lng: -97.74, tz: "America/Chicago", population: 961855 },
];

// Same mapping doRender() uses: light X uses sin(az), Z uses cos(az), Y uses sin(el).
test("morning sun places the light to the east (+X) and above (+Y)", () => {
  const { rotation, elevation } = computeSunAngles(
    { location: "Austin, TX", year: 2023, month: 6, day: 21, hour: 8, minute: 0, heading: 0 }, FIX);
  const az = rotation * Math.PI / 180, el = elevation * Math.PI / 180;
  const x = Math.cos(el) * Math.sin(az);
  const y = Math.sin(el);
  assert.ok(x > 0, `light X should be east/+, got ${x}`);
  assert.ok(y > 0, `light Y should be above horizon, got ${y}`);
});
