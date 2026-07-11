import { test } from "node:test";
import assert from "node:assert/strict";
import { dmsToDeg, parseTiff } from "../js/exif.js";
import { buildTiff } from "./helpers/tiff.js";

test("dmsToDeg converts DMS and applies hemisphere sign", () => {
  assert.ok(Math.abs(dmsToDeg([48, 51, 29.6], "N") - 48.858222) < 1e-4);
  assert.ok(Math.abs(dmsToDeg([48, 51, 29.6], "S") + 48.858222) < 1e-4);
  assert.ok(dmsToDeg([2, 17, 40.2], "W") < 0);
  assert.ok(dmsToDeg([2, 17, 40.2], "E") > 0);
});

const PARIS = {
  lat: [48, 51, 29.6], latRef: "N",
  lng: [2, 17, 40.2], lngRef: "E",
  heading: 214.5, dateTime: "2023:06:21 14:30:00",
};

test("parseTiff reads GPS, heading, and date (little-endian)", () => {
  const r = parseTiff(buildTiff(PARIS));
  assert.ok(Math.abs(r.lat - 48.858222) < 1e-4);
  assert.ok(Math.abs(r.lng - 2.294500) < 1e-4);
  assert.ok(Math.abs(r.heading - 214.5) < 1e-6);
  assert.deepEqual(r.date, { year: 2023, month: 6, day: 21, hour: 14, minute: 30 });
});

test("parseTiff reads big-endian TIFF", () => {
  const r = parseTiff(buildTiff({ ...PARIS, littleEndian: false }));
  assert.ok(Math.abs(r.lat - 48.858222) < 1e-4);
  assert.ok(Math.abs(r.heading - 214.5) < 1e-6);
  assert.deepEqual(r.date, { year: 2023, month: 6, day: 21, hour: 14, minute: 30 });
});

test("southern/western hemisphere comes out negative", () => {
  const r = parseTiff(buildTiff({
    lat: [33, 52, 4], latRef: "S", lng: [151, 12, 26], lngRef: "W",
  }));
  assert.ok(r.lat < 0);
  assert.ok(r.lng < 0);
});

test("missing tags yield nulls, present ones still parse", () => {
  const r = parseTiff(buildTiff({ heading: 90 }));
  assert.equal(r.lat, null);
  assert.equal(r.lng, null);
  assert.equal(r.date, null);
  assert.ok(Math.abs(r.heading - 90) < 1e-6);
  const empty = parseTiff(buildTiff({}));
  assert.deepEqual(empty, { lat: null, lng: null, heading: null, date: null });
});

test("parseTiff throws on non-TIFF bytes (caller catches)", () => {
  assert.throws(() => parseTiff(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])));
});
