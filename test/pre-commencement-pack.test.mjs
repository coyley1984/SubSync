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
