import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBrand, repoRoot } from '../src/brand.mjs';
import { sampleReview } from '../src/sample-data.mjs';
import { buildCommercialSummary } from '../src/commercial-summary.mjs';
import { buildDeparturesEmail, writeEml } from '../src/departures-email.mjs';

const outDir = resolve(repoRoot, 'samples');
mkdirSync(outDir, { recursive: true });

const brand = loadBrand(process.env.BRAND ?? 'vettex');
const product = loadBrand('subsync');
const review = sampleReview;

const slug = `${review.subcontractor.name} (ACN ${review.subcontractor.acn}) - ${review.project.name} - Commercial Summary Schedule`;
const xlsxPath = resolve(outDir, `${slug}.xlsx`);
await buildCommercialSummary(review, brand, xlsxPath);
console.log('xlsx   ', xlsxPath);

const email = buildDeparturesEmail(review, brand, product);
const { writeFileSync } = await import('node:fs');
writeFileSync(resolve(outDir, 'departures-email.html'), email.html);
writeFileSync(resolve(outDir, 'departures-email.txt'), email.text);
console.log('html   ', resolve(outDir, 'departures-email.html'));

const emlPath = resolve(outDir, 'departures-email.eml');
await writeEml({ email, brand, review, attachment: { path: xlsxPath, filename: `${slug}.xlsx` }, outPath: emlPath });
console.log('eml    ', emlPath);
