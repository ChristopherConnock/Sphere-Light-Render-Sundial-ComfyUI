import { test } from "node:test";
import assert from "node:assert/strict";
import { pointerToHeading } from "./compass.js";

test("cardinal points map to compass bearings (N up, clockwise)", () => {
  assert.equal(pointerToHeading(50, 50, 50, 10), 0);   // up    -> N
  assert.equal(pointerToHeading(50, 50, 90, 50), 90);  // right -> E
  assert.equal(pointerToHeading(50, 50, 50, 90), 180); // down  -> S
  assert.equal(pointerToHeading(50, 50, 10, 50), 270); // left  -> W
});

test("diagonal up-right is NE (45)", () => {
  assert.equal(pointerToHeading(50, 50, 90, 10), 45);
});

test("result is always normalized to [0,360)", () => {
  const h = pointerToHeading(50, 50, 10, 90); // down-left -> SW ~225
  assert.ok(h >= 0 && h < 360);
  assert.equal(h, 225);
});

test("dead center returns null (no direction)", () => {
  assert.equal(pointerToHeading(50, 50, 50, 50), null);
});
