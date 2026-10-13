/**
 * Builds the Pre-Commencement Pack for each brand, so the same payload can be
 * checked against every kind of Company Details colouring: a logo on a light
 * grey panel (Vettex), the app defaults (SubSync navy), a white panel, and a
 * saturated panel with a pale accent.
 *
 *   npm run build:pack                        all four
 *   BRAND=brand/acme.json npm run build:pack  one
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBrand, repoRoot } from '../src/brand.mjs';
import { samplePack } from '../src/sample-data.mjs';
import { buildPreCommencementHtml, footerTemplate, renderPdf } from '../src/pre-commencement-pack.mjs';

const brands = process.env.BRAND
  ? [process.env.BRAND]
  : ['vettex', 'subsync', 'brand/examples/ember.json', 'brand/examples/fuchsia.json'];

const outDir = resolve(repoRoot, 'samples/pre-commencement');
const previewDir = resolve(repoRoot, 'samples/preview');
mkdirSync(outDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

for (const id of brands) {
  const brand = loadBrand(id);
  const pack = { ...samplePack, preparedBy: { entity: brand.name } };
  const html = buildPreCommencementHtml(pack, brand);
  const base = `Pre-Commencement Pack - ${pack.project.name} - ${brand.shortName}`;
  writeFileSync(resolve(outDir, `${base}.html`), html);
  const pdf = await renderPdf(html, resolve(outDir, `${base}.pdf`), { footer: footerTemplate(pack, brand) });
  console.log('pdf    ', pdf);

  // Page previews, when poppler is on the path.
  try {
    execFileSync('pdftoppm', ['-r', '70', '-png', pdf, resolve(previewDir, `pack-${brand.id}`)]);
  } catch { /* previews are optional */ }
}
