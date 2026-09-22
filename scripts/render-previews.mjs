/**
 * Dev-only: renders the email with the logo inlined as a data URI so it can be
 * opened in a browser. The real send uses cid:brandlogo, which only resolves
 * in a mail client.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBrand, brandAsset, repoRoot } from '../src/brand.mjs';
import { sampleReview } from '../src/sample-data.mjs';
import { buildDeparturesEmail } from '../src/departures-email.mjs';

const brand = loadBrand(process.env.BRAND ?? 'vettex');
const product = loadBrand('subsync');
const logo = readFileSync(brandAsset(brand, 'email') ?? brandAsset(brand, 'print'));
const dataUri = `data:image/png;base64,${logo.toString('base64')}`;

const dir = resolve(repoRoot, 'samples/preview');
mkdirSync(dir, { recursive: true });
const { html } = buildDeparturesEmail(sampleReview, brand, product, { logoSrc: dataUri });
const out = resolve(dir, 'departures-email.preview.html');
writeFileSync(out, html);
console.log(out);
