import { test } from "node:test";
import assert from "node:assert/strict";
import { getVal, getStr, isLinkedToSource } from "../js/widgets.js";

const node = (widgets) => ({ widgets });

test("getVal parses the named widget's value as a number", () => {
  assert.equal(getVal(node([{ name: "rotation", value: "12.5" }]), "rotation", 0), 12.5);
  assert.equal(getVal(node([{ name: "rotation", value: 90 }]), "rotation", 0), 90);
});

test("getVal falls back to the default when the widget is missing", () => {
  assert.equal(getVal(node([]), "rotation", 45), 45);
  assert.equal(getVal({}, "rotation", 45), 45);
});

test("getVal falls back to the default when the value isn't a finite number", () => {
  assert.equal(getVal(node([{ name: "rotation", value: "garbage" }]), "rotation", 45), 45);
  assert.equal(getVal(node([{ name: "rotation", value: "" }]), "rotation", 45), 45);
  assert.equal(getVal(node([{ name: "rotation", value: null }]), "rotation", 45), 45);
});

test("getStr returns the named widget's value as a string", () => {
  assert.equal(getStr(node([{ name: "city", value: "Austin, TX" }]), "city", ""), "Austin, TX");
  assert.equal(getStr(node([{ name: "city", value: 7 }]), "city", ""), "7");
});

test("getStr falls back to the default when the widget is missing", () => {
  assert.equal(getStr(node([]), "city", "London"), "London");
});

test("isLinkedToSource is true only for nodes wired to that source", () => {
  const links = { 5: { origin_id: 42 }, 6: { origin_id: 99 } };
  const wired    = { inputs: [{ name: "heading", link: 5 }] };
  const other    = { inputs: [{ name: "heading", link: 6 }] };
  const unwired  = { inputs: [{ name: "heading", link: null }] };
  const noInputs = {};
  assert.equal(isLinkedToSource(wired, 42, links), true);
  assert.equal(isLinkedToSource(other, 42, links), false);
  assert.equal(isLinkedToSource(unwired, 42, links), false);
  assert.equal(isLinkedToSource(noInputs, 42, links), false);
  assert.equal(isLinkedToSource(wired, 42, undefined), false);
});
