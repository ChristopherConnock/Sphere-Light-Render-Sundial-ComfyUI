import { suggestCities } from "./geo.js";
import { FIELD_BG, FIELD_TEXT, WIDGET_GAP, LABEL_STYLE } from "./widget_style.js";

// A searchable location input: an <input> plus a dropdown of ranked city
// suggestions. The dropdown is attached to <body> with fixed positioning so it
// is never clipped by the node/canvas. Framework-agnostic — no ComfyUI/Vue
// dependency — so it can be unit-driven in a plain browser.
//
// Options:
//   getRecords() -> city records array (may be empty until cities.json loads)
//   initial      -> initial text
//   onSelect(rec)-> a suggestion was chosen
//   onText(text) -> the free text changed (typed, not yet chosen)
//
// Returns { element, setText, getText, reposition, destroy }.

export function formatLabel(rec) {
  return `${rec.city}, ${rec.region || rec.countryName || rec.country}`;
}

export function createLocationSearch({ getRecords, initial = "", onSelect, onText, label } = {}) {
  // A flex row: a fixed-width label column beside the input, so the input's left
  // edge lands on the node's control column like the native widgets. (DOM widgets
  // get no built-in label, and — in the v2 Vue node grid — span the label+control
  // columns as one block, so we recreate the label column ourselves.)
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

  const input = document.createElement("input");
  input.type = "text";
  input.value = initial;
  input.placeholder = "type a city…";
  input.spellcheck = false;
  // Match the native v2 widget: filled background token, no border, rounded-lg,
  // widget foreground text. Falls back to classic CSS vars on the v1 renderer.
  Object.assign(input.style, {
    flex: "1 1 auto", minWidth: "0", boxSizing: "border-box", padding: "7px 12px",
    background: FIELD_BG, color: FIELD_TEXT, border: "none",
    borderRadius: "8px", fontFamily: "inherit", fontSize: "12px", outline: "none",
  });
  container.appendChild(input);

  const menu = document.createElement("div");
  Object.assign(menu.style, {
    position: "fixed", zIndex: "10000", display: "none", maxHeight: "220px",
    overflowY: "auto", overflowX: "hidden",
    background: "var(--comfy-menu-bg, #1b1b1b)",
    color: "var(--input-text, #dddddd)",
    border: "1px solid var(--border-color, #444444)",
    borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    fontFamily: "inherit", fontSize: "13px",
  });
  document.body.appendChild(menu);

  let items = [];
  let active = -1;

  const position = () => {
    const r = input.getBoundingClientRect();
    menu.style.left = `${r.left}px`;
    menu.style.top = `${r.bottom + 2}px`;
    menu.style.width = `${r.width}px`;
  };

  const close = () => { menu.style.display = "none"; active = -1; };

  const paintActive = () => {
    [...menu.children].forEach((el, i) => {
      el.style.background = i === active ? "#35506b" : "transparent";
    });
  };

  const setActive = (i) => {
    active = Math.max(-1, Math.min(i, items.length - 1));
    paintActive();
    if (active >= 0) menu.children[active].scrollIntoView({ block: "nearest" });
  };

  const choose = (i) => {
    const rec = items[i];
    if (!rec) return;
    input.value = formatLabel(rec);
    close();
    onSelect?.(rec);
  };

  const render = (list) => {
    items = list;
    active = -1;
    menu.innerHTML = "";
    if (!list.length) { close(); return; }
    list.forEach((rec, i) => {
      const row = document.createElement("div");
      row.style.padding = "4px 8px";
      row.style.cursor = "pointer";
      row.style.color = "inherit";
      row.style.whiteSpace = "nowrap";
      row.style.overflow = "hidden";
      row.style.textOverflow = "ellipsis";
      // Built from text nodes (not innerHTML) so city data can never inject markup.
      row.appendChild(document.createTextNode(formatLabel(rec)));
      if (rec.country) {
        const cc = document.createElement("span");
        cc.style.color = "var(--descrip-text, #888888)";
        cc.textContent = ` ${rec.country}`;
        row.appendChild(cc);
      }
      row.addEventListener("mousedown", (e) => { e.preventDefault(); choose(i); });
      row.addEventListener("mouseenter", () => setActive(i));
      menu.appendChild(row);
    });
    position();
    menu.style.display = "block";
  };

  const refresh = () => render(suggestCities(input.value, getRecords?.() || [], 8));

  input.addEventListener("input", () => { onText?.(input.value); refresh(); });
  input.addEventListener("focus", () => { if (input.value) refresh(); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    if (menu.style.display === "none") return;
    if (e.key === "ArrowDown") { setActive(active + 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setActive(active - 1); e.preventDefault(); }
    else if (e.key === "Enter") { if (active >= 0) { choose(active); e.preventDefault(); } }
    else if (e.key === "Escape") { close(); }
  });

  return {
    element: container,
    setText: (t) => { input.value = t ?? ""; },
    getText: () => input.value,
    reposition: position,
    // Size the label column so the input's left edge lands exactly on the
    // node's native control column. `targetLeft` is that column's viewport x,
    // `scale` the canvas zoom. Two-pass: aim, measure the residual, correct.
    matchLabel: ({ targetLeft, fontSize, scale = 1 } = {}) => {
      if (!labelEl) return;
      if (fontSize) labelEl.style.fontSize = fontSize;
      container.style.gap = "0px";
      if (targetLeft == null || !container.isConnected) return;
      const contLeft = container.getBoundingClientRect().left;
      const w = (targetLeft - contLeft) / scale;
      labelEl.style.flex = `0 0 ${Math.max(w, 0)}px`;
      const residual = (input.getBoundingClientRect().left - targetLeft) / scale;
      labelEl.style.flex = `0 0 ${Math.max(w - residual, 0)}px`;
    },
    destroy: () => { menu.remove(); },
  };
}
