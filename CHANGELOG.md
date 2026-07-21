# Changelog

This project is an independently maintained continuation of
[eric-venti-seeds/Sphere-Light-Render-ComfyUI](https://github.com/eric-venti-seeds/Sphere-Light-Render-ComfyUI).
The original concept, node, and the companion
[Sun-Direction LoRA](https://huggingface.co/eric-venti-seeds/Sun-Direction-Lora-Flux2Klein9B)
are the work of **eric-venti-seeds** — all credit for the idea and the original
implementation goes to them.

## The original (fork point `6e40c7a`, 2026-06-29)

Three files: a single `SphereLightNode` (Python) with `rotation` / `elevation` /
`intensity` sliders and a hidden `render_b64` string, plus `js/sphere_widget.js`
— a Three.js preview (r128, loaded from a CDN) that rendered a lit sphere in the
node and passed the image to the server as base64. Output: a 1024×1024 IMAGE
reference for the Sun-Direction LoRA.

Everything below is what this fork changed, in order.

## 2026-07-05 — Hardening

- Vendored Three.js r128 into the repo (`js/three.min.js`, MIT) so the widget
  works offline instead of loading from a CDN.
- Guarded the base64 image decode; WebGL contexts are freed when a node is
  removed.

## 2026-07-05 — Sun position from real time & place

- NOAA solar-position module (`js/solar.js`): date/time + latitude/longitude →
  sun azimuth/elevation.
- DST-aware wall-time→UTC conversion via `Intl` with a two-pass offset for
  DST-boundary correctness (`js/tz.js`).
- Offline city lookup with population-based disambiguation (`js/geo.js`), backed
  by a bundled worldwide city dataset (population ≥ 15k) built from GeoNames
  (`js/cities.json`, `tools/build_cities.py`, `tools/verify_cities.py`).
- The node gained date/time/location inputs; the widget drives the light from
  the computed sun position. Location UX: searchable city autocomplete styled
  like native ComfyUI widgets, lat/lon fields, and a status line showing what
  was resolved.

## 2026-07-06 — Mode UI clarity

- Toggle-first UI: per-mode show/hide of widgets, city/coords source gating.
- Draggable compass dial for `heading` (pure bearing math + DOM widget).
- Compatibility fixes for ComfyUI's v2 (Vue) node renderer: show/hide, native
  styling, serialize round-trip persistence, mount-timing re-application.

## 2026-07-07 — One node per mode

- Split into three registered nodes, so the node you pick *is* the mode:
  **Manual**, **Sun (City)**, **Sun (Coordinates)** — no mode toggles.
- Render engine extracted into `js/preview.js`; pure logic split into
  `js/light.js` so it stays testable under `node --test`.
- Nearest-city status label for the coordinates node.

## 2026-07-08 — Graph-driven inputs

- Every positioning parameter (heading, city, lat/lon, date/time, intensity,
  Manual's rotation/elevation) can be driven by an upstream node; a connected
  input wins over the on-node control.
- First implemented as a server round-trip render bridge, then replaced by a
  simpler client-side graph-driven approach (the browser bakes resolved values
  into the render before each run).
- Live re-render when a connected source's value changes; driven values mirror
  into their widgets with a stale-fill guard.
- `heading`/`city` became connectable inputs; the compass is a dial-only
  companion. Heading precision raised to 2 decimals to match EXIF
  `GPSImgDirection`.

## 2026-07-11 — Photo (EXIF) node

- Browser-side EXIF parser (`js/exif.js`): TIFF/IFD core reading GPS
  latitude/longitude, `GPSImgDirection` (heading), and `DateTimeOriginal`, with
  container scanning for JPEG, PNG (`eXIf`), and WebP.
- New **Photo (EXIF)** node: pick a photo and its EXIF supplies
  latitude/longitude, nearest city, heading, and capture date/time as outputs —
  wire them into the Sun nodes to light the sphere as the sun actually was.
  The photo passes through as `IMAGE`.
- Parse-on-pick browser glue: widgets fill from EXIF, a status line reports
  what was found; tags the photo doesn't carry leave widgets untouched.

## 2026-07-11 — Audit hardening

- Nearest-city lookup (timezone borrowing, "near <city>" labels, the Photo
  node's city fill) now wraps longitude across the antimeridian and scales it
  by cos(latitude) — coordinates near the date line could previously borrow a
  timezone from the wrong side of it.
- One shared WebGL renderer for all sphere-light nodes (each keeps a 2D
  snapshot of its own render) — browsers cap live WebGL contexts at ~8–16, so
  workflows with many nodes could lose previews. Three.js now also loads
  single-flight instead of once per node created in the same tick.
- Live re-renders from a connected source's widget changes are debounced and
  scoped to the sphere nodes actually wired to that source (was: an immediate
  full render of every sphere node per change, forever, even after
  disconnecting).
- `onRemoved` / `onResize` chain any previously installed handler instead of
  clobbering it; reload-time source hooking now rides `onConfigure` (the
  timeout remains as fallback).
- Widget reads fall back to the declared default when a value doesn't parse as
  a finite number, instead of leaking NaN into the light math; pure helpers
  extracted to `js/widgets.js` with unit tests.
- Real end-to-end integration test: EXIF bytes → parse → normalize → sun
  angles → light position, using the README's Penn Park photo values.
- CI (GitHub Actions) runs the JS suite and the Python check scripts on every
  push and pull request.

## 2026-07-21 — Second audit round

- Graph-driven inputs resolve links in the node's **own** graph (subgraphs get
  their own `LGraph` with local link/node ids — root-graph lookups could read
  an unrelated link or fall back to a stale widget), and resolve the origin
  widget via the wired output slot's name first, so a cross-wired multi-output
  source (e.g. Photo EXIF `latitude` → `longitude`) reads the value the graph
  actually carries. Resolver extracted to `js/widgets.js` with unit tests.
- Three.js swapped from the UMD bundle (which assigned `globalThis.THREE`,
  clobbering — or being clobbered by — other custom nodes' Three.js, load-order
  dependent) to the r128 ES-module build, imported module-locally
  (`js/three.module.js`); the script-tag loader is gone.
- Picking a new photo on the Photo (EXIF) node resets all metadata widgets to
  their defaults before the new EXIF lands — a photo missing a tag no longer
  silently keeps the previous photo's GPS/heading/time.
- `GPSImgDirectionRef` is parsed; a magnetic-north heading is flagged
  "(magnetic)" in the status line instead of being silently treated as true
  north.
- Sun nodes' status line shows "loading city data…" / "city data failed to
  load" while renders use fallback angles, instead of a blank line.
- Wall-time conversion no longer remaps years 1–99 to 1901–1999
  (`Date.UTC` legacy behavior; the nodes advertise years 1–9999).
- `MAX_IMAGE_SIDE` tightened 8192 → 2048 (the browser renders 512²; a 8192²
  decode is ~192 MiB — a decompression bomb, not a legitimate render).

## Fixes along the way

- Sun bearing is mirrored into the scene frame — heading-driven renders were
  front/back flipped.
- Parsed EXIF values are normalized; built-in input validation re-enabled.

## Project structure & tests

- 85 JS unit tests under `tests/` (Node's built-in runner, `npm test`) covering
  solar math, timezone/DST, geo lookup, EXIF parsing, compass, status, widget
  helpers, and integration.
- Python check scripts in `tools/` (`test_decode.py`, `test_new_nodes.py`,
  `test_photo_exif.py`, `test_comfy_load.py`).
- Design specs and implementation plans for each feature in `docs/superpowers/`.
- `package.json` / `pyproject.toml` added; JS tests moved out of `js/` so the
  served `WEB_DIRECTORY` contains only runtime modules.

## Data & third-party credits

- City data derived from [GeoNames](https://www.geonames.org/) (`cities15000`,
  `admin1CodesASCII`, `countryInfo`), licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- [Three.js](https://threejs.org/) r128 (MIT), vendored as `js/three.module.js`
  with its license header intact.
