import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImageValue, cityStringFor, photoStatus } from "../js/photo.js";
import { findCity } from "../js/geo.js";

test("parseImageValue handles plain, subfolder, and annotated values", () => {
  assert.deepEqual(parseImageValue("photo.jpg"),
    { filename: "photo.jpg", subfolder: "", type: "input" });
  assert.deepEqual(parseImageValue("trip/day1/photo.jpg"),
    { filename: "photo.jpg", subfolder: "trip/day1", type: "input" });
  assert.deepEqual(parseImageValue("photo.jpg [output]"),
    { filename: "photo.jpg", subfolder: "", type: "output" });
  assert.deepEqual(parseImageValue("sub/photo.jpg [temp]"),
    { filename: "photo.jpg", subfolder: "sub", type: "temp" });
  assert.deepEqual(parseImageValue(""),
    { filename: "", subfolder: "", type: "input" });
});

const RECORDS = [
  { city: "Paris", region: "Île-de-France", regionCode: "11", country: "FR",
    countryName: "France", lat: 48.8534, lng: 2.3488, tz: "Europe/Paris", population: 2138551 },
  { city: "Versailles", region: "Île-de-France", regionCode: "11", country: "FR",
    countryName: "France", lat: 48.8047, lng: 2.1204, tz: "Europe/Paris", population: 85416 },
];

test("cityStringFor picks the nearest record and round-trips through findCity", () => {
  const s = cityStringFor(48.858, 2.294, RECORDS);
  assert.equal(s, "Paris, Île-de-France");
  assert.equal(findCity(s, RECORDS).city, "Paris");
});

test("cityStringFor returns empty string with no records", () => {
  assert.equal(cityStringFor(48.858, 2.294, []), "");
});

test("photoStatus reports everything found", () => {
  const s = photoStatus(
    { lat: 48.858222, lng: 2.2945, heading: 214.5,
      date: { year: 2023, month: 6, day: 21, hour: 14, minute: 30 } },
    "Paris, Île-de-France");
  assert.equal(s,
    "📷 48.86, 2.29 near Paris, Île-de-France · heading 214.50° · 2023-06-21 14:30");
});

test("photoStatus flags each gap explicitly", () => {
  const s = photoStatus({ lat: null, lng: null, heading: null, date: null }, "");
  assert.equal(s, "📷 ⚠ no GPS data · no heading tag · no date/time tag");
});

test("photoStatus with GPS but no city label still shows coordinates", () => {
  const s = photoStatus({ lat: 1.5, lng: -3.25, heading: 90, date: null }, "");
  assert.equal(s, "📷 1.50, -3.25 · heading 90.00° · no date/time tag");
});
