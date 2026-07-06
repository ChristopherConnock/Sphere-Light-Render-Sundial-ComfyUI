import { app } from "../../scripts/app.js";

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

    const getVal = (name, def) => {
      const w = node.widgets?.find(w => w.name === name);
      return w ? parseFloat(w.value) : def;
    };

    const doRender = () => {
      const az = getVal("rotation", 0) * Math.PI / 180;
      const el = getVal("elevation", 45) * Math.PI / 180;
      const r  = 10;
      ctx.dirLight.position.set(
        r * Math.cos(el) * Math.sin(az),
        r * Math.sin(el),
        r * Math.cos(el) * Math.cos(az)
      );
      ctx.dirLight.intensity = getVal("intensity", 1.5);
      ctx.renderer.shadowMap.needsUpdate = true;
      ctx.renderer.render(ctx.scene, ctx.camera);
      node._slReady = true;
      const b64 = ctx.canvas.toDataURL("image/png");
      const wb  = node.widgets?.find(w => w.name === "render_b64");
      if (wb) wb.value = b64;
      app.graph.setDirtyCanvas(true, false);
    };

    let debTimer = null;
    const debounced = () => { clearTimeout(debTimer); debTimer = setTimeout(doRender, 80); };

    const hookSliders = () => {
      ["rotation", "elevation", "intensity"].forEach(name => {
        const w = node.widgets?.find(w => w.name === name);
        if (!w || w._slHooked) return;
        w._slHooked = true;
        const orig = w.callback;
        w.callback = function(v, ...args) { orig?.call(this, v, ...args); debounced(); };
      });
    };

    const hideB64Widget = () => {
      const wb = node.widgets?.find(w => w.name === "render_b64");
      if (!wb || wb._hidden) return;
      wb._hidden = true;
      wb.computeSize = () => [0, 0];
      wb.draw = () => {};
      wb.type = "hidden";
    };

    const TOP_WIDGETS_H = () => {
      let h = LiteGraph.NODE_TITLE_HEIGHT + 8;
      for (const w of node.widgets ?? []) {
        if (w.name === "_3d_preview") break;
        const wh = w.computeSize
          ? w.computeSize(node.size[0])[1]
          : LiteGraph.NODE_WIDGET_HEIGHT;
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
      this._slCtx    = null;
      this._slCanvas = null;
    };

    node.onResize = function(size) {
      const minH = TOP_WIDGETS_H() + 60 + 16;
      if (size[1] < minH) size[1] = minH;
      app.graph.setDirtyCanvas(true, false);
    };

    const initW = Math.max(node.size?.[0] || 300, 280);
    const initSide = initW - 24;

    setTimeout(() => {
      hideB64Widget();
      hookSliders();
      doRender();
      node.setSize([initW, TOP_WIDGETS_H() + initSide + 16]);
    }, 100);

    setTimeout(() => { hookSliders(); hideB64Widget(); }, 700);
  },
});