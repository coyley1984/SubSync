import { readFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_PALETTE_KEYS = [
  'ink', 'brand', 'brandDark', 'brandTint', 'brandTintSoft', 'muted',
  'rule', 'ruleSoft', 'paper', 'band', 'inputField', 'accent', 'accentTint',
  'statusAccepted', 'statusAcceptedTint', 'statusAmended', 'statusAmendedTint',
  'statusRejected', 'statusRejectedTint', 'statusDiscuss', 'statusDiscussTint',
];

/**
 * Brand tokens are data, not code. One JSON file per account: the account's
 * logo files plus the palette applied to every SubSync deliverable. Swap the
 * file and the same generator produces the subcontractor's own branding.
 */
export function loadBrand(idOrPath) {
  const path = idOrPath.endsWith('.json')
    ? (isAbsolute(idOrPath) ? idOrPath : resolve(repoRoot, idOrPath))
    : resolve(repoRoot, 'brand', `${idOrPath}.json`);

  const brand = JSON.parse(readFileSync(path, 'utf8'));
  const missing = REQUIRED_PALETTE_KEYS.filter((k) => !brand.palette?.[k]);
  if (missing.length) {
    throw new Error(`brand ${brand.id ?? path}: palette missing ${missing.join(', ')}`);
  }
  for (const [key, value] of Object.entries(brand.palette)) {
    if (!/^[0-9A-Fa-f]{6}$/.test(value)) {
      throw new Error(`brand ${brand.id}: palette.${key} must be a 6-digit hex without '#', got '${value}'`);
    }
    brand.palette[key] = value.toUpperCase();
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
