import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreCommencementHtml, reconcile, teamRole } from '../src/pre-commencement-pack.mjs';
import { loadBrand } from '../src/brand.mjs';
import { samplePack } from '../src/sample-data.mjs';

test('role and position print once when they say the same thing', () => {
  assert.equal(teamRole({ role: 'Project Manager', position: 'Project Manager' }), 'Project Manager');
  assert.equal(teamRole({ role: 'Contract Administrator', position: 'Contracts Administrator' }), 'Contract Administrator');
  assert.equal(teamRole({ role: 'Project Manager' }), 'Project Manager');
  assert.equal(teamRole({ role: 'Director', position: 'Project Director' }), 'Director — Project Director');
});

test('the sample schedule is $27,000 over the contract sum, all of it outside contract works', () => {
  const r = reconcile(samplePack);
  assert.equal(r.total, 1287000);
  assert.equal(r.contractWorks, 1260000);
  assert.equal(r.variance, 27000);
  assert.equal(r.reconciles, false);
  assert.equal(r.contractWorksReconcile, true);
});

test('a schedule that agrees with the contract sum reports no difference and no flag', () => {
  const pack = { ...samplePack, claimBreakdown: samplePack.claimBreakdown.filter((s) => s.kind === 'contract') };
  assert.equal(reconcile(pack).reconciles, true);
  const html = buildPreCommencementHtml(pack, loadBrand('subsync'), { logoSrc: null });
  assert.ok(!html.includes('class="flag"'));
});

test('no contract sum on record: the pack still builds, without a reconciliation', () => {
  const pack = { ...samplePack, commercial: {} };
  assert.equal(reconcile(pack).variance, null);
  assert.ok(!buildPreCommencementHtml(pack, loadBrand('subsync'), { logoSrc: null }).includes('class="recon"'));
});

test('a brand with no logo prints its name as the wordmark', () => {
  const html = buildPreCommencementHtml(samplePack, loadBrand('brand/examples/ember.json'));
  assert.ok(html.includes('<div class="wordmark">Ember Demolition</div>'));
});

test('expiry is judged on the pack date: expired, inside 30 days, current, none', async () => {
  const { expiryStatus } = await import('../src/pre-commencement-pack.mjs');
  assert.equal(expiryStatus('2026-09-30', '2026-10-14').tone, 'bad');
  assert.equal(expiryStatus('2026-11-02', '2026-10-14').label, 'Expires in 19 days');
  assert.equal(expiryStatus('2027-03-31', '2026-10-14').tone, 'ok');
  assert.equal(expiryStatus(undefined, '2026-10-14').tone, 'none');
});

test('attachments are lettered in section order: tickets, certificates, then SWMS, plans, licences', async () => {
  const { planAttachments } = await import('../src/pre-commencement-pack.mjs');
  const list = planAttachments(samplePack);
  assert.deepEqual(list.map((a) => [a.letter, a.kind]), [
    ['A', 'Ticket'], ['B', 'Insurance'], ['C', 'SWMS'], ['D', 'SWMS'], ['E', 'Plan'],
  ]);
});

test('only the parts ticked on the pack screen are printed', () => {
  const pack = { ...samplePack, credentials: undefined, insurances: undefined, documents: undefined };
  const html = buildPreCommencementHtml(pack, loadBrand('subsync'), { logoSrc: null });
  for (const title of ['Tickets and inductions', 'Insurances', 'Safety and compliance documents', 'Attachments']) {
    assert.ok(!html.includes(`<h2>${title}</h2>`), title);
  }
  assert.ok(html.includes('<h2>Project team</h2>'));
});

test('documents without a file are listed as not attached', () => {
  const html = buildPreCommencementHtml(samplePack, loadBrand('subsync'), { logoSrc: null });
  assert.ok(html.includes('Demolition and asbestos removal licence'));
  assert.match(html, /Class A[\s\S]*?Not attached/);
});

test('the bound pack numbers attachments straight on from the pack pages', { timeout: 120000 }, async () => {
  const { buildPack } = await import('../src/pre-commencement-pack.mjs');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const out = join(mkdtempSync(join(tmpdir(), 'pack-')), 'pack.pdf');
  const { pages, attachments } = await buildPack(samplePack, loadBrand('subsync'), out, { logoSrc: null });
  assert.equal(attachments[0].start, pages - attachments.reduce((n, a) => n + a.pages, 0) + 1);
  for (let i = 1; i < attachments.length; i += 1) assert.equal(attachments[i].start, attachments[i - 1].end + 1);
  assert.equal(attachments.at(-1).end, pages);
});
