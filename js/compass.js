import { FIELD_BG, FIELD_TEXT, WIDGET_GAP, LABEL_STYLE } from "./widget_style.js";

// Draggable compass dial for the `heading` input. `pointerToHeading` is pure
// (no DOM) so it is unit-tested in Node; `createCompass` (Task 3) is the DOM
// factory and is verified manually, like location_search.js.

// Bearing of (x,y) around center (cx,cy), in canvas pixels where y grows DOWN.
// 0 = up = North, clockwise (E=90, S=180, W=270). null at dead center.
export function pointerToHeading(cx, cy, x, y) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return null;
  // atan2(dx, -dy): up(dx=0,-dy>0)->0, right->90, down->180, left->270.
  const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
  return (deg + 360) % 360;
}

// A compass row: a left-hand label, a numeric degrees input, and a draggable
// dial — all synced. Writes `heading` degrees via onChange. `theme` carries the
// node's widget colors (from LiteGraph.WIDGET_*) so the input matches the native
// widgets; the dial itself uses literal accent colors (N amber, needle blue).
export function createCompass({ initial = 0, size = 64, onChange, label } = {}) {
  let heading = (((Number(initial) || 0) % 360) + 360) % 360;
  const SS = 3;   // canvas supersample factor: a DOM-widget canvas isn't
                  // auto-scaled like a legacy widget canvas, so render at 3× and
                  // down-display for crisp text/lines instead of a blurry dial.

  // One-time: strip the number input's spin buttons so it reads like a pill.
  if (typeof document !== "undefined" && !document.getElementById("sl-compass-style")) {
    const st = document.createElement("style");
    st.id = "sl-compass-style";
    st.textContent =
      ".sl-compass-num::-webkit-inner-spin-button,.sl-compass-num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}";
    document.head.appendChild(st);
  }

  const container = document.createElement("div");
  Object.assign(container.style, {
    boxSizing: "border-box", width: "100%", height: "100%",
    display: "flex", alignItems: "center", gap: WIDGET_GAP,
  });

  let labelEl = null;
  if (label) {
    labelEl = document.createElement("span");
    labelEl.textContent = label;
    Object.assign(labelEl.style, LABEL_STYLE);
    container.appendChild(labelEl);
  }

  const num = document.createElement("input");
  num.type = "number"; num.min = "0"; num.max = "360"; num.step = "1";
  num.className = "sl-compass-num";
  num.value = String(Math.round(heading));
  Object.assign(num.style, {
    flex: "0 0 auto", width: "46px", boxSizing: "border-box", padding: "5px 6px", textAlign: "center",
    background: FIELD_BG, color: FIELD_TEXT, border: "none", borderRadius: "8px",
    fontFamily: "inherit", fontSize: "12px",
    outline: "none", appearance: "textfield", MozAppearance: "textfield",
  });
  container.appendChild(num);

  const canvas = document.createElement("canvas");
  canvas.width = size * SS;
  canvas.height = size * SS;
  // The container gap is 0 (so the number lines up with the control column), so
  // the small gap between the number and the dial lives on the dial itself.
  Object.assign(canvas.style, {
    width: size + "px", height: size + "px", flex: "0 0 auto",
    marginLeft: "12px", cursor: "pointer", touchAction: "none",
  });
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const cx = size / 2, cy = size / 2, R = size / 2 - 11;

  const draw = () => {
    ctx.setTransform(SS, 0, 0, SS, 0, 0);   // supersample -> crisp text/lines
    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#6a6a6a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [ch, deg] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const a = deg * Math.PI / 180;
      ctx.fillStyle = ch === "N" ? "#e0a848" : "#aab2bd";
      ctx.fillText(ch, cx + Math.sin(a) * (R + 6), cy - Math.cos(a) * (R + 6));
    }

    const a = heading * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a) * (R - 3), cy - Math.cos(a) * (R - 3));
    ctx.strokeStyle = "#79c0ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#79c0ff";
    ctx.fill();
  };

  const applyHeading = (deg) => {
    heading = (((deg % 360) + 360) % 360);
    draw();
  };

  // set() also rewrites the number field — used by the dial and external setValue.
  const set = (deg, fire) => {
    applyHeading(deg);
    num.value = String(Math.round(heading));
    if (fire) onChange?.(heading);
  };

  const fromEvent = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (size / r.width);
    const y = (e.clientY - r.top) * (size / r.height);
    const deg = pointerToHeading(cx, cy, x, y);
    if (deg !== null) set(deg, true);
  };

  // Typing drives the dial + fires, but does NOT rewrite the field mid-edit
  // (that would fight the caret); blur normalizes it to the rounded value.
  num.addEventListener("input", () => {
    const v = parseFloat(num.value);
    if (Number.isFinite(v)) { applyHeading(v); onChange?.(heading); }
  });
  num.addEventListener("blur", () => { num.value = String(Math.round(heading)); });

  let dragging = false;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
    fromEvent(e);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => { if (dragging) fromEvent(e); });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  });
  // If the pointer sequence is canceled (system gesture, interrupted touch),
  // no pointerup fires — clear the drag flag so a later hover can't move the needle.
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  draw();

  return {
    element: container,
    setValue: (deg) => set(deg, false),
    getValue: () => heading,
    // See location_search.js — aim the label so the number field's left lands
    // on the native control column, then correct the residual (scale = zoom).
    matchLabel: ({ targetLeft, fontSize, scale = 1 } = {}) => {
      if (!labelEl) return;
      if (fontSize) labelEl.style.fontSize = fontSize;
      container.style.gap = "0px";
      if (targetLeft == null || !container.isConnected) return;
      const contLeft = container.getBoundingClientRect().left;
      const w = (targetLeft - contLeft) / scale;
      labelEl.style.flex = `0 0 ${Math.max(w, 0)}px`;
      const residual = (num.getBoundingClientRect().left - targetLeft) / scale;
      labelEl.style.flex = `0 0 ${Math.max(w - residual, 0)}px`;
    },
    destroy: () => {},
  };
}
