import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandFromOrganisation, derivePalette, pickBrandColours } from '../src/brand.mjs';
import { contrast } from '../src/colour.mjs';

// Every brand_light / brand_dark pairing currently stored in organisations,
// plus the empty case most accounts are in. Which field holds what varies.
const STORED_PAIRS = [
  { light: '#1f5fc4', dark: '#e6e6e6', brand: '1F5FC4' }, // strong colour under "light"
  { light: '#e06029', dark: '#ffffff', brand: 'E06029' }, // white under "dark"
  { light: '#f686fe', dark: '#f21897', brand: 'F21897' }, // both chromatic
  { light: '#8e8e8e', dark: '#40abef', brand: '40ABEF' }, // grey is the darker one
  { light: '#1f5fc4', dark: '#c2c2c2', brand: '1F5FC4' },
];

test('the chromatic colour is the brand, whichever field it is in', () => {
  for (const { light, dark, brand } of STORED_PAIRS) {
    assert.equal(pickBrandColours(light, dark).primary, brand, `${light} / ${dark}`);
    assert.equal(pickBrandColours(dark, light).primary, brand, `${dark} / ${light} swapped`);
  }
});

test('every stored pairing produces a legible palette', () => {
  for (const { light, dark } of [...STORED_PAIRS, { light: null, dark: null }]) {
    const p = brandFromOrganisation({ name: 'x', brand_light: light, brand_dark: dark }).palette;
    const label = `${light} / ${dark}`;
    assert.ok(contrast('FFFFFF', p.brand) >= 4.5, `white on brand: ${label}`);
    assert.ok(contrast('FFFFFF', p.accent) >= 4.5, `white on accent: ${label}`);
    assert.ok(contrast(p.ink, 'FFFFFF') >= 12, `ink on paper: ${label}`);
    assert.ok(contrast(p.muted, 'FFFFFF') >= 4.5, `muted on paper: ${label}`);
    assert.ok(contrast(p.muted, p.brandTint) >= 4.5, `label text on tint: ${label}`);
    assert.ok(contrast(p.brand, p.accent) >= 1.3, `zones distinguishable: ${label} (${p.brand} vs ${p.accent})`);
  }
});

test('a stored colour too pale for white text is darkened, not replaced', () => {
  const p = derivePalette({ primary: 'E06029' });
  assert.notEqual(p.brand, 'E06029');
  assert.ok(contrast('FFFFFF', p.brand) >= 4.5);
});

test('no brand colours falls back to a neutral palette', () => {
  const p = brandFromOrganisation({ name: 'x', brand_light: null, brand_dark: null }).palette;
  assert.equal(p.brand, '404040');
});

test('malformed stored values are ignored rather than thrown', () => {
  assert.deepEqual(pickBrandColours('not-a-colour', ''), { primary: null, secondary: null });
  assert.equal(pickBrandColours('#abc', null).primary, 'AABBCC');
});
