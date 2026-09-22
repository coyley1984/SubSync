import { readFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chroma, contrast, darken, ensureContrast, fromHsl, lighten, luminance, normaliseHex, toHsl,
} from './colour.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Used when an organisation has not set brand colours (most have not). */
const NEUTRAL_BRAND = '404040';

/** Status colours carry meaning, so they never follow the tenant's brand. */
const STATUS = {
  statusAccepted: '2E6B4F', statusAcceptedTint: 'E7F1EC',
  statusAmended: '8A5A2B', statusAmendedTint: 'F7EFE3',
  statusRejected: '9B3535', statusRejectedTint: 'F6E9E9',
  statusDiscuss: '3A5573', statusDiscussTint: 'EAEEF4',
};

const REQUIRED_PALETTE_KEYS = [
  'ink', 'brand', 'brandDark', 'brandTint', 'brandTintSoft', 'muted',
  'rule', 'ruleSoft', 'paper', 'band', 'inputField', 'accent', 'accentTint',
  ...Object.keys(STATUS),
];

/**
 * Which of the two stored colours is the brand colour.
 *
 * Company Details stores `brand_light` and `brand_dark`, but accounts fill
 * them in inconsistently — a dark blue under "light", white under "dark", a
 * mid-grey beside the actual brand blue. The field names can't be trusted, so
 * the colour with the most chroma is taken as the brand, and the other as its
 * secondary. When both are equally (un)saturated, the darker one wins because
 * it can carry white text.
 */
export function pickBrandColours(first, second) {
  const cols = [normaliseHex(first), normaliseHex(second)].filter(Boolean);
  if (cols.length === 0) return { primary: null, secondary: null };
  if (cols.length === 1) return { primary: cols[0], secondary: null };
  const [a, b] = cols;
  if (Math.abs(chroma(a) - chroma(b)) > 0.08) {
    return chroma(a) > chroma(b) ? { primary: a, secondary: b } : { primary: b, secondary: a };
  }
  return luminance(a) <= luminance(b) ? { primary: a, secondary: b } : { primary: b, secondary: a };
}

/**
 * Two colours in, a full contrast-checked palette out.
 *   brand   — header fills and the masthead rule; darkened if needed so white
 *             text on it clears 4.5:1
 *   tint    — label cells and zone bands; the secondary colour when there is
 *             one, lightened only as far as needed for label text to read
 *   neutrals— greys carrying a trace of the brand hue so they sit with it
 *   accent  — the builder's zone: a neutral slate, far enough from the brand
 *             in hue or lightness that the two zones read as different
 */
export function derivePalette({ primary, secondary } = {}) {
  const base = normaliseHex(primary) ?? NEUTRAL_BRAND;
  const brand = ensureContrast(base, 'FFFFFF', 4.5);
  const { h, s, l } = toHsl(brand);
  const neutral = (lightness, sat = Math.min(s, 0.12)) => fromHsl({ h, s: sat, l: lightness });

  const ink = ensureContrast(neutral(0.16), 'FFFFFF', 12);
  const muted = ensureContrast(neutral(0.38), 'FFFFFF', 5.5);

  let brandTint = null;
  const sec = normaliseHex(secondary);
  if (sec && luminance(sec) < 0.95) {
    brandTint = sec;
    for (let i = 0; i < 30 && contrast(muted, brandTint) < 4.8; i += 1) brandTint = lighten(brandTint, 0.06);
    if (luminance(brandTint) > 0.95) brandTint = null;   // lightened into the paper: no band left to see
  }
  brandTint ??= lighten(brand, 0.86);

  const accent = ensureContrast(neutral(l < 0.3 ? 0.42 : 0.26, Math.min(s, 0.10)), 'FFFFFF', 4.5);

  return {
    ink,
    brand,
    brandDark: darken(brand, 0.22),
    brandTint,
    brandTintSoft: lighten(brandTint, 0.6),
    muted,
    rule: neutral(0.80),
    ruleSoft: neutral(0.89),
    paper: 'FFFFFF',
    band: lighten(brandTint, 0.8),
    inputField: 'FFFBF0',
    accent,
    accentTint: lighten(accent, 0.9),
    ...STATUS,
  };
}

/**
 * Build a brand straight from a row of `public.organisations` — the fields
 * behind Settings → Company Details → Brand colours. Asset paths, fonts and
 * contact details come from the caller.
 */
export function brandFromOrganisation(org, { id, logo, fonts, contact } = {}) {
  const colours = pickBrandColours(org?.brand_light, org?.brand_dark);
  return finalise({
    id: id ?? org?.id ?? 'organisation',
    name: org?.name ?? '',
    shortName: org?.name ?? '',
    source: { brand_light: org?.brand_light ?? null, brand_dark: org?.brand_dark ?? null },
    colours,
    palette: derivePalette(colours),
    logo: logo ?? { print: null, email: null, alt: org?.name ?? '', aspectRatio: null },
    fonts: fonts ?? DEFAULT_FONTS,
    contact: contact ?? {},
  });
}

const DEFAULT_FONTS = {
  spreadsheet: 'Calibri',
  spreadsheetFallback: 'Arial',
  email: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

/**
 * Brand file loader. A file either carries `organisation` (the two stored
 * Company Details colours, from which the palette is derived) or an explicit
 * `palette` — the latter only for SubSync's own product chrome.
 */
export function loadBrand(idOrPath) {
  const path = idOrPath.endsWith('.json')
    ? (isAbsolute(idOrPath) ? idOrPath : resolve(repoRoot, idOrPath))
    : resolve(repoRoot, 'brand', `${idOrPath}.json`);
  const raw = JSON.parse(readFileSync(path, 'utf8'));

  if (raw.organisation) {
    const colours = pickBrandColours(raw.organisation.brand_light, raw.organisation.brand_dark);
    return finalise({ ...raw, fonts: raw.fonts ?? DEFAULT_FONTS, colours, palette: derivePalette(colours) });
  }
  return finalise({ ...raw, fonts: raw.fonts ?? DEFAULT_FONTS });
}

function finalise(brand) {
  const missing = REQUIRED_PALETTE_KEYS.filter((k) => !brand.palette?.[k]);
  if (missing.length) throw new Error(`brand ${brand.id}: palette missing ${missing.join(', ')}`);
  for (const [key, value] of Object.entries(brand.palette)) {
    const hex = normaliseHex(value);
    if (!hex) throw new Error(`brand ${brand.id}: palette.${key} is not a hex colour: '${value}'`);
    brand.palette[key] = hex;
  }
  return brand;
}

/** '#404040' for CSS. */
export const css = (hex) => `#${hex}`;

/** 'FF404040' — Excel wants ARGB. */
export const argb = (hex) => `FF${hex}`;

export function brandAsset(brand, kind) {
  const rel = brand.logo?.[kind];
  return rel ? resolve(repoRoot, rel) : null;
}

export { repoRoot };
