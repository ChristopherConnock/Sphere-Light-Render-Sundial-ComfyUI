import { app } from "../../scripts/app.js";

// Server → browser: execute() pushed the graph-resolved params; render the sphere
// with them and POST the PNG back so execute() can return it as the IMAGE output.
app.registerExtension({
  name: "SphereLightDriven",
  async setup() {
    app.api.addEventListener("sphere_light.render", async (event) => {
      const { node_id, run_token, params } = event.detail || {};
      const node = app.graph?.getNodeById?.(Number(node_id)) || app.graph?.getNodeById?.(node_id);
      const driven = node?._slDriven;
      let image = null;
      try {
        if (driven) {
          driven.reflect(params);          // mirror onto the compass/fields
          image = driven.renderWith(params); // off-screen render from pushed params
        }
      } catch (e) {
        console.warn("[SphereLight] driven render failed:", e);
      }
      // Always answer (even with null) so execute() unblocks fast instead of waiting the backstop.
      try {
        await fetch("/sphere_light/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_id, run_token, image }),
        });
      } catch (e) {
        console.warn("[SphereLight] result POST failed:", e);
      }
    });
  },
});
