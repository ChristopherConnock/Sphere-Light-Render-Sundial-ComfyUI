import { test } from "node:test";
import assert from "node:assert/strict";
import { findCity, nearestCity, suggestCities } from "./geo.js";

const FIX = [
  { city: "Austin", regionCode: "TX", region: "Texas", country: "US", countryName: "United States", lat: 30.27, lng: -97.74, tz: "America/Chicago", population: 961855 },
  { city: "Austin", regionCode: "MN", region: "Minnesota", country: "US", countryName: "United States", lat: 43.67, lng: -92.97, tz: "America/Chicago", population: 24000 },
  { city: "Tokyo", regionCode: "13", region: "Tokyo", country: "JP", countryName: "Japan", lat: 35.68, lng: 139.65, tz: "Asia/Tokyo", population: 37000000 },
  { city: "London", regionCode: "ENG", region: "England", country: "GB", countryName: "United Kingdom", lat: 51.51, lng: -0.13, tz: "Europe/London", population: 8961989 },
  { city: "New York City", regionCode: "NY", region: "New York", country: "US", countryName: "United States", lat: 40.71, lng: -74.01, tz: "America/New_York", population: 8175133 },
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

test("prefix fallback resolves common short forms", () => {
  assert.equal(findCity("New York", FIX).city, "New York City");
  assert.equal(findCity("New York, NY", FIX).city, "New York City");
});

test("common country aliases resolve (UK, USA)", () => {
  assert.equal(findCity("London, UK", FIX).tz, "Europe/London");
  assert.equal(findCity("London, England", FIX).tz, "Europe/London");
  assert.equal(findCity("Austin, USA", FIX).regionCode, "TX"); // most populous Austin in US
});

test("suggestCities ranks matches and respects the limit", () => {
  const s = suggestCities("aus", FIX);
  assert.ok(s.length >= 2);
  assert.equal(s[0].city, "Austin");                 // prefix match surfaces
  assert.equal(s[0].regionCode, "TX");               // most populous Austin first
  assert.equal(suggestCities("aus", FIX, 1).length, 1); // limit honored
  assert.deepEqual(suggestCities("", FIX), []);      // empty query -> nothing
});

test("suggestCities filters by a typed qualifier", () => {
  const s = suggestCities("austin, mn", FIX);
  assert.equal(s[0].regionCode, "MN");
});

test("nearestCity returns the closest record", () => {
  assert.equal(nearestCity(30.3, -97.7, FIX).regionCode, "TX"); // near Austin, TX
  assert.equal(nearestCity(35.6, 139.7, FIX).city, "Tokyo");    // near Tokyo
});
