import sys, types, importlib.util, os, numpy as np

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

req = mod.SphereLightNode.INPUT_TYPES()["required"]
for k in ["sun_mode", "location_mode", "location", "latitude", "longitude",
          "year", "month", "day", "hour", "minute", "heading"]:
    assert k in req, f"missing input: {k}"
assert req["sun_mode"][0] == ["manual", "date/time"], req["sun_mode"]
assert req["location_mode"][0] == ["city", "coords"], req["location_mode"]

# execute must still work and ignore the new params (empty render_b64 -> gray)
node = mod.SphereLightNode()
(t,) = node.execute("manual", 0.0, 45.0, 1.5, "city", "Austin, TX", 0.0, 0.0,
                    2025, 6, 21, 12, 0, 0.0, "")
assert tuple(t.shape) == (1, 1024, 1024, 3), t.shape
print("test_inputs: OK")
