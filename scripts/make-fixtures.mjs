/**
 * Writes the fictional attachments the sample pack binds in: two SWMS (A4
 * landscape, one running to two pages), an A3 traffic management plan, a
 * certificate of currency and a photographed ticket. They are deliberately
 * unbranded and laid out differently from the pack — attachments arrive in
 * whatever format their author used, and the pack has to cope with that.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { repoRoot } from '../src/brand.mjs';

const dir = resolve(repoRoot, 'samples/fixtures');
mkdirSync(dir, { recursive: true });

const base = `<style>body{font-family:Liberation Sans,Arial,sans-serif;font-size:9pt;margin:0;color:#222}
h1{font-size:15pt;margin:0 0 4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #777;padding:4px 6px;vertical-align:top;text-align:left}
th{background:#d9d9d9}.sample{color:#b00;font-weight:bold}</style>`;

const swmsRows = (steps) => steps.map(([task, hazard, control, risk], i) => `<tr><td>${i + 1}</td><td>${task}</td><td>${hazard}</td><td>${control}</td><td>${risk}</td><td></td></tr>`).join('');

const swms = (ref, rev, title, hrcw, steps) => `${base}
<div style="padding:12mm">
<table style="margin-bottom:8px"><tr><td style="width:65%"><h1>SAFE WORK METHOD STATEMENT</h1>${title}</td>
<td>Ref: <b>${ref}</b><br>Revision: ${rev}<br>Prepared by: Site Manager<br><span class="sample">SAMPLE — FICTIONAL</span></td></tr></table>
<p><b>High risk construction work:</b> ${hrcw}</p>
<table><tr><th>#</th><th>Job step</th><th>Hazards</th><th>Control measures</th><th>Residual risk</th><th>Responsible</th></tr>${swmsRows(steps)}</table>
<p style="margin-top:10px">Workers sign on: ______________________ ______________________ ______________________</p></div>`;

const steps1 = Array.from({ length: 22 }, (_, i) => [
  `Remove facade panel bay ${i + 1} from mast climber`, 'Falling objects; fall from height; manual handling of panels',
  'Exclusion zone below, screens to scaffold, panels lifted by crane with tag lines, harness to anchor', i % 4 ? 'Low' : 'Medium']);
const steps2 = [
  ['Establish exclusion zone around podium', 'Unauthorised entry', 'Hoarding, signage, spotter', 'Low'],
  ['Prop slab below demolition area', 'Collapse', 'Engineer-designed propping inspected before start', 'Medium'],
  ['Saw-cut and lift slab sections', 'Silica dust; noise; collapse', 'Wet cutting, P2 masks, hearing protection, lift plan', 'Medium'],
  ['Load spoil to trucks', 'Plant and pedestrian interaction', 'Traffic controller, separated walkways', 'Low'],
];

const browser = await chromium.launch();
const page = await browser.newPage();
const pdf = async (name, html, opts) => {
  await page.setContent(html);
  await page.pdf({ path: resolve(dir, name), printBackground: true, ...opts });
  console.log('fixture', name);
};

await pdf('swms-01-facade-panel-removal.pdf', swms('SWMS-01', 'B', 'Facade panel removal, levels 1–8', 'Work at heights over 2 m; work near a public road; demolition of load-bearing elements', steps1), { format: 'A4', landscape: true });
await pdf('swms-02-podium-take-down.pdf', swms('SWMS-02', 'A', 'Structural take-down, podium', 'Demolition of load-bearing elements; work involving powered mobile plant', steps2), { format: 'A4', landscape: true });
await pdf('traffic-management-plan.pdf', `${base}<div style="padding:12mm;height:250mm;position:relative">
<h1>TRAFFIC MANAGEMENT PLAN — COLLINS STREET</h1><span class="sample">SAMPLE — FICTIONAL</span>
<div style="position:absolute;left:12mm;right:12mm;top:40mm;height:60mm;background:#ccc;border:2px solid #444;text-align:center;line-height:60mm">COLLINS STREET — LANE 1 CLOSED 7:00 PM–5:00 AM</div>
<div style="position:absolute;left:60mm;top:110mm;width:180mm;height:90mm;border:3px dashed #c60;text-align:center;line-height:90mm">WORK ZONE / CRANE STANDING</div>
<div style="position:absolute;right:20mm;bottom:20mm;border:1px solid #444;padding:6px">Drawing TMP-01 Rev C · Scale 1:200 @ A3</div></div>`, { format: 'A3', landscape: true });
await pdf('certificate-public-liability.pdf', `${base}<div style="padding:20mm">
<h1>CERTIFICATE OF CURRENCY</h1><p class="sample">SAMPLE — FICTIONAL</p>
<table><tr><th style="width:35%">Insured</th><td>Vettex Pty Ltd</td></tr><tr><th>Policy</th><td>Public and Products Liability</td></tr>
<tr><th>Policy number</th><td>PL-0000-0000-SAMPLE</td></tr><tr><th>Period</th><td>31 March 2026 to 31 March 2027</td></tr>
<tr><th>Limit of indemnity</th><td>$20,000,000 any one occurrence</td></tr><tr><th>Interested parties</th><td>Principal and head contractor noted for their vicarious liability</td></tr></table>
<p style="margin-top:20mm">This certificate is a summary only. Refer to the policy wording.</p></div>`, { format: 'A4' });

await page.setViewportSize({ width: 860, height: 540 });
await page.setContent(`${base}<div style="width:820px;height:500px;margin:20px;border-radius:24px;background:linear-gradient(135deg,#2f6d4f,#9dc9a7);color:#fff;padding:30px;box-sizing:border-box;font-size:20px">
<div style="font-size:30px;font-weight:bold">HIGH RISK WORK LICENCE</div><div>SAMPLE — FICTIONAL</div><br>
<div>DEAN KOVAC</div><div>Licence no. HRW-0000000</div><div>Classes: DG (Dogging) · RB (Basic rigging) · WP (Boom-type EWP)</div><div>Expires 02 Nov 2026</div></div>`);
await page.screenshot({ path: resolve(dir, 'ticket-dean-kovac-hrwl.png') });
console.log('fixture', 'ticket-dean-kovac-hrwl.png');
await browser.close();
