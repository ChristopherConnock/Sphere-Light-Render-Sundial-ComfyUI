import { app } from "../../scripts/app.js";
import { loadCities } from "./geo.js";
import { computeSunAngles } from "./sun.js";
import { createLocationSearch, formatLabel } from "./location_search.js";
import { pickSunSource, visibleWidgets } from "./mode.js";
import { createCompass } from "./compass.js";

// Vendored locally (was cdnjs) so the node works offline / air-gapped and
// isn't exposed to a third-party CDN being compromised. Resolved relative to
// this module's own URL, so it loads wherever ComfyUI serves the extension.
const THREE_CDN = new URL("./three.min.js", import.meta.url).href;

function loadThree() {
  return new Promise((res, rej) => {
    if (window.THREE) return res();
    const s = document.createElement("script");
    s.src = THREE_CDN;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function buildScene() {
  const R = window.THREE;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const renderer = new R.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = R.PCFSoftShadowMap;
  renderer.setSize(512, 512, false);
  renderer.setClearColor(0x8a8a8a);
  renderer.outputEncoding = R.sRGBEncoding;

  const scene = new R.Scene();
  scene.background = new R.Color(0x8a8a8a);

  const camera = new R.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 6, 8);
  camera.lookAt(0, -0.5, 0);

  const plane = new R.Mesh(
    new R.PlaneGeometry(100, 100),
    new R.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1, metalness: 0 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1;
  plane.receiveShadow = true;
  scene.add(plane);

  const sphere = new R.Mesh(
    new R.SphereGeometry(1, 64, 64),
    new R.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0 })
  );
  sphere.position.y = 0;
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  scene.add(sphere);

  scene.add(new R.AmbientLight(0xffffff, 0.2));

  const dirLight = new R.DirectionalLight(0xffffff, 1.5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near   = 0.1;
  dirLight.shadow.camera.far    = 50;
  dirLight.shadow.camera.left   = -8;
  dirLight.shadow.camera.right  =  8;
  dirLight.shadow.camera.top    =  8;
  dirLight.shadow.camera.bottom = -8;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.radius = 2;
  scene.add(dirLight);

  return { renderer, scene, camera, dirLight, canvas };
}

app.registerExtension({
  name: "SphereLightRender",

  async nodeCreated(node) {
    if (node.comfyClass !== "SphereLightNode") return;

    await loadThree();

    const ctx = buildScene();
    node._slCtx    = ctx;
    node._slCanvas = ctx.canvas;
    node._slReady  = false;

    node._slCities = null;
    loadCities().then((c) => { node._slCities = c; doRender(); })
                .catch((e) => console.warn("[SphereLight] cities.json failed:", e));

    // Returns the sun angles to render, honoring sun_mode + location_mode.
    const getAngles = () => {
      const intensity = getVal("intensity", 1.5);
      const src = pickSunSource({
        sunMode:      getStr("sun_mode", "manual"),
        locationMode: getStr("location_mode", "city"),
        location:     getStr("location", ""),
        lat:          getVal("latitude", 0),
        lng:          getVal("longitude", 0),
      });
      if (!src || !node._slCities) {
        node._slStatus = "";
        return { az: getVal("rotation", 0), el: getVal("elevation", 45), intensity };
      }
      const r = computeSunAngles({
        location: src.location, lat: src.lat, lng: src.lng,
        year: getVal("year", 2025), month: getVal("month", 6), day: getVal("day", 21),
        hour: getVal("hour", 12), minute: getVal("minute", 0), heading: getVal("heading", 0),
      }, node._slCities);
      node._slStatus = r.label || "";
      if (r.error) {
        // Couldn't resolve — keep the manual sliders driving the light.
        return { az: getVal("rotation", 0), el: getVal("elevation", 45), intensity };
      }
      return { az: r.rotation, el: r.elevation, intensity };
    };

    const getVal = (name, def) => {
      const w = node.widgets?.find(w => w.name === name);
      return w ? parseFloat(w.value) : def;
    };

    const getStr = (name, def) => {
      const w = node.widgets?.find((w) => w.name === name);
      return w ? String(w.value) : def;
    };


    const doRender = () => {
      const { az: azDeg, el: elDeg, intensity } = getAngles();
      const az = azDeg * Math.PI / 180;
      const el = elDeg * Math.PI / 180;
      const r  = 10;
      ctx.dirLight.position.set(
        r * Math.cos(el) * Math.sin(az),
        r * Math.sin(el),
        r * Math.cos(el) * Math.cos(az)
      );
      ctx.dirLight.intensity = intensity;
      ctx.renderer.shadowMap.needsUpdate = true;
      ctx.renderer.render(ctx.scene, ctx.camera);
      node._slReady = true;
      const b64 = ctx.canvas.toDataURL("image/png");
      const wb  = node.widgets?.find(w => w.name === "render_b64");
      if (wb) wb.value = b64;
      app.graph.setDirtyCanvas(true, false);
      // v2 (Vue nodes) draws the preview via a legacy-widget canvas that only
      // repaints when told to. setDirtyCanvas doesn't reach it, so a city pick
      // (which re-renders off-canvas) wouldn't show until some native widget
      // changed. triggerDraw (set by the v2 WidgetLegacy host) forces it; it's
      // undefined on v1, where setDirtyCanvas already repaints.
      previewWidget.triggerDraw?.();
    };

    let debTimer = null;
    const debounced = () => { clearTimeout(debTimer); debTimer = setTimeout(doRender, 80); };

    // Toggleable widgets by their node.widgets `name` ("location_search" and
    // "compass" are the DOM widgets). Always-on (sun_mode, intensity) and
    // always-off (render_b64, native location/heading) are not listed.
    const TOGGLEABLE = [
      "rotation", "elevation", "location_mode", "location_search",
      "latitude", "longitude", "year", "month", "day", "hour", "minute", "compass",
    ];

    // Show/hide a widget. In the current ComfyUI frontend, layout inclusion is
    // governed ONLY by the `hidden` boolean — LGraphNode.getLayoutWidgets()
    // filters `!w.hidden`, and drawWidgets() skips it. The old
    // `type="hidden"`/`computeSize=[0,0]` trick does NOT remove a native
    // widget's row (it leaves a blank gap). `options.hidden` covers the Vue
    // renderer. Works for native and DOM widgets alike — the frontend hides a
    // hidden DOM widget's element itself (v-show), so we don't touch the element.
    const setWidgetVisible = (w, visible) => {
      if (!w) return;
      w.hidden = !visible;
      (w.options ??= {}).hidden = !visible;
    };

    const applyVisibility = () => {
      // Keep the current preview size; only the top (widget) area changes height.
      const side = Math.max(node.size[1] - TOP_WIDGETS_H() - 16, 120);
      const show = new Set(visibleWidgets({
        sunMode:      getStr("sun_mode", "manual"),
        locationMode: getStr("location_mode", "city"),
      }));
      for (const name of TOGGLEABLE) {
        setWidgetVisible(node.widgets?.find((w) => w.name === name), show.has(name));
      }
      // arrange() only ever grows the node, so shrink it explicitly — otherwise
      // hiding widgets leaves the node tall with a blank gap.
      node.setSize([node.size[0], TOP_WIDGETS_H() + side + 16]);
      app.graph.setDirtyCanvas(true, true);
      // Align our DOM labels once the (now-visible) widgets are mounted. Only in
      // date/time mode — in manual, the search/compass are unmounted (v2 v-if).
      if (getStr("sun_mode", "manual") === "date/time") trySyncLabels();
    };

    const hookSliders = () => {
      ["rotation", "elevation", "intensity",
       "sun_mode", "location_mode", "location", "latitude", "longitude",
       "year", "month", "day", "hour", "minute", "heading"
      ].forEach(name => {
        const w = node.widgets?.find(w => w.name === name);
        if (!w || w._slHooked) return;
        w._slHooked = true;
        const orig = w.callback;
        w.callback = function(v, ...args) {
          orig?.call(this, v, ...args);
          if (name === "sun_mode" || name === "location_mode") applyVisibility();
          debounced();
        };
      });
    };

    const hideB64Widget = () => {
      const wb = node.widgets?.find(w => w.name === "render_b64");
      if (!wb || wb._hidden) return;
      wb._hidden = true;
      wb.hidden = true;
      (wb.options ??= {}).hidden = true;
    };

    const TOP_WIDGETS_H = () => {
      let h = LiteGraph.NODE_TITLE_HEIGHT + 8;
      for (const w of node.widgets ?? []) {
        if (w.name === "_3d_preview") break;
        if (w.hidden) continue;
        // DOM widgets size via computeLayoutSize (not computeSize); we pin their
        // row height in _slRowH so the preview below them is placed correctly.
        const wh = w._slRowH ?? (w.computeSize
          ? w.computeSize(node.size[0])[1]
          : LiteGraph.NODE_WIDGET_HEIGHT);
        h += wh + 4;
      }
      return h;
    };

    const getPreviewRect = () => {
      const nodeW  = node.size[0];
      const nodeH  = node.size[1];
      const topH   = TOP_WIDGETS_H();
      const availW = nodeW - 24;
      const availH = nodeH - topH - 16;
      const side   = Math.max(Math.min(availW, availH), 20);
      const x      = (nodeW - side) / 2;
      return { x, y: topH, side };
    };

    const previewWidget = {
      name:      "_3d_preview",
      type:      "3d_preview",
      value:     null,
      serialize: false,
      options:   { serialize: false },

      computeSize(nw) {
        const side = Math.min(nw - 24, node.size[1] - TOP_WIDGETS_H() - 16);
        return [nw - 12, Math.max(side, 20)];
      },

      draw(ctx2d, node, widget_width, y) {
        if (!node._slReady || !node._slCanvas) return;
        const { x, side } = getPreviewRect();
        ctx2d.save();
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, side, side, 8);
        ctx2d.clip();
        ctx2d.drawImage(node._slCanvas, x, y, side, side);
        ctx2d.restore();
      },
    };

    node.widgets = node.widgets || [];
    node.widgets.push(previewWidget);

    node.onRemoved = function() {
      // dispose() frees GL resources; forceContextLoss() releases the WebGL
      // context itself (browsers cap ~16), so many nodes don't exhaust them.
      this._slCtx?.renderer?.dispose();
      this._slCtx?.renderer?.forceContextLoss?.();
      this._slSearch?.destroy?.();   // removes the body-attached suggestion menu
      this._slCompass?.destroy?.();
      this._slCtx    = null;
      this._slCanvas = null;
    };

    node.onResize = function(size) {
      const minH = TOP_WIDGETS_H() + 60 + 16;
      if (size[1] < minH) size[1] = minH;
      app.graph.setDirtyCanvas(true, false);
    };

    // Progressive enhancement: swap the plain location text field for a
    // searchable city dropdown when the DOM-widget API is available; falls back
    // silently to the text field otherwise. The search writes into the (hidden)
    // serialized `location` widget, so the resolve pipeline is unchanged.
    const setupLocationSearch = () => {
      if (node._slSearch || typeof node.addDOMWidget !== "function") return;
      const locW = node.widgets?.find((w) => w.name === "location");
      if (!locW) return;
      try {
        const search = createLocationSearch({
          label:      "location",   // DOM widgets have no built-in label; render our own
          getRecords: () => node._slCities || [],
          initial:    String(locW.value ?? ""),
          onSelect:   (rec) => { locW.value = formatLabel(rec); doRender(); },
          onText:     (t)   => { locW.value = t; debounced(); },
        });
        node._slSearch = search;
        // margin:0 + the element's own 15px padding aligns it with native
        // widgets (whose margin is 15, vs the DOM-widget default of 10).
        const w = node.addDOMWidget("location_search", "location_search",
                                    search.element, {
          serialize: false, margin: 0,
          getHeight: () => 32, getMinHeight: () => 32, getMaxHeight: () => 32,
        });
        if (w) w._slRowH = 32;
        // Hide the plain (still-serialized) location widget; the search drives it.
        locW.hidden = true;
        (locW.options ??= {}).hidden = true;
        // Best-effort: place the search where 'location' was.
        const ws = node.widgets;
        const di = ws.indexOf(w), li = ws.indexOf(locW);
        if (di > -1 && li > -1 && di !== li + 1) {
          ws.splice(di, 1);
          ws.splice(li + 1, 0, w);
        }
        app.graph.setDirtyCanvas(true, true);
      } catch (e) {
        console.warn("[SphereLight] location search unavailable, using text field:", e);
        node._slSearch = null;
      }
    };

    // Swap the plain `heading` slider for the draggable compass dial. The dial
    // writes the still-serialized (now hidden) `heading` widget, mirroring how
    // the location search drives `location`.
    const setupCompass = () => {
      if (node._slCompass || typeof node.addDOMWidget !== "function") return;
      const headingW = node.widgets?.find((w) => w.name === "heading");
      if (!headingW) return;
      try {
        const compass = createCompass({
          label:    "heading",
          initial:  parseFloat(headingW.value) || 0,
          onChange: (deg) => { headingW.value = deg; debounced(); },
        });
        node._slCompass = compass;
        const w = node.addDOMWidget("compass", "compass", compass.element, {
          serialize: false, margin: 0,
          getHeight: () => 72, getMinHeight: () => 72, getMaxHeight: () => 72,
        });
        if (w) w._slRowH = 72;
        headingW.hidden = true;
        (headingW.options ??= {}).hidden = true;
        const ws = node.widgets;
        const di = ws.indexOf(w), hi = ws.indexOf(headingW);
        if (di > -1 && hi > -1 && di !== hi + 1) {
          ws.splice(di, 1);
          ws.splice(hi + 1, 0, w);
        }
        app.graph.setDirtyCanvas(true, true);
      } catch (e) {
        console.warn("[SphereLight] compass unavailable, using heading slider:", e);
        node._slCompass = null;
      }
    };

    // The raw widget names ("sun_mode", "location_mode") are unclear; give the
    // toggles human labels. Lowercase to match the other (native) labels.
    // LiteGraph draws `label || name`. Idempotent.
    const relabelToggles = () => {
      const sm = node.widgets?.find((w) => w.name === "sun_mode");
      if (sm) sm.label = "light direction";
      const lm = node.widgets?.find((w) => w.name === "location_mode");
      if (lm) lm.label = "location by";
    };

    // v2 (Vue nodes) lays each node out as a 3-column grid
    // [slot | label | control] and sizes the label column to the longest native
    // label, in a larger font than our DOM-widget defaults. Read the grid's
    // RESOLVED column widths (col 2 = the label column) and its font, and match
    // our labels so the search/compass line up with the sliders/combos. Only
    // needs the grid element, which always exists in v2; a no-op on v1 (fallback
    // CSS width applies). Returns false until the node's DOM is mounted.
    const syncLabels = () => {
      // Use whichever DOM widget is currently mounted (v2 unmounts hidden ones).
      const el = [node._slSearch?.element, node._slCompass?.element].find(e => e?.isConnected);
      const grid = el?.closest?.(".lg-node-widgets, [data-testid='node-widgets']");
      const natLabel = grid?.querySelector?.("[data-testid='widget-layout-field-label']");
      if (!natLabel) return false;
      // The control column is the label's sibling in the native widget's subgrid.
      const controlDiv = [...(natLabel.parentElement?.children || [])].find(c => c !== natLabel);
      if (!controlDiv) return false;
      const lr = natLabel.getBoundingClientRect();
      const scale = natLabel.offsetWidth ? lr.width / natLabel.offsetWidth : 1; // canvas zoom
      const arg = {
        targetLeft: controlDiv.getBoundingClientRect().left,
        fontSize:   getComputedStyle(natLabel).fontSize,
        scale,
      };
      if (node._slSearch?.element?.isConnected)  node._slSearch.matchLabel(arg);
      if (node._slCompass?.element?.isConnected) node._slCompass.matchLabel(arg);
      return true;
    };

    // Retry until the (v2) node DOM is mounted; a fresh token cancels stale loops.
    let syncToken = 0;
    const trySyncLabels = () => {
      const my = ++syncToken;
      let tries = 0;
      const attempt = () => {
        if (my !== syncToken || syncLabels()) return;
        if (tries++ < 12) setTimeout(attempt, 200);
      };
      attempt();
    };

    const initW = Math.max(node.size?.[0] || 300, 280);
    const initSide = initW - 24;

    setTimeout(() => {
      hideB64Widget();
      hookSliders();
      setupLocationSearch();
      setupCompass();
      relabelToggles();
      applyVisibility();
      doRender();
      node.setSize([initW, TOP_WIDGETS_H() + initSide + 16]);
    }, 100);

    setTimeout(() => { hookSliders(); hideB64Widget(); setupLocationSearch(); setupCompass(); relabelToggles(); applyVisibility(); }, 700);
  },
});