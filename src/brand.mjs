import { readFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contrast, darken, ensureContrast, fromHsl, lighten, luminance, normaliseHex, toHsl,
} from './colour.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The same rules the app applies to Company Details → Brand colours
 * (subsync-app lib/branding.ts), so a schedule or letter from here matches the
 * notices, orders and variations the app prints for the same account.
 *
 *   brand_dark  → "Header panel colour": table header rows. White text only
 *                 when it clears 4.5:1 on white; otherwise the text flips to
 *                 near-black, letterhead style (white is a legitimate choice).
 *   brand_light → "Accent colour": titles, section headings, accent borders.
 *
 * Unset columns fall back to the app's shipped navy and blue.
 */
export const DEFAULT_PANEL = '091747';
export const DEFAULT_ACCENT = '1F5FC4';
const DARK_MIN_CONTRAST_VS_WHITE = 4.5;
const INK = '1A1A1A';
const SUBTEXT = '525252';

/** Status colours carry meaning, so they never follow the tenant's brand. */
const STATUS = {
  statusAccepted: '2E6B4F', statusAcceptedTint: 'E7F1EC',
  statusAmended: '8A5A2B', statusAmendedTint: 'F7EFE3',
  statusRejected: '9B3535', statusRejectedTint: 'F6E9E9',
  statusDiscuss: '3A5573', statusDiscussTint: 'EAEEF4',
};

const REQUIRED_PALETTE_KEYS = [
  'panel', 'onPanel', 'panelRule', 'accent', 'inkOnWhite', 'tint', 'tintSoft',
  'builderZone', 'builderZoneTint', 'ink', 'muted', 'rule', 'ruleSoft', 'paper',
  'band', 'inputField', ...Object.keys(STATUS),
];

export const isDarkPanel = (hex) => contrast(hex, 'FFFFFF') >= DARK_MIN_CONTRAST_VS_WHITE;

export function derivePalette({ panel, accent } = {}) {
  const pnl = normaliseHex(panel) ?? DEFAULT_PANEL;
  const acc = normaliseHex(accent) ?? DEFAULT_ACCENT;
  const dark = isDarkPanel(pnl);

  // Label cells and zone bands: a pale version of the panel, or of the accent
  // when the panel is white and has no colour to lend.
  let tint;
  if (dark) tint = lighten(pnl, 0.86);
  else if (luminance(pnl) > 0.95) tint = lighten(acc, 0.9);
  else tint = lighten(pnl, 0.5);
  for (let i = 0; i < 20 && contrast(SUBTEXT, tint) < 4.8; i += 1) tint = lighten(tint, 0.1);

  // The builder's columns: a neutral slate, apart from the panel in hue or
  // lightness, so "ours" and "theirs" read as different zones on any brand.
  const { h, s } = toHsl(acc);
  const builderZone = ensureContrast(fromHsl({ h, s: Math.min(s, 0.10), l: 0.28 }), 'FFFFFF', 4.5);

  return {
    panel: pnl,
    onPanel: dark ? 'FFFFFF' : INK,
    panelRule: dark ? darken(pnl, 0.22) : 'BDBDBD',
    accent: acc,
    inkOnWhite: dark ? pnl : INK,
    tint,
    tintSoft: lighten(tint, 0.55),
    builderZone,
    builderZoneTint: lighten(builderZone, 0.9),
    ink: INK,
    muted: SUBTEXT,
    rule: 'CFCFCF',
    ruleSoft: 'E3E3E3',
    paper: 'FFFFFF',
    band: 'FAFAFA',
    inputField: 'FFFBF0',
    ...STATUS,
  };
}

/**
 * Build a brand straight from a row of `public.organisations` — the fields
 * behind Settings → Company Details → Brand colours. Asset paths, fonts and
 * contact details come from the caller.
 */
export function brandFromOrganisation(org, { id, logo, fonts, contact } = {}) {
  return finalise({
    id: id ?? org?.id ?? 'organisation',
    name: org?.name ?? '',
    shortName: org?.name ?? '',
    palette: derivePalette({ panel: org?.brand_dark, accent: org?.brand_light }),
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
 * Brand file loader. A file carries `organisation` — the two stored Company
 * Details colours — and the palette is derived from them.
 */
export function loadBrand(idOrPath) {
  const path = idOrPath.endsWith('.json')
    ? (isAbsolute(idOrPath) ? idOrPath : resolve(repoRoot, idOrPath))
    : resolve(repoRoot, 'brand', `${idOrPath}.json`);
  const raw = JSON.parse(readFileSync(path, 'utf8'));

  if (raw.organisation) {
    const palette = derivePalette({ panel: raw.organisation.brand_dark, accent: raw.organisation.brand_light });
    return finalise({ ...raw, fonts: raw.fonts ?? DEFAULT_FONTS, palette });
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
