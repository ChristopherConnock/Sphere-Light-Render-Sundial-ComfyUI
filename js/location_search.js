import { suggestCities } from "./geo.js";

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

export function createLocationSearch({ getRecords, initial = "", onSelect, onText } = {}) {
  const container = document.createElement("div");
  container.style.width = "100%";

  const input = document.createElement("input");
  input.type = "text";
  input.value = initial;
  input.placeholder = "type a city…";
  input.spellcheck = false;
  Object.assign(input.style, {
    width: "100%", boxSizing: "border-box", padding: "3px 6px",
    background: "#222", color: "#ddd", border: "1px solid #444",
    borderRadius: "4px", font: "12px sans-serif", outline: "none",
  });
  container.appendChild(input);

  const menu = document.createElement("div");
  Object.assign(menu.style, {
    position: "fixed", zIndex: "10000", display: "none", maxHeight: "200px",
    overflowY: "auto", background: "#1b1b1b", border: "1px solid #444",
    borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    font: "12px sans-serif",
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
      row.style.color = "#ddd";
      row.style.whiteSpace = "nowrap";
      // Built from text nodes (not innerHTML) so city data can never inject markup.
      row.appendChild(document.createTextNode(formatLabel(rec)));
      if (rec.country) {
        const cc = document.createElement("span");
        cc.style.color = "#777";
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
    destroy: () => { menu.remove(); },
  };
}
