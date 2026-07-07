// Draggable compass dial for the `heading` input. `pointerToHeading` is pure
// (no DOM) so it is unit-tested in Node; `createCompass` (Task 3) is the DOM
// factory and is verified manually, like location_search.js.

// Bearing of (x,y) around center (cx,cy), in canvas pixels where y grows DOWN.
// 0 = up = North, clockwise (E=90, S=180, W=270). null at dead center.
export function pointerToHeading(cx, cy, x, y) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return null;
  // atan2(dx, -dy): up(dx0,-dy>0)->0, right->90, down->180, left->270.
  const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
  return (deg + 360) % 360;
}

// A small canvas compass the user drags. Writes `heading` degrees via onChange.
// Colors are literal (canvas can't read CSS vars); N is amber, needle is the
// same blue as the node's status accent.
export function createCompass({ initial = 0, size = 72, onChange } = {}) {
  let heading = (((Number(initial) || 0) % 360) + 360) % 360;

  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%", display: "flex", justifyContent: "center", padding: "2px 0",
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  Object.assign(canvas.style, { cursor: "pointer", touchAction: "none" });
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const cx = size / 2, cy = size / 2, R = size / 2 - 10;

  const draw = () => {
    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#4e4e4e";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [ch, deg] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const a = deg * Math.PI / 180;
      ctx.fillStyle = ch === "N" ? "#e0a848" : "#9aa0a6";
      ctx.fillText(ch, cx + Math.sin(a) * (R + 5), cy - Math.cos(a) * (R + 5));
    }

    const a = heading * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a) * (R - 4), cy - Math.cos(a) * (R - 4));
    ctx.strokeStyle = "#79c0ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#79c0ff";
    ctx.fill();

    ctx.fillStyle = "#c9d1d9";
    ctx.font = "9px sans-serif";
    ctx.fillText(`${Math.round(heading)}°`, cx, cy + R - 1);
  };

  const set = (deg, fire) => {
    heading = (((deg % 360) + 360) % 360);
    draw();
    if (fire) onChange?.(heading);
  };

  const fromEvent = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (size / r.width);
    const y = (e.clientY - r.top) * (size / r.height);
    const deg = pointerToHeading(cx, cy, x, y);
    if (deg !== null) set(deg, true);
  };

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

  draw();

  return {
    element: container,
    setValue: (deg) => set(deg, false),
    getValue: () => heading,
    destroy: () => {},
  };
}
