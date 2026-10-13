import { readFileSync } from 'node:fs';
import { brandAsset, css } from './brand.mjs';
import { formatDate } from './layout.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n) => {
  const abs = Math.abs(Number(n)).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '−' : ''}$${abs}`;
};

const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : '');

const sum = (items) => items.reduce((t, i) => t + Number(i.amount), 0);

/**
 * Emails break only after the @, never mid-word, so a long address wraps as
 * `anita.rahman@` / `demo-seed.subsync.com.au` rather than `demo-` / `seed`.
 */
const breakableEmail = (email) => {
  const at = email.lastIndexOf('@');
  if (at < 0) return `<span class="nowrap">${esc(email)}</span>`;
  return `<span class="nowrap">${esc(email.slice(0, at + 1))}</span><wbr><span class="nowrap">${esc(email.slice(at + 1))}</span>`;
};

const singular = (s) => s.toLowerCase().split(/\s+/).map((w) => w.replace(/s$/, '')).join(' ');

/**
 * The app joins role and position as `Role — Position`, which prints
 * "Project Manager — Project Manager" when the two say the same thing.
 * Show the position only when it adds something.
 */
export function teamRole({ role, position }) {
  if (!position) return role ?? '';
  if (!role) return position;
  return singular(role) === singular(position) ? role : `${role} — ${position}`;
}

/**
 * The schedule of values against the contract sum. Contract works are the
 * sections of kind `contract`; provisional sums and adjustments sit outside
 * them, which is the usual reason a schedule total and a contract sum differ.
 */
export function reconcile(pack) {
  const sections = pack.claimBreakdown.map((s) => ({ ...s, subtotal: sum(s.items) }));
  const total = sections.reduce((t, s) => t + s.subtotal, 0);
  const contractWorks = sections.filter((s) => s.kind === 'contract').reduce((t, s) => t + s.subtotal, 0);
  const contractSum = pack.commercial?.contractSum ?? null;
  const variance = contractSum == null ? null : Math.round((total - contractSum) * 100) / 100;
  return {
    sections,
    total,
    contractWorks,
    contractSum,
    variance,
    reconciles: variance === 0,
    contractWorksReconcile: contractSum != null && Math.round((contractWorks - contractSum) * 100) === 0,
  };
}

function logoMarkup(brand, logoSrc) {
  if (logoSrc) {
    return `<img class="logo" src="${logoSrc}" alt="${esc(brand.logo?.alt ?? brand.name)}" />`;
  }
  // No logo on file: the entity name as a wordmark, so the masthead is never empty.
  return `<div class="wordmark">${esc(brand.shortName || brand.name)}</div>`;
}

export function logoDataUri(brand) {
  const path = brandAsset(brand, 'print');
  return path ? `data:image/png;base64,${readFileSync(path).toString('base64')}` : null;
}

/**
 * Builds the Pre-Commencement Pack as print HTML (A4 portrait). Colours come
 * from the issuing account's Company Details, the same way the schedule and
 * the departures email take them:
 *
 *   panel / onPanel  table header rows (white text only on a dark panel)
 *   accent           rules and bars
 *   accentInk        the accent when it carries words — darkened until it reads
 *   tint / tintSoft  section rows, label cells, cover summary
 */
export function buildPreCommencementHtml(pack, brand, { logoSrc = logoDataUri(brand) } = {}) {
  const p = brand.palette;
  const font = brand.fonts.document;
  const doc = pack.document ?? {};
  const rec = reconcile(pack);

  const metaRow = (label, value) => (value ? `
        <tr><th>${esc(label)}</th><td>${value}</td></tr>` : '');

  const docControl = [doc.reference, doc.revision && `Rev ${doc.revision}`].filter(Boolean).join(' · ');

  const figure = (label, value, note, tone = '') => `
      <div class="figure ${tone}">
        <div class="figure-label">${esc(label)}</div>
        <div class="figure-value">${value}</div>
        ${note ? `<div class="figure-note">${note}</div>` : ''}
      </div>`;

  const varianceNote = () => {
    if (rec.variance == null) return '';
    if (rec.reconciles) return 'Schedule reconciles to the contract sum';
    const outside = rec.sections.filter((s) => s.kind !== 'contract');
    const parts = outside.map((s) => `${esc(s.title.toLowerCase())} ${money(s.subtotal)}`).join(', ');
    return rec.contractWorksReconcile
      ? `Contract works reconcile. The difference is ${parts}.`
      : 'Schedule does not reconcile to the contract sum.';
  };

  const flag = () => {
    if (rec.variance == null || rec.reconciles) return '';
    const outside = rec.sections.filter((s) => s.kind !== 'contract');
    const lines = outside.map((s) => `<li>${esc(s.title)}: ${money(s.subtotal)}</li>`).join('');
    const body = rec.contractWorksReconcile
      ? `<p>Contract works total ${money(rec.contractWorks)} and agree with the contract sum. The ${money(Math.abs(rec.variance))} difference is made up of the lines that sit outside it:</p>
         <ul>${lines}</ul>
         <p>To be confirmed before the first progress claim: whether the contract sum is inclusive of provisional sums, and whether the credit has already been taken.</p>`
      : `<p>The schedule total is ${money(rec.total)} against a recorded contract sum of ${money(rec.contractSum)}. Contract works alone total ${money(rec.contractWorks)}. The schedule should be corrected before it is used to assess a claim.</p>`;
    return `
    <div class="flag">
      <div class="flag-title">Schedule ${rec.variance > 0 ? 'exceeds' : 'falls short of'} the contract sum by ${money(Math.abs(rec.variance))}</div>
      ${body}
    </div>`;
  };

  const claimRows = rec.sections.map((s, si) => `
        <tbody class="section">
          <tr class="section-row"><td class="ref">${si + 1}</td><td colspan="3">${esc(s.title)}</td></tr>
          ${s.items.map((item, ii) => `
          <tr>
            <td class="ref">${si + 1}.${ii + 1}</td>
            <td>${esc(item.description)}</td>
            <td class="num">${money(item.amount)}</td>
            <td class="num pct">${pct(item.amount, rec.contractSum)}</td>
          </tr>`).join('')}
          ${s.items.length > 1 ? `
          <tr class="subtotal">
            <td></td>
            <td>Subtotal, ${esc(s.title.toLowerCase())}</td>
            <td class="num">${money(s.subtotal)}</td>
            <td class="num pct">${pct(s.subtotal, rec.contractSum)}</td>
          </tr>` : ''}
        </tbody>`).join('');

  const teamRows = pack.team.map((m) => `
          <tr>
            <td class="name">${esc(m.name)}${m.organisation ? `<div class="org">${esc(m.organisation)}</div>` : ''}</td>
            <td>${esc(teamRole(m))}</td>
            <td class="nowrap">${m.phone ? `<a href="tel:${esc(m.phone.replace(/\s+/g, ''))}">${esc(m.phone)}</a>` : '<span class="nil">—</span>'}</td>
            <td>${m.email ? `<a href="mailto:${esc(m.email)}">${breakableEmail(m.email)}</a>` : '<span class="nil">—</span>'}</td>
          </tr>`).join('');

  const sections = [
    { id: 'claim', title: 'Claim breakdown', blurb: 'Schedule of values that progress claims are assembled against' },
    { id: 'team', title: 'Project team', blurb: 'Who to contact, and for what' },
  ];

  const pageHead = (title, n) => `
    <header class="page-head">
      <div>
        <div class="eyebrow">Section ${n}</div>
        <h2>${esc(title)}</h2>
      </div>
      <div class="page-head-logo">${logoMarkup(brand, logoSrc)}</div>
    </header>`;

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8" />
<title>Pre-Commencement Pack — ${esc(pack.project.name)}</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: ${font}; font-size: 9.5pt; line-height: 1.45; color: ${css(p.ink)}; background: #FFFFFF;
         font-feature-settings: "tnum" 1, "cv11" 1; }
  a { color: inherit; text-decoration: none; }
  .page { break-after: page; }
  .page:last-child { break-after: auto; }

  /* Masthead */
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 7mm;
              border-bottom: 1.2mm solid ${css(p.accent)}; }
  .logo { display: block; height: 15mm; width: auto; }
  .page-head .logo { height: 8mm; }
  .wordmark { font-size: 16pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${css(p.inkOnWhite)}; }
  .page-head .wordmark { font-size: 11pt; }
  .doc-control { text-align: right; font-size: 8pt; color: ${css(p.muted)}; line-height: 1.6; padding-top: 1mm; }
  .doc-control strong { color: ${css(p.ink)}; font-weight: 600; }

  .eyebrow { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${css(p.accentInk)}; }
  h1 { margin: 2mm 0 1.5mm; font-size: 26pt; line-height: 1.12; font-weight: 700; letter-spacing: -0.01em; color: ${css(p.inkOnWhite)}; }
  h2 { margin: 1mm 0 0; font-size: 17pt; line-height: 1.2; font-weight: 700; color: ${css(p.inkOnWhite)}; }
  .address { font-size: 11pt; color: ${css(p.muted)}; }

  /* Cover */
  .cover-title { padding: 14mm 0 9mm; }
  table.meta { border-collapse: collapse; width: 100%; background: ${css(p.tintSoft)}; border-left: 1.2mm solid ${css(p.accent)}; }
  table.meta th, table.meta td { text-align: left; vertical-align: top; padding: 2.4mm 5mm; border-bottom: 0.25mm solid ${css(p.paper)}; }
  table.meta th { width: 38mm; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${css(p.muted)}; padding-top: 2.9mm; }
  table.meta td { font-size: 10.5pt; }

  .figures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 9mm; }
  .figure { border: 0.3mm solid ${css(p.rule)}; border-top: 1mm solid ${css(p.accent)}; padding: 4mm 4.5mm; }
  .figure-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${css(p.muted)}; }
  .figure-value { margin-top: 1.5mm; font-size: 15pt; font-weight: 700; color: ${css(p.ink)}; }
  .figure-note { margin-top: 1.5mm; font-size: 8pt; color: ${css(p.muted)}; line-height: 1.4; }
  .figure.warn { border-top-color: ${css(p.statusAmended)}; background: ${css(p.statusAmendedTint)}; }
  .figure.warn .figure-value { color: ${css(p.statusAmended)}; }
  .figure.ok { border-top-color: ${css(p.statusAccepted)}; }
  .figure.ok .figure-value { color: ${css(p.statusAccepted)}; }

  .contents { margin-top: 11mm; }
  .contents h3 { margin: 0 0 2mm; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${css(p.accentInk)}; }
  .contents ol { list-style: none; margin: 0; padding: 0; counter-reset: c; }
  .contents li { counter-increment: c; display: flex; gap: 5mm; align-items: baseline; padding: 3mm 0; border-bottom: 0.25mm solid ${css(p.ruleSoft)}; }
  .contents li::before { content: counter(c, decimal-leading-zero); font-weight: 700; color: ${css(p.accentInk)}; width: 7mm; }
  .contents .c-title { font-weight: 600; font-size: 10.5pt; }
  .contents .c-blurb { color: ${css(p.muted)}; margin-left: auto; font-size: 8.5pt; }

  /* Section pages */
  .page-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 4mm; margin-bottom: 6mm;
               border-bottom: 0.6mm solid ${css(p.accent)}; }
  .lede { margin: 0 0 5mm; color: ${css(p.muted)}; font-size: 9.5pt; max-width: 150mm; }

  table.grid { width: 100%; border-collapse: collapse; }
  table.grid thead { display: table-header-group; }
  table.grid th { background: ${css(p.panel)}; color: ${css(p.onPanel)}; text-align: left; font-size: 7.5pt; font-weight: 700;
                  letter-spacing: 0.08em; text-transform: uppercase; padding: 2.6mm 3mm; border-bottom: 0.4mm solid ${css(p.panelRule)}; }
  table.grid td { padding: 2.3mm 3mm; border-bottom: 0.25mm solid ${css(p.ruleSoft)}; vertical-align: top; }
  table.grid tr { break-inside: avoid; }
  table.grid .num { text-align: right; white-space: nowrap; }
  table.grid th.num { text-align: right; }
  table.grid .ref { width: 11mm; color: ${css(p.muted)}; font-size: 8.5pt; }
  table.grid .pct { width: 17mm; color: ${css(p.muted)}; font-size: 8.5pt; }
  .section-row td { background: ${css(p.tint)}; font-weight: 700; color: ${css(p.ink)}; border-bottom: none; padding-top: 2.6mm; }
  .section-row td.ref { color: ${css(p.ink)}; }
  .subtotal td { font-weight: 600; border-bottom: 0.3mm solid ${css(p.rule)}; }
  .subtotal td:nth-child(2) { color: ${css(p.muted)}; font-weight: 500; }
  tbody.section { break-inside: avoid; }
  tfoot td { padding: 3.2mm 3mm; font-size: 11pt; font-weight: 700; border-top: 0.8mm solid ${css(p.inkOnWhite)}; border-bottom: none; }

  .recon { margin-top: 5mm; display: grid; grid-template-columns: 1fr 1fr 1fr; border: 0.3mm solid ${css(p.rule)}; }
  .recon > div { padding: 3mm 4mm; border-right: 0.3mm solid ${css(p.rule)}; }
  .recon > div:last-child { border-right: none; }
  .recon .k { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${css(p.muted)}; }
  .recon .v { margin-top: 1mm; font-size: 11pt; font-weight: 700; }
  .recon .warn { background: ${css(p.statusAmendedTint)}; }
  .recon .warn .v { color: ${css(p.statusAmended)}; }
  .recon .ok .v { color: ${css(p.statusAccepted)}; }

  .flag { margin-top: 5mm; padding: 4mm 5mm; background: ${css(p.statusAmendedTint)}; border-left: 1.2mm solid ${css(p.statusAmended)}; break-inside: avoid; }
  .flag-title { font-weight: 700; color: ${css(p.statusAmended)}; font-size: 10pt; margin-bottom: 1.5mm; }
  .flag p { margin: 0 0 1.8mm; }
  .flag p:last-child { margin-bottom: 0; }
  .flag ul { margin: 0 0 1.8mm; padding-left: 5mm; }

  .team .name { font-weight: 600; width: 36mm; }
  .team td:nth-child(2) { width: 40mm; }
  .team td:nth-child(3) { width: 27mm; }
  .team .org { font-weight: 400; color: ${css(p.muted)}; font-size: 8.5pt; }
  .team td a { color: ${css(p.accentInk)}; }
  .nowrap { white-space: nowrap; }
  .nil { color: ${css(p.rule)}; }
</style>
</head>
<body>

<section class="page cover">
  <div class="masthead">
    <div class="doc-control">
      ${docControl ? `<strong>${esc(docControl)}</strong><br />` : ''}${doc.status ? `${esc(doc.status)}<br />` : ''}${doc.preparedOn ? esc(formatDate(doc.preparedOn)) : ''}
    </div>
    ${logoMarkup(brand, logoSrc)}
  </div>

  <div class="cover-title">
    <div class="eyebrow">Pre-Commencement Pack</div>
    <h1>${esc(pack.project.name)}</h1>
    <div class="address">${esc(pack.project.address)}</div>
  </div>

  <table class="meta">
    ${metaRow('Prepared for', esc(pack.preparedFor.name))}
    ${metaRow('Prepared by', esc(pack.preparedBy.entity))}
    ${metaRow('Date', doc.preparedOn ? esc(formatDate(doc.preparedOn)) : '')}
    ${metaRow('Reference', docControl ? esc(docControl) : '')}
  </table>

  <div class="figures">
    ${rec.contractSum != null ? figure('Contract sum', money(rec.contractSum), esc(pack.commercial.gstTreatment ?? 'Excluding GST')) : ''}
    ${figure('Schedule of values', money(rec.total), `${rec.sections.reduce((n, s) => n + s.items.length, 0)} line items across ${rec.sections.length} sections`)}
    ${rec.variance == null ? '' : figure(
    rec.reconciles ? 'Reconciliation' : 'Difference',
    rec.reconciles ? 'Reconciles' : `${rec.variance > 0 ? '+' : '−'}${money(Math.abs(rec.variance))}`,
    varianceNote(),
    rec.reconciles ? 'ok' : 'warn',
  )}
  </div>

  <div class="contents">
    <h3>Contents</h3>
    <ol>
      ${sections.map((s) => `<li><span class="c-title">${esc(s.title)}</span><span class="c-blurb">${esc(s.blurb)}</span></li>`).join('')}
    </ol>
  </div>
</section>

<section class="page">
  ${pageHead('Claim breakdown', 1)}
  <p class="lede">The schedule of values progress claims on this project will be assembled against. Claims should reference the item numbers below. Amounts exclude GST.</p>
  <table class="grid claim">
    <thead>
      <tr><th>Item</th><th>Description</th><th class="num">Amount (ex GST)</th><th class="num">% of sum</th></tr>
    </thead>
    ${claimRows}
    <tfoot>
      <tr><td></td><td>Total</td><td class="num">${money(rec.total)}</td><td class="num pct">${pct(rec.total, rec.contractSum)}</td></tr>
    </tfoot>
  </table>

  ${rec.contractSum == null ? '' : `
  <div class="recon">
    <div><div class="k">Contract sum recorded</div><div class="v">${money(rec.contractSum)}</div></div>
    <div><div class="k">Schedule total</div><div class="v">${money(rec.total)}</div></div>
    <div class="${rec.reconciles ? 'ok' : 'warn'}"><div class="k">Difference</div><div class="v">${rec.reconciles ? 'Nil' : `${rec.variance > 0 ? '+' : '−'}${money(Math.abs(rec.variance))}`}</div></div>
  </div>`}
  ${flag()}
</section>

<section class="page">
  ${pageHead('Project team', 2)}
  <p class="lede">Project contacts for ${esc(pack.project.name)}.</p>
  <table class="grid team">
    <thead>
      <tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th></tr>
    </thead>
    <tbody>${teamRows}
    </tbody>
  </table>
</section>

</body>
</html>`;
}

/** Running footer, repeated by Chromium on every page. */
export function footerTemplate(pack, brand) {
  const p = brand.palette;
  const doc = pack.document ?? {};
  const left = [pack.preparedBy.entity, pack.project.name, doc.reference && `${doc.reference}${doc.revision ? ` Rev ${doc.revision}` : ''}`]
    .filter(Boolean).map(esc).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  return `<div style="width:100%;margin:0 16mm;padding-top:2mm;border-top:0.25mm solid #${p.ruleSoft};display:flex;justify-content:space-between;
    font-family:${brand.fonts.document};font-size:7pt;color:#${p.muted};-webkit-print-color-adjust:exact;">
    <span>${left}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

export async function renderPdf(html, outPath, { footer = '' } = {}) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
    });
  } finally {
    await browser.close();
  }
  return outPath;
}
