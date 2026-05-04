// Mirror of venues.color_config so we can render hanger tiles without a roundtrip.
// If venue color_config drifts, fetch venue.color_config at boot and override.

export const COLOR_CONFIG = [
  { color: "yellow",  range_start: 1,   range_end: 33,  hex: "#F5C518", tint_hex: "#FAC775", border_hex: "#854F0B", text_hex: "#412402" },
  { color: "red",     range_start: 34,  range_end: 66,  hex: "#E24B4A", tint_hex: "#F2A1A0", border_hex: "#5C0E0D", text_hex: "#3A0707" },
  { color: "blue",    range_start: 67,  range_end: 99,  hex: "#378ADD", tint_hex: "#85B7EB", border_hex: "#0E3D6B", text_hex: "#042C53" },
  { color: "green",   range_start: 100, range_end: 132, hex: "#97C459", tint_hex: "#BDDB8C", border_hex: "#3A5C13", text_hex: "#173404" },
  { color: "orange",  range_start: 133, range_end: 165, hex: "#F0997B", tint_hex: "#F5C09E", border_hex: "#7A2F0E", text_hex: "#4A1A06" },
  { color: "magenta", range_start: 166, range_end: 200, hex: "#D4537E", tint_hex: "#E593AF", border_hex: "#7A1D3C", text_hex: "#4B1528" },
];

export function colorFor(name) {
  return COLOR_CONFIG.find(c => c.color === name) ?? COLOR_CONFIG[0];
}

export function colorForNumber(n) {
  return COLOR_CONFIG.find(c => n >= c.range_start && n <= c.range_end) ?? COLOR_CONFIG[0];
}

export function tile(number, color, size = "md") {
  const c = typeof color === "string" ? colorFor(color) : color;
  const el = document.createElement("div");
  el.className = `hanger-tile ${size}`;
  el.style.background    = c.tint_hex;
  el.style.borderColor   = c.border_hex;
  el.style.color         = c.text_hex;
  el.textContent = number;
  return el;
}
