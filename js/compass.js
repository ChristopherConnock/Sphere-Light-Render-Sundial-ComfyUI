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
