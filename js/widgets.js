// Pure widget/graph helpers for nodes.js, kept free of any ComfyUI (`app`)
// import so they stay unit-testable under `node --test` (same convention as
// light.js). Unit tests: tests/widgets.test.js.

// The named widget's value as a number; the default covers a missing widget
// AND an unparseable value — a widget holding garbage must not leak NaN into
// the light math (lightPosition(NaN) renders a black preview).
export function getVal(node, name, def) {
  const w = node.widgets?.find((w) => w.name === name);
  if (!w) return def;
  const v = parseFloat(w.value);
  return Number.isFinite(v) ? v : def;
}

export function getStr(node, name, def) {
  const w = node.widgets?.find((w) => w.name === name);
  return w ? String(w.value) : def;
}

// Whether any of the node's inputs is fed by the source node with id `srcId`.
// Used to scope live re-renders: when a source widget changes, only the
// sphere nodes actually wired to it re-render — and a node hooked once but
// since disconnected triggers nothing.
export function isLinkedToSource(node, srcId, links) {
  return (node.inputs || []).some(
    (inp) => inp.link != null && links?.[inp.link]?.origin_id === srcId
  );
}
