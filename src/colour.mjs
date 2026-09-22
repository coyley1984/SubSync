/** Small colour toolkit — enough to turn two stored brand colours into a
 *  full, contrast-checked palette. Hex in and out, no '#'. */

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function normaliseHex(value) {
  if (value == null) return null;
  const m = String(value).trim().replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return hex.toUpperCase();
}

export const toRgb = (hex) => ({
  r: parseInt(hex.slice(0, 2), 16) / 255,
  g: parseInt(hex.slice(2, 4), 16) / 255,
  b: parseInt(hex.slice(4, 6), 16) / 255,
});

export const fromRgb = ({ r, g, b }) =>
  [r, g, b].map((c) => Math.round(clamp(c) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function luminance(hex) {
  const { r, g, b } = toRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** max − min of the RGB channels: how much colour, independent of lightness. */
export function chroma(hex) {
  const { r, g, b } = toRgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

export function mix(a, b, t) {
  const x = toRgb(a);
  const y = toRgb(b);
  return fromRgb({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const lighten = (hex, t) => mix(hex, 'FFFFFF', t);
export const darken = (hex, t) => mix(hex, '000000', t);

export function toHsl(hex) {
  const { r, g, b } = toRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h / 6, s, l };
}

export function fromHsl({ h, s, l }) {
  if (s === 0) return fromRgb({ r: l, g: l, b: l });
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return fromRgb({ r: hue(h + 1 / 3), g: hue(h), b: hue(h - 1 / 3) });
}

/** Darken `hex` in small steps until it reaches `ratio` against `against`. */
export function ensureContrast(hex, against, ratio) {
  let out = hex;
  for (let i = 0; i < 40 && contrast(out, against) < ratio; i += 1) out = darken(out, 0.05);
  return out;
}
