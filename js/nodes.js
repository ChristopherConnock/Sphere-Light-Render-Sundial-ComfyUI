import { app } from "../../scripts/app.js";
import { loadCities, nearestCity } from "./geo.js";
import { computeSunAngles } from "./sun.js";
import { createLocationSearch, formatLabel } from "./location_search.js";
import { createCompass } from "./compass.js";
import { nearestCityLabel } from "./status.js";
import { attachPreview, hideWidget, hookWidgets } from "./preview.js";

const getVal = (node, name, def) => {
  const w = node.widgets?.find((w) => w.name === name);
  return w ? parseFloat(w.value) : def;
};

const getStr = (node, name, def) => {
  const w = node.widgets?.find((w) => w.name === name);
  return w ? String(w.value) : def;
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
  // `pushed` (driven mode) supplies graph-resolved values; without it we read the
  // widgets exactly as before. `num` picks pushed[name] when present, else widget.
  const getAngles = (pushed) => {
    const num = (name, d) => pushed && pushed[name] != null ? parseFloat(pushed[name]) : getVal(node, name, d);
    return {
      az: num("rotation", 0),
      el: num("elevation", 45),
      intensity: num("intensity", 1.5),
    };
  };
  const { render, scheduleRender, renderWith, TOP_WIDGETS_H } = await attachPreview(node, getAngles);

  // Driven mode: driven.js calls reflect() to mirror pushed values onto the
  // widgets, then renderWith() to render off-screen from those same values.
  node._slDriven = {
    renderWith,
    reflect: (p) => {
      for (const name of ["rotation", "elevation", "intensity"]) {
        if (p[name] == null) continue;
        const w = node.widgets?.find((w) => w.name === name);
        if (w) w.value = p[name];
      }
      app.graph.setDirtyCanvas(true, false);
    },
  };

  setTimeout(() => {
    hideWidget(node, "render_b64");
    hookWidgets(node, ["rotation", "elevation", "intensity"], scheduleRender);
    render();
    const w = Math.max(node.size?.[0] || 300, 280);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 100);
  setTimeout(() => {
    hideWidget(node, "render_b64");
    const w = Math.max(node.size?.[0] || 300, 280);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 700);
}

async function setupSun(node, mode) {
  let cities = null;
  let compass = null;
  let search = null;
  let setStatus = () => {};

  // `pushed` (driven mode) supplies graph-resolved values; without it we read the
  // widgets exactly as before. num/str pick pushed[name] when present, else widget.
  const getAngles = (pushed) => {
    const num = (name, d) => pushed && pushed[name] != null ? parseFloat(pushed[name]) : getVal(node, name, d);
    const str = (name, d) => pushed && pushed[name] != null ? String(pushed[name]) : getStr(node, name, d);
    const intensity = num("intensity", 1.5);
    if (!cities) { setStatus(""); return { az: 0, el: 45, intensity }; }
    const heading = num("heading", 0);
    const base = {
      year: num("year", 2025), month: num("month", 6),
      day: num("day", 21), hour: num("hour", 12),
      minute: num("minute", 0), heading,
    };
    let params;
    if (mode === "city") {
      params = { ...base, location: str("city", "") };
    } else {
      const lat = num("latitude", 0), lng = num("longitude", 0);
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

  const { render, scheduleRender, renderWith, TOP_WIDGETS_H } = await attachPreview(node, getAngles);

  // Driven mode: driven.js calls reflect() to mirror pushed values onto the
  // controls (compass needle, city field, native widgets), then renderWith() to
  // render off-screen from those same values. heading/city go through the DOM
  // overlays; the rest are plain native widgets. Compass/search may not exist
  // yet (created in the setTimeout below) — the guards handle that.
  node._slDriven = {
    renderWith,
    reflect: (p) => {
      if (p.heading != null && node._slCompass) node._slCompass.setValue(parseFloat(p.heading));
      if (p.city != null && node._slSearch) node._slSearch.setText(String(p.city));
      for (const name of ["intensity", "latitude", "longitude", "year", "month", "day", "hour", "minute"]) {
        if (p[name] == null) continue;
        const w = node.widgets?.find((w) => w.name === name);
        if (w) w.value = p[name];
      }
      app.graph.setDirtyCanvas(true, false);
    },
  };

  loadCities().then((c) => { cities = c; render(); })
              .catch((e) => console.warn("[SphereLight] cities.json failed:", e));

  setTimeout(() => {
    hideWidget(node, "render_b64");

    // Compass (native-anchor pattern, matching the kitchen-sink node in
    // sphere_widget.js): the hidden native `heading` widget is the value
    // that gets serialized into widgets_values; the compass DOM overlay
    // seeds from it and writes back into it on every change. A serialize:true
    // DOM widget was tried first but does not survive save/reload — it's
    // created in this post-nodeCreated setTimeout, so it's absent when
    // ComfyUI replays widgets_values on load.
    const headingW = node.widgets.find((w) => w.name === "heading");
    compass = createCompass({
      label:    "heading",
      initial:  parseFloat(headingW.value) || 0,
      onChange: (deg) => { headingW.value = deg; scheduleRender(); },
    });
    node._slCompass = compass;
    const compassW = node.addDOMWidget("compass", "compass", compass.element, {
      serialize: false, margin: 0,
      getHeight: () => 72, getMinHeight: () => 72, getMaxHeight: () => 72,
    });
    compassW._slRowH = 72;
    hideWidget(node, "heading");
    moveBeforePreview(node, compassW);

    if (mode === "city") {
      // City search: same native-anchor pattern, mirroring `location_search`
      // in sphere_widget.js. The DOM widget name ("city_search") is distinct
      // from the native anchor ("city") it seeds from and writes into.
      const cityW = node.widgets.find((w) => w.name === "city");
      search = createLocationSearch({
        label:      "city",
        getRecords: () => cities || [],
        initial:    String(cityW.value ?? ""),
        onSelect:   (rec) => { cityW.value = formatLabel(rec); render(); },
        onText:     (t)   => { cityW.value = t; scheduleRender(); },
      });
      node._slSearch = search;
      const searchW = node.addDOMWidget("city_search", "city_search", search.element, {
        serialize: false, margin: 0,
        getHeight: () => 32, getMinHeight: () => 32, getMaxHeight: () => 32,
      });
      searchW._slRowH = 32;
      hideWidget(node, "city");
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
  setTimeout(() => {
    hideWidget(node, "render_b64");
    hideWidget(node, "heading");
    if (mode === "city") hideWidget(node, "city");
    const w = Math.max(node.size?.[0] || 320, 300);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 700);
}

app.registerExtension({
  name: "SphereLightSplitNodes",
  async nodeCreated(node) {
    if (node.comfyClass === "SphereLightManualNode") return setupManual(node);
    if (node.comfyClass === "SphereLightSunCityNode") return setupSun(node, "city");
    if (node.comfyClass === "SphereLightSunCoordsNode") return setupSun(node, "coords");
  },
});
