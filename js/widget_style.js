// Shared styling tokens so the DOM widgets (location search, compass) read as
// native ComfyUI inputs. Values target the v2 (Vue node) design tokens, each
// with a v1/classic CSS-var fallback, so they look right in either renderer.
// No DOM access here — safe to import from Node tests.

export const FIELD_BG   = "var(--component-node-widget-background, var(--comfy-input-bg, #303030))";
export const FIELD_TEXT = "var(--component-node-foreground, var(--input-text, #dddddd))";
export const LABEL_COLOR = "var(--node-component-slot-text, var(--descrip-text, #999999))";
// Matches the v2 subgrid's 4px label/control gap (Tailwind gap-1).
export const WIDGET_GAP  = "4px";

// Fallback label column: used only if the native label can't be measured at
// runtime (e.g. the v1 renderer). matchLabel() overrides width + font-size to
// the measured native label so the control lines up exactly with the subgrid.
export const LABEL_STYLE = {
  flex: "0 0 72px", color: LABEL_COLOR,
  fontFamily: "inherit", fontSize: "12px",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
