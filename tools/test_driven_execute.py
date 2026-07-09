import sys, types, importlib.util, os
import numpy as np

# Repo root on the path so __init__.py's `import render_bridge` (and our own
# `import render_bridge as rb` below) resolve when run as `python tools/...`.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

faketorch = types.ModuleType("torch")
class FT:
    def __init__(self, a): self.a = a
    def unsqueeze(self, d): return FT(np.expand_dims(self.a, d))
    @property
    def shape(self): return self.a.shape
faketorch.from_numpy = lambda a: FT(a)
sys.modules["torch"] = faketorch

NODE = os.path.join(os.path.dirname(__file__), "..", "__init__.py")
spec = importlib.util.spec_from_file_location("slnode", NODE)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

# Stub render_bridge on the loaded module so no ComfyUI is needed.
import render_bridge as rb
calls = {}
rb.render = lambda node_id, params, **kw: (calls.__setitem__("params", params) or
    "data:image/png;base64,AAAA")  # pretend the browser rendered a 1x1

# Hidden inputs are declared.
city_it = mod.SphereLightSunCityNode.INPUT_TYPES()
assert city_it.get("hidden") == {"node_id": "UNIQUE_ID", "prompt": "PROMPT"}, city_it.get("hidden")

# Driven mode: heading is a link in the prompt -> execute calls render_bridge.render.
node = mod.SphereLightSunCityNode()
prompt = {"5": {"inputs": {"heading": ["9", 0]}}}
(t,) = node.execute(1.5, "Austin, TX", 2025, 6, 21, 12, 0, 0.0, "", node_id="5", prompt=prompt)
assert tuple(t.shape) == (1, 1024, 1024, 3), t.shape
assert calls["params"]["heading"] == 0.0            # resolved params passed through
assert calls["params"]["city"] == "Austin, TX"

# Interactive mode: nothing connected -> decode_render_b64 path (empty -> gray), render NOT called.
calls.clear()
(t,) = node.execute(1.5, "Austin, TX", 2025, 6, 21, 12, 0, 0.0, "", node_id="5", prompt={"5": {"inputs": {}}})
assert tuple(t.shape) == (1, 1024, 1024, 3), t.shape
assert "params" not in calls                        # render_bridge.render was not called

print("test_driven_execute: OK")
