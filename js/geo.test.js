import { test } from "node:test";
import assert from "node:assert/strict";
import { findCity } from "./geo.js";

const FIX = [
  { city: "Austin", regionCode: "TX", region: "Texas", country: "US", countryName: "United States", lat: 30.27, lng: -97.74, tz: "America/Chicago", population: 961855 },
  { city: "Austin", regionCode: "MN", region: "Minnesota", country: "US", countryName: "United States", lat: 43.67, lng: -92.97, tz: "America/Chicago", population: 24000 },
  { city: "Tokyo", regionCode: "13", region: "Tokyo", country: "JP", countryName: "Japan", lat: 35.68, lng: 139.65, tz: "Asia/Tokyo", population: 37000000 },
];

test("matches city + state code", () => {
  assert.equal(findCity("Austin, TX", FIX).region, "Texas");
});

test("bare city returns most populous", () => {
  assert.equal(findCity("Austin", FIX).regionCode, "TX");
});

test("matches city + country name", () => {
  assert.equal(findCity("Tokyo, Japan", FIX).tz, "Asia/Tokyo");
});

test("case-insensitive", () => {
  assert.equal(findCity("austin, texas", FIX).regionCode, "TX");
});

test("no match returns null", () => {
  assert.equal(findCity("Nowhere, ZZ", FIX), null);
});
