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

Four nodes are registered under **render/3d**:

- **🔆 Sphere Light Render** — the original all-in-one node (mode + location toggles).
- **🔆 Sphere Light — Manual** — set the light directly with `rotation` / `elevation` / `intensity`.
- **🔆 Sphere Light — Sun (City)** — position the light from a real sun: pick a city, set date/time, drag the compass.
- **🔆 Sphere Light — Sun (Coordinates)** — same, but enter `latitude` / `longitude` directly (timezone borrowed from the nearest listed city).

The three split nodes have no mode toggles — the node you pick *is* the mode. The all-in-one node remains for existing workflows.

## Time of day

The node has two modes, chosen by the **Light direction** toggle at the top:

- **Manual** — set the light with the `rotation` and `elevation` sliders (plus
  `intensity`). This is the default.
- **Date/time** — position the light from a real sun position. Only this mode's
  inputs are shown, so the two modes never clutter each other.

In **date/time** mode, pick where the location comes from with the **City /
Coordinates** toggle — only the active one is shown, so it's always clear which
drives the sun:

- **City** — start typing a city and pick from the dropdown (e.g. `Austin, TX`,
  `London, UK`, `Tokyo, Japan`).
- **Coordinates** — for a place not in the bundled list (cities over ~15k
  population), enter `latitude` / `longitude` directly; the timezone is borrowed
  from the nearest listed city.

Set the date and time, then drag the **compass** dial to the direction the camera
faces (N at top, clockwise). A status line shows what was resolved
(`☀ London, England`) or warns when a city isn't found. Timezone and
daylight-saving are handled automatically. Rebuild the city list with
`python tools/build_cities.py`.
