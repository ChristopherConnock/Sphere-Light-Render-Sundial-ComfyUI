import torch
import numpy as np
from PIL import Image
import io, base64

# Guards for decoding the base64 image, which arrives via the (serialized,
# therefore untrusted) workflow. These bound how much work a malicious or
# malformed workflow can make the server do before the try/except catches it.
MAX_B64_CHARS  = 16 * 1024 * 1024   # a legit 1024^2 PNG data-URI is well under this
MAX_IMAGE_SIDE = 8192               # reject absurd dimensions (decompression-bomb defence)
TARGET_SIZE    = 1024
FALLBACK_GRAY  = (138, 138, 138)    # matches the JS clear color 0x8a8a8a

def decode_render_b64(render_b64):
    """Decode a data-URI PNG from the (untrusted) workflow into a
    (1,1024,1024,3) float32 tensor. Empty/invalid/oversized -> gray fallback."""
    img = None
    if render_b64 and render_b64.startswith("data:image"):
        if len(render_b64) > MAX_B64_CHARS:
            print(f"[SphereLightNode] render_b64 too large "
                  f"({len(render_b64)} chars); using gray fallback")
        else:
            try:
                header, data = render_b64.split(",", 1)
                img_bytes = base64.b64decode(data, validate=True)
                probe = Image.open(io.BytesIO(img_bytes))
                w, h = probe.size
                if w > MAX_IMAGE_SIDE or h > MAX_IMAGE_SIDE:
                    raise ValueError(f"image dimensions too large: {w}x{h}")
                img = probe.convert("RGB").resize(
                    (TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)
            except Exception as e:
                print(f"[SphereLightNode] Error decoding render_b64: {e}")
                img = None
    else:
        print("[SphereLightNode] no render_b64 provided; using gray fallback")

    if img is None:
        img = Image.new("RGB", (TARGET_SIZE, TARGET_SIZE), FALLBACK_GRAY)

    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr).unsqueeze(0)

class SphereLightNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "sun_mode":  (["manual", "date/time"], {"default": "manual"}),
                "rotation":  ("FLOAT", {"default": 0.0,  "min": -180, "max": 180, "step": 1,   "display": "slider"}),
                "elevation": ("FLOAT", {"default": 45.0, "min": 5,    "max": 85,  "step": 1,   "display": "slider"}),
                "intensity": ("FLOAT", {"default": 1.5,  "min": 0.2,  "max": 3.0, "step": 0.1, "display": "slider"}),
                "location_mode": (["city", "coords"], {"default": "city"}),
                "location":  ("STRING", {"default": "Austin, TX", "multiline": False}),
                "latitude":  ("FLOAT", {"default": 0.0, "min": -90.0,  "max": 90.0,  "step": 0.0001}),
                "longitude": ("FLOAT", {"default": 0.0, "min": -180.0, "max": 180.0, "step": 0.0001}),
                "year":      ("INT", {"default": 2025, "min": 1, "max": 9999}),
                "month":     ("INT", {"default": 6,  "min": 1,  "max": 12}),
                "day":       ("INT", {"default": 21, "min": 1,  "max": 31}),
                "hour":      ("INT", {"default": 12, "min": 0,  "max": 23}),
                "minute":    ("INT", {"default": 0,  "min": 0,  "max": 59}),
                "heading":   ("FLOAT", {"default": 0.0, "min": 0, "max": 360, "step": 1, "display": "slider"}),
                "render_b64": ("STRING", {"default": "", "multiline": False}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("render",)
    FUNCTION = "execute"
    CATEGORY = "render/3d"
    OUTPUT_NODE = False

    def execute(self, sun_mode, rotation, elevation, intensity, location_mode,
                location, latitude, longitude, year, month, day, hour, minute,
                heading, render_b64):
        # Positioning params (sun_mode, rotation..heading, location_mode,
        # latitude/longitude) are consumed client-side in js/sphere_widget.js;
        # the server only needs render_b64. They appear here because ComfyUI
        # passes every declared input.
        tensor = decode_render_b64(render_b64)
        return (tensor,)


class SphereLightManualNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "rotation":  ("FLOAT", {"default": 0.0,  "min": -180, "max": 180, "step": 1,   "display": "slider"}),
                "elevation": ("FLOAT", {"default": 45.0, "min": 5,    "max": 85,  "step": 1,   "display": "slider"}),
                "intensity": ("FLOAT", {"default": 1.5,  "min": 0.2,  "max": 3.0, "step": 0.1, "display": "slider"}),
                "render_b64": ("STRING", {"default": "", "multiline": False}),
            }
        }
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("render",)
    FUNCTION = "execute"
    CATEGORY = "render/3d"
    OUTPUT_NODE = False

    def execute(self, rotation, elevation, intensity, render_b64):
        return (decode_render_b64(render_b64),)


class SphereLightSunCityNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "intensity": ("FLOAT", {"default": 1.5, "min": 0.2, "max": 3.0, "step": 0.1, "display": "slider"}),
                "year":      ("INT", {"default": 2025, "min": 1, "max": 9999}),
                "month":     ("INT", {"default": 6,  "min": 1,  "max": 12}),
                "day":       ("INT", {"default": 21, "min": 1,  "max": 31}),
                "hour":      ("INT", {"default": 12, "min": 0,  "max": 23}),
                "minute":    ("INT", {"default": 0,  "min": 0,  "max": 59}),
                "render_b64": ("STRING", {"default": "", "multiline": False}),
            }
        }
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("render",)
    FUNCTION = "execute"
    CATEGORY = "render/3d"
    OUTPUT_NODE = False

    def execute(self, intensity, year, month, day, hour, minute, render_b64):
        return (decode_render_b64(render_b64),)


class SphereLightSunCoordsNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "intensity": ("FLOAT", {"default": 1.5, "min": 0.2, "max": 3.0, "step": 0.1, "display": "slider"}),
                "latitude":  ("FLOAT", {"default": 0.0, "min": -90.0,  "max": 90.0,  "step": 0.0001}),
                "longitude": ("FLOAT", {"default": 0.0, "min": -180.0, "max": 180.0, "step": 0.0001}),
                "year":      ("INT", {"default": 2025, "min": 1, "max": 9999}),
                "month":     ("INT", {"default": 6,  "min": 1,  "max": 12}),
                "day":       ("INT", {"default": 21, "min": 1,  "max": 31}),
                "hour":      ("INT", {"default": 12, "min": 0,  "max": 23}),
                "minute":    ("INT", {"default": 0,  "min": 0,  "max": 59}),
                "render_b64": ("STRING", {"default": "", "multiline": False}),
            }
        }
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("render",)
    FUNCTION = "execute"
    CATEGORY = "render/3d"
    OUTPUT_NODE = False

    def execute(self, intensity, latitude, longitude, year, month, day, hour, minute, render_b64):
        return (decode_render_b64(render_b64),)


NODE_CLASS_MAPPINGS = {
    "SphereLightNode": SphereLightNode,
    "SphereLightManualNode": SphereLightManualNode,
    "SphereLightSunCityNode": SphereLightSunCityNode,
    "SphereLightSunCoordsNode": SphereLightSunCoordsNode,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "SphereLightNode": "🔆 Sphere Light Render",
    "SphereLightManualNode": "🔆 Sphere Light — Manual",
    "SphereLightSunCityNode": "🔆 Sphere Light — Sun (City)",
    "SphereLightSunCoordsNode": "🔆 Sphere Light — Sun (Coordinates)",
}
WEB_DIRECTORY = "./js"