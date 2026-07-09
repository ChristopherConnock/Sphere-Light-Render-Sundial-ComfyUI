import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import render_bridge as rb

# is_driven: a link is a [id, slot] list; a literal is a scalar.
PROMPT = {"7": {"inputs": {
    "heading": ["3", 0],          # connected
    "intensity": 1.5,             # literal widget value
    "city": "Austin, TX",
}, "class_type": "SphereLightSunCityNode"}}

assert rb.is_driven(PROMPT, "7", ["heading", "intensity"]) is True   # heading is a link
assert rb.is_driven(PROMPT, "7", ["intensity", "city"]) is False     # all literals
assert rb.is_driven(PROMPT, 7, ["heading"]) is True                  # int node_id coerced
assert rb.is_driven(PROMPT, "999", ["heading"]) is False             # missing node
assert rb.is_driven({}, "7", ["heading"]) is False                   # empty prompt

p = rb.build_payload("7", "tok1", {"heading": 90})
assert p == {"node_id": "7", "run_token": "tok1", "params": {"heading": 90}}, p

print("test_render_bridge: OK")
