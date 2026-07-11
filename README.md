# Sphere-Light-Render-ComfyUI
Widget to tell Flux 2 Klein 9B where the sun light comes from. To be used with Sun_direction_Lora for Flux2Klein

## Install

Clone into your `ComfyUI/custom_nodes/`:

```bash
cd ComfyUI/custom_nodes/
git clone https://github.com/eric-venti-seeds/Sphere-Light-Render-ComfyUI.git
```

Restart ComfyUI. No additional Python dependencies for the core node.

## Quick start

Download the Lora from here:

https://huggingface.co/eric-venti-seeds/Sun-Direction-Lora-Flux2Klein9B



The Node renders a 1024 x 1024 image as reference for the LoRA to understand where the light comes from

<img width="484" height="720" alt="sphere" src="https://github.com/user-attachments/assets/581bfc3c-61a6-48da-9b25-89275a2bee10" />

<img width="1288" height="770" alt="Sphere_Light_Render_ComfyUI_Node" src="https://github.com/user-attachments/assets/3e6a27a6-2eca-442c-9f4f-91a674857f89" />

## Nodes

Four nodes are registered under **render/3d** — the node you pick *is* the mode,
so there are no mode toggles:

- **🔆 Sphere Light — Manual** — set the light directly with `rotation` /
  `elevation` / `intensity`.
- **🔆 Sphere Light — Sun (City)** — position the light from the real sun: type a
  city (e.g. `Austin, TX`, `London, UK`, `Tokyo, Japan`), set date/time and
  `heading`.
- **🔆 Sphere Light — Sun (Coordinates)** — same, but enter `latitude` /
  `longitude` directly (timezone borrowed from the nearest listed city).
- **📷 Sphere Light — Photo (EXIF)** — upload a photo; its EXIF supplies
  `latitude`/`longitude`, the nearest `city`, `heading` (`GPSImgDirection`),
  and the capture date/time as outputs — wire them into the Sun nodes to light
  the sphere the way the sun actually was when and where the photo was taken.
  The photo itself comes out as `IMAGE`, so it can stand in for a Load Image
  node for ordinary photos (no `MASK` output).

On the Sun nodes, `heading` is the direction the camera faces (degrees clockwise
from North, matching EXIF `GPSImgDirection`); a small compass in the corner of
the preview shows it at a glance. A status line shows what was resolved
(`☀ London, England`) or warns when a city isn't found. Timezone and
daylight-saving are handled automatically. The bundled city list covers cities
over ~15k population; rebuild it with `python tools/build_cities.py`.

### Driving inputs from the graph

Every positioning parameter (heading, city, lat/lon, date/time, intensity, and
Manual's rotation/elevation) can be driven by an upstream node — wire a
**Primitive** (or any node whose value the browser can read) into the
corresponding input. A connected input **wins** over the on-node control, and
the control mirrors the driven value so the field always shows what's actually
used; disconnect it and the widget (still holding the last driven value)
drives again.

The sphere renders client-side (Three.js), and the browser bakes the resolved
value into the rendered image *before each run* — so the output matches the driven
value on the same queue (incrementing an animation frame-by-frame works). This
means **an open ComfyUI browser tab is required** for driven inputs, and the
driving value must be one the browser can resolve (a Primitive/static source, not
a value computed mid-run by another node). A headless/API run, or a value that
only exists during execution, isn't reflected — use the widgets for those.

### From a photo's EXIF

The Photo (EXIF) node reads the metadata in the browser when you pick the
image and writes the values onto its widgets (a status line shows what was
found). Tags the photo doesn't carry — phones only record `GPSImgDirection`
when the compass was active — leave their widgets untouched, so you can type a
correction by hand. Like all driven inputs, an open browser tab is what bakes
fresh values in; headless runs reuse the last-saved ones. JPEG, PNG (`eXIf`),
and WebP files carry EXIF; HEIC is not supported (ComfyUI can't decode it
either).

## Development

- JS unit tests: `npm test` (Node's built-in runner over `tests/`).
- Python node tests: run the scripts in `tools/` (`test_decode.py`,
  `test_new_nodes.py`, `test_photo_exif.py`, `test_comfy_load.py`).
- `js/` is the `WEB_DIRECTORY` ComfyUI serves — every `.js` file in it is
  auto-imported by the browser, so only runtime modules live there.
