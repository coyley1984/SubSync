import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandFromOrganisation, DEFAULT_ACCENT, DEFAULT_PANEL, derivePalette } from '../src/brand.mjs';
import { contrast } from '../src/colour.mjs';

// Every brand_dark / brand_light pairing currently stored in organisations.
// brand_dark is the "Header panel colour", brand_light the "Accent colour".
const STORED = [
  { dark: '#e6e6e6', light: '#1f5fc4' }, // light grey panel — letterhead style
  { dark: '#ffffff', light: '#e06029' }, // white panel ("Use white" in settings)
  { dark: '#f21897', light: '#f686fe' },
  { dark: '#40abef', light: '#8e8e8e' },
  { dark: '#c2c2c2', light: '#1f5fc4' },
];

const org = ({ dark, light }) => ({ name: 'x', brand_dark: dark, brand_light: light });

test('columns map to the same roles the app gives them — no guessing', () => {
  for (const pair of STORED) {
    const p = brandFromOrganisation(org(pair)).palette;
    assert.equal(p.panel, pair.dark.slice(1).toUpperCase(), `panel from brand_dark: ${pair.dark}`);
    assert.equal(p.accent, pair.light.slice(1).toUpperCase(), `accent from brand_light: ${pair.light}`);
  }
});

test('panel text follows the app: white at 4.5:1 or better, near-black otherwise', () => {
  assert.equal(derivePalette({ panel: '091747' }).onPanel, 'FFFFFF');     // navy: dark panel
  assert.equal(derivePalette({ panel: 'E6E6E6' }).onPanel, '1A1A1A');     // grey: letterhead
  assert.equal(derivePalette({ panel: 'FFFFFF' }).onPanel, '1A1A1A');     // white: letterhead
  assert.equal(derivePalette({ panel: '878787' }).onPanel, '1A1A1A');     // 3.5:1 — the app's own reported case
});

test('whichever text colour the rule picks is the more legible of the two', () => {
  for (const pair of STORED) {
    const p = brandFromOrganisation(org(pair)).palette;
    const other = p.onPanel === 'FFFFFF' ? '1A1A1A' : 'FFFFFF';
    assert.ok(contrast(p.onPanel, p.panel) >= contrast(other, p.panel), `panel ${pair.dark}`);
  }
});

test('every stored pairing keeps body text, labels and builder zone legible', () => {
  for (const pair of [...STORED, { dark: null, light: null }]) {
    const p = brandFromOrganisation(org(pair)).palette;
    const label = `${pair.dark} / ${pair.light}`;
    assert.ok(contrast(p.inkOnWhite, 'FFFFFF') >= 4.5, `register values on paper: ${label}`);
    assert.ok(contrast(p.muted, p.tint) >= 4.5, `label text on tint: ${label}`);
    assert.ok(contrast('FFFFFF', p.builderZone) >= 4.5, `white on builder zone: ${label}`);
    assert.ok(contrast(p.panel, p.builderZone) >= 1.3, `zones distinguishable: ${label} (${p.panel} vs ${p.builderZone})`);
  }
});

test('a light panel never prints as text on white; a dark one does', () => {
  assert.equal(derivePalette({ panel: 'E6E6E6' }).inkOnWhite, '1A1A1A');
  assert.equal(derivePalette({ panel: '091747' }).inkOnWhite, '091747');
});

test('a white panel borrows its tint from the accent', () => {
  const p = derivePalette({ panel: 'FFFFFF', accent: 'E06029' });
  assert.notEqual(p.tint, 'FFFFFF');
  assert.ok(contrast(p.tint, 'FFFFFF') > 1.05);
});

test('unset colours fall back to the app defaults, not a palette of our own', () => {
  const p = brandFromOrganisation({ name: 'x', brand_dark: null, brand_light: null }).palette;
  assert.equal(p.panel, DEFAULT_PANEL);
  assert.equal(p.accent, DEFAULT_ACCENT);
  assert.equal(DEFAULT_PANEL, '091747');
  assert.equal(DEFAULT_ACCENT, '1F5FC4');
});

test('malformed stored values fall back rather than throw', () => {
  const p = brandFromOrganisation({ name: 'x', brand_dark: 'nope', brand_light: '' }).palette;
  assert.equal(p.panel, DEFAULT_PANEL);
  assert.equal(p.accent, DEFAULT_ACCENT);
});
