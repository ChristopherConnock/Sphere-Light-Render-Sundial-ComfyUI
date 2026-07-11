import { app } from "../../scripts/app.js";
import { loadCities, nearestCity } from "./geo.js";
import { computeSunAngles } from "./sun.js";
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

// If a positioning input is connected in the graph, follow the link to its
// source node and read the driven value client-side (a Primitive or other
// widget-backed source). Returns undefined when the input isn't connected or
// the value can't be resolved in the browser (e.g. a value computed mid-run by
// an upstream node — that's the documented unsupported case). A connected input
// wins over the on-node control; this is what makes params graph-driveable.
function connectedInputValue(node, name) {
  const slot = (node.inputs || []).findIndex((s) => s.name === name);
  if (slot < 0) return undefined;
  const inp = node.inputs[slot];
  if (inp.link == null) return undefined;
  const link = app.graph.links?.[inp.link];
  if (!link) return undefined;
  const origin = app.graph.getNodeById?.(link.origin_id);
  if (!origin) return undefined;
  // A PrimitiveNode adopts the target widget's name; other simple sources keep
  // their value in their first widget. Match by name, else fall back to it.
  const w = (origin.widgets || []).find((w) => w.name === name)
         || (origin.widgets || [])[0];
  return w ? w.value : undefined;
}

// A connected value only re-renders on connect and at queue time. So dragging
// the SOURCE's slider (e.g. a Primitive feeding intensity/heading) wouldn't move
// the preview — it looked dead even though the queued output was correct. Wrap
// the source node's widget callbacks (once) so changing its value re-renders
// every sphere-light node live.
function hookSourceWidgets(src) {
  if (!src || src._slSourceHooked || !src.widgets) return;
  src._slSourceHooked = true;
  for (const w of src.widgets) {
    const orig = w.callback;
    w.callback = function (...args) {
      const r = orig ? orig.apply(this, args) : undefined;
      for (const n of app.graph?._nodes || []) {
        if (typeof n._slRender === "function") { try { n._slRender(); } catch (e) {} }
      }
      return r;
    };
  }
}

// Hook the source behind every currently-connected positioning input (used on
// reload, where connections exist before onConnectionsChange ever fires).
function hookConnectedSources(node) {
  for (const inp of node.inputs || []) {
    if (inp.link == null) continue;
    const link = app.graph.links?.[inp.link];
    if (link) hookSourceWidgets(app.graph.getNodeById?.(link.origin_id));
  }
}

// attachPreview() pushes the `_3d_preview` widget onto node.widgets before the
// status widget below is created. TOP_WIDGETS_H() (preview.js) sums row
// heights only up to the first `_3d_preview` it finds, and LiteGraph draws
// widgets in array order — so a widget appended *after* `_3d_preview` is both
// left out of the height sum and drawn below/behind the preview square.
// Reinsert each new widget immediately before `_3d_preview` so it lands in the
// top (input) area.
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
  // A connected input wins over the widget; else the widget drives (as before).
  const getAngles = () => {
    const num = (name, d) => {
      const c = connectedInputValue(node, name);
      return c != null ? parseFloat(c) : getVal(node, name, d);
    };
    return {
      az: num("rotation", 0),
      el: num("elevation", 45),
      intensity: num("intensity", 1.5),
    };
  };
  const { render, scheduleRender, TOP_WIDGETS_H } = await attachPreview(node, getAngles);
  node._slRender = render;   // queue-time refresh + connection-change re-render

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
  let setStatus = () => {};

  // A connected input wins over the widget; else the widget drives (as before).
  const getAngles = () => {
    const num = (name, d) => {
      const c = connectedInputValue(node, name);
      return c != null ? parseFloat(c) : getVal(node, name, d);
    };
    const str = (name, d) => {
      const c = connectedInputValue(node, name);
      return c != null ? String(c) : getStr(node, name, d);
    };
    const intensity = num("intensity", 1.5);
    if (!cities) { setStatus(""); return { az: 0, el: 45, intensity }; }
    const heading = num("heading", 0);
    node._slHeading = heading;   // preview.js draws the passive compass overlay
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

  const { render, scheduleRender, TOP_WIDGETS_H } = await attachPreview(node, getAngles);
  node._slRender = render;   // queue-time refresh + connection-change re-render

  loadCities().then((c) => { cities = c; render(); })
              .catch((e) => console.warn("[SphereLight] cities.json failed:", e));

  const watched = mode === "city"
    ? ["intensity", "city", "year", "month", "day", "hour", "minute", "heading"]
    : ["intensity", "latitude", "longitude", "year", "month", "day", "hour", "minute", "heading"];

  setTimeout(() => {
    hideWidget(node, "render_b64");
    hookWidgets(node, watched, scheduleRender);
    setStatus = addStatus(node);
    render();
    const w = Math.max(node.size?.[0] || 320, 300);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 100);
  setTimeout(() => {
    hideWidget(node, "render_b64");
    const w = Math.max(node.size?.[0] || 320, 300);
    node.setSize([w, TOP_WIDGETS_H() + (w - 24) + 16]);
  }, 700);
}

app.registerExtension({
  name: "SphereLight.Nodes",
  async nodeCreated(node) {
    let setup;
    if (node.comfyClass === "SphereLightManualNode") setup = setupManual(node);
    else if (node.comfyClass === "SphereLightSunCityNode") setup = setupSun(node, "city");
    else if (node.comfyClass === "SphereLightSunCoordsNode") setup = setupSun(node, "coords");
    else return;
    // Re-render when an input is connected/disconnected so the preview (and
    // render_b64) immediately reflects a newly driven — or released — value, and
    // start tracking the newly-connected source's live value changes.
    const origOCC = node.onConnectionsChange;
    node.onConnectionsChange = function (type, slotIndex, isConnected, linkInfo, ioSlot) {
      origOCC?.apply(this, arguments);
      if (node._slRender) setTimeout(() => node._slRender(), 0);
      if (isConnected && type === LiteGraph.INPUT && linkInfo) {
        hookSourceWidgets(app.graph.getNodeById?.(linkInfo.origin_id));
      }
    };
    // Existing connections (e.g. after a reload) predate the handler above.
    setTimeout(() => hookConnectedSources(node), 900);
    return setup;
  },
});
