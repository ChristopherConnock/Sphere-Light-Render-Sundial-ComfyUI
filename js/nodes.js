import { app } from "../../scripts/app.js";
import { loadCities, nearestCity } from "./geo.js";
import { computeSunAngles } from "./sun.js";
import { createLocationSearch } from "./location_search.js";
import { createCompass } from "./compass.js";
import { nearestCityLabel } from "./status.js";
import { attachPreview, hideWidget, hookWidgets, addSerializedDOMWidget } from "./preview.js";

const getVal = (node, name, def) => {
  const w = node.widgets?.find((w) => w.name === name);
  return w ? parseFloat(w.value) : def;
};

// attachPreview() pushes the `_3d_preview` widget onto node.widgets before any
// of the DOM widgets below are created. TOP_WIDGETS_H() (preview.js) sums row
// heights only up to the first `_3d_preview` it finds, and LiteGraph draws
// widgets in array order — so a widget appended *after* `_3d_preview` is both
// left out of the height sum and drawn below/behind the preview square.
// Reinsert each new widget immediately before `_3d_preview` so it lands in the
// top (input) area, mirroring the splice sphere_widget.js does for its own
// DOM widgets (compass/location_search) relative to the same preview widget.
function moveBeforePreview(node, widget) {
  const ws = node.widgets;
  if (!ws || !widget) return;
  const pi = ws.findIndex((w) => w.name === "_3d_preview");
  const wi = ws.indexOf(widget);
  if (pi > -1 && wi > -1 && wi > pi) {
    ws.splice(wi, 1);
    ws.splice(pi, 0, widget);
  }
}

// A tiny read-only status line (DOM widget, not serialized).
function addStatus(node) {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "100%", boxSizing: "border-box", padding: "2px 12px",
    font: "12px sans-serif", color: "var(--descrip-text, #aaa)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  });
  const w = node.addDOMWidget?.("status", "status", el, {
    serialize: false, margin: 0,
    getHeight: () => 18, getMinHeight: () => 18, getMaxHeight: () => 18,
  });
  if (w) { w._slRowH = 18; moveBeforePreview(node, w); }
  return (text) => { el.textContent = text || ""; };
}

async function setupManual(node) {
  const getAngles = () => ({
    az: getVal(node, "rotation", 0),
    el: getVal(node, "elevation", 45),
    intensity: getVal(node, "intensity", 1.5),
  });
  const { render, scheduleRender, TOP_WIDGETS_H } = await attachPreview(node, getAngles);
  setTimeout(() => {
    hideWidget(node, "render_b64");
    hookWidgets(node, ["rotation", "elevation", "intensity"], scheduleRender);
    render();
    const w = Math.max(node.size?.[0] || 300, 280);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 100);
}

async function setupSun(node, mode) {
  let cities = null;
  let compass = null;
  let search = null;
  let setStatus = () => {};

  const getAngles = () => {
    const intensity = getVal(node, "intensity", 1.5);
    if (!cities) { setStatus(""); return { az: 0, el: 45, intensity }; }
    const heading = compass ? compass.getValue() : 0;
    const base = {
      year: getVal(node, "year", 2025), month: getVal(node, "month", 6),
      day: getVal(node, "day", 21), hour: getVal(node, "hour", 12),
      minute: getVal(node, "minute", 0), heading,
    };
    let params;
    if (mode === "city") {
      params = { ...base, location: search ? search.getText() : "" };
    } else {
      const lat = getVal(node, "latitude", 0), lng = getVal(node, "longitude", 0);
      params = { ...base, lat, lng };
    }
    const r = computeSunAngles(params, cities);

    let statusText = r.label || "";
    if (mode === "coords" && !r.error) {
      // Prefer the "near <city>" label over sun.js's raw "lat, lng (tz)" string.
      // computeSunAngles doesn't return the tz it resolved, so look it up the
      // same way it does internally (nearest listed city) instead of passing
      // `tz: undefined` into nearestCityLabel — that would render "· undefined".
      const rec = nearestCity(params.lat, params.lng, cities);
      const tz = rec ? rec.tz : "UTC";
      const near = nearestCityLabel({ lat: params.lat, lng: params.lng, tz }, cities);
      statusText = near.label + (r.belowHorizon ? ` — sun below horizon` : "");
    }
    setStatus(statusText);

    if (r.error) return { az: 0, el: 45, intensity };
    return { az: r.rotation, el: r.elevation, intensity };
  };

  const { render, scheduleRender, TOP_WIDGETS_H } = await attachPreview(node, getAngles);

  loadCities().then((c) => { cities = c; render(); })
              .catch((e) => console.warn("[SphereLight] cities.json failed:", e));

  setTimeout(() => {
    hideWidget(node, "render_b64");

    // Compass (serialized DOM widget; owns `heading` directly — "heading" isn't
    // declared in either sun node's INPUT_TYPES, so there is no native anchor).
    compass = createCompass({ label: "heading", initial: 0, onChange: () => scheduleRender() });
    const headingW = addSerializedDOMWidget(node, {
      name: "heading", element: compass.element, height: 72,
      getValue: () => compass.getValue(), setValue: (v) => compass.setValue(Number(v) || 0),
    });
    moveBeforePreview(node, headingW);

    if (mode === "city") {
      // Unlike `heading`, "city" *is* declared in the Sun (City) node's
      // INPUT_TYPES (the server receives it), so ComfyUI auto-adds a plain
      // native text widget for it. Hide that native widget — same pattern as
      // `render_b64` above — so only the searchable DOM widget (same name,
      // same serialized slot) is shown and drives the value.
      hideWidget(node, "city");
      search = createLocationSearch({
        label: "city", getRecords: () => cities || [], initial: "Austin, TX",
        onSelect: () => render(), onText: () => scheduleRender(),
      });
      const searchW = addSerializedDOMWidget(node, {
        name: "city", element: search.element, height: 32,
        getValue: () => search.getText(), setValue: (v) => search.setText(String(v ?? "")),
      });
      moveBeforePreview(node, searchW);
      hookWidgets(node, ["intensity", "year", "month", "day", "hour", "minute"], scheduleRender);
    } else {
      hookWidgets(node, ["intensity", "latitude", "longitude", "year", "month", "day", "hour", "minute"], scheduleRender);
    }

    setStatus = addStatus(node);
    render();
    const w = Math.max(node.size?.[0] || 320, 300);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 100);
}

app.registerExtension({
  name: "SphereLightSplitNodes",
  async nodeCreated(node) {
    if (node.comfyClass === "SphereLightManualNode") return setupManual(node);
    if (node.comfyClass === "SphereLightSunCityNode") return setupSun(node, "city");
    if (node.comfyClass === "SphereLightSunCoordsNode") return setupSun(node, "coords");
  },
});
