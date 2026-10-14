import { readFileSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, resolve } from 'node:path';
import { brandAsset, css, repoRoot } from './brand.mjs';
import { formatDate } from './layout.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n) => {
  const abs = Math.abs(Number(n)).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '−' : ''}$${abs}`;
};

const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : '');

const sum = (items) => items.reduce((t, i) => t + Number(i.amount), 0);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "6 line items in 1 section", not "across 1 sections". */
const scheduleCount = (rec) => {
  const lines = rec.sections.reduce((n, s) => n + s.items.length, 0);
  return rec.sections.length === 1
    ? `${plural(lines, 'line item')} in 1 section`
    : `${plural(lines, 'line item')} across ${plural(rec.sections.length, 'section')}`;
};

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
  const sections = (pack.claimBreakdown ?? []).map((s) => ({ ...s, subtotal: sum(s.items) }));
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

const DAY = 86400000;

/**
 * Where a ticket, induction or policy stands on the pack date. Days are
 * counted from the date the pack is prepared, not the date it is opened.
 */
export function expiryStatus(expires, asAt) {
  if (!expires) return { label: 'No expiry', tone: 'none' };
  const days = Math.round((Date.parse(`${expires}T00:00:00Z`) - Date.parse(`${asAt}T00:00:00Z`)) / DAY);
  if (days < 0) return { label: 'Expired', tone: 'bad', days };
  if (days <= 30) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'warn', days };
  return { label: 'Current', tone: 'ok', days };
}

const letterFor = (i) => {
  let n = i;
  let out = '';
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
};

const DOCUMENT_GROUPS = [
  { category: 'SWMS', title: 'Safe work method statements' },
  { category: 'Plan', title: 'Plans' },
  { category: 'Licence', title: 'Licences and permits' },
];

const groupDocuments = (documents) => {
  const known = DOCUMENT_GROUPS.map((g) => ({ ...g, items: documents.filter((d) => d.category === g.category) }));
  const other = documents.filter((d) => !DOCUMENT_GROUPS.some((g) => g.category === d.category));
  return [...known, { category: 'Other', title: 'Other documents', items: other }].filter((g) => g.items.length);
};

/**
 * Every file bound into the pack, lettered in the order the sections list
 * them: ticket copies, then certificates of currency, then the standard
 * documents (SWMS, plans, licences). The pack refers to each by its letter.
 */
export function planAttachments(pack) {
  const list = [];
  const add = (owner, file, title, kind) => {
    if (!file) return;
    list.push({ letter: letterFor(list.length), file, title, kind, owner });
  };
  for (const person of pack.credentials ?? []) {
    for (const item of person.items) add(item, item.file, `${item.type} — ${person.name}`, 'Ticket');
  }
  for (const policy of pack.insurances ?? []) add(policy, policy.certificate, `Certificate of currency — ${policy.cover}`, 'Insurance');
  for (const group of groupDocuments(pack.documents ?? [])) {
    for (const d of group.items) add(d, d.file, [d.reference, d.title].filter(Boolean).join(' '), d.category);
  }
  return list;
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
export function buildPreCommencementHtml(pack, brand, { logoSrc = logoDataUri(brand), attachments = planAttachments(pack) } = {}) {
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

  const teamRows = (pack.team ?? []).map((m) => `
          <tr>
            <td class="name">${esc(m.name)}${m.organisation ? `<div class="org">${esc(m.organisation)}</div>` : ''}</td>
            <td>${esc(teamRole(m))}</td>
            <td class="nowrap">${m.phone ? `<a href="tel:${esc(m.phone.replace(/\s+/g, ''))}">${esc(m.phone)}</a>` : '<span class="nil">—</span>'}</td>
            <td>${m.email ? `<a href="mailto:${esc(m.email)}">${breakableEmail(m.email)}</a>` : '<span class="nil">—</span>'}</td>
          </tr>`).join('');

  const asAt = doc.preparedOn ?? new Date().toISOString().slice(0, 10);
  const nil = '<span class="nil">—</span>';
  const attRef = (owner) => {
    const a = attachments.find((x) => x.owner === owner);
    if (!a) return '<span class="muted">Not attached</span>';
    const pages = a.start ? `<span class="pages">p. ${a.start}</span>` : '';
    return `<span class="att">Att. ${esc(a.letter)}</span>${pages}`;
  };
  const chip = (st) => `<span class="chip ${st.tone}">${esc(st.label)}</span>`;
  const expiryCell = (expires) => `${expires ? `<div class="nowrap">${esc(formatDate(expires))}</div>` : ''}${chip(expiryStatus(expires, asAt))}`;

  const claimBody = () => `
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
  ${flag()}`;

  const teamBody = () => `
  <p class="lede">Project contacts for ${esc(pack.project.name)}.</p>
  <table class="grid team">
    <thead>
      <tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th></tr>
    </thead>
    <tbody>${teamRows}
    </tbody>
  </table>`;

  const credentialsBody = () => `
  <p class="lede">Licences, tickets and inductions held by the people working on site, from the credentials register. Status is as at ${esc(formatDate(asAt))}.</p>
  <table class="grid credentials">
    <thead>
      <tr><th>Ticket or induction</th><th>Number</th><th>Issued by</th><th>Expiry</th><th>Copy</th></tr>
    </thead>
    ${pack.credentials.map((person) => `
    <tbody class="section">
      <tr class="section-row"><td colspan="5">${esc(person.name)}${person.role ? `<span class="row-sub">${esc(person.role)}</span>` : ''}</td></tr>
      ${person.items.map((item) => `
      <tr>
        <td>${esc(item.type)}</td>
        <td class="nowrap">${item.number ? esc(item.number) : nil}</td>
        <td>${item.issuer ? esc(item.issuer) : nil}</td>
        <td>${expiryCell(item.expires)}</td>
        <td class="nowrap">${attRef(item)}</td>
      </tr>`).join('')}
    </tbody>`).join('')}
  </table>`;

  const insuranceBody = () => `
  <p class="lede">Policies held by ${esc(pack.preparedBy.entity)}. Status is as at ${esc(formatDate(asAt))}. Certificates of currency are bound in where marked.</p>
  <table class="grid insurances">
    <thead>
      <tr><th>Cover</th><th>Insurer</th><th>Policy no.</th><th class="num">Limit</th><th>Expiry</th><th>Certificate</th></tr>
    </thead>
    <tbody>
    ${pack.insurances.map((ins) => `
      <tr>
        <td class="strong">${esc(ins.cover)}</td>
        <td>${esc(ins.insurer)}</td>
        <td class="nowrap">${ins.policyNumber ? esc(ins.policyNumber) : nil}</td>
        <td class="num">${ins.limit == null ? nil : esc(typeof ins.limit === 'number' ? money(ins.limit).replace(/\.00$/, '') : ins.limit)}</td>
        <td>${expiryCell(ins.expires)}</td>
        <td class="nowrap">${attRef(ins)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  const documentsBody = () => `
  <p class="lede">The standard documents that apply to this work. Each attached document is bound in after the pack exactly as issued, with its attachment letter and the pack page number added in the margin.</p>
  <table class="grid documents">
    <thead>
      <tr><th>Document</th><th>Ref.</th><th>Rev.</th><th>Date</th><th>Attached</th></tr>
    </thead>
    ${groupDocuments(pack.documents).map((g) => `
    <tbody class="section">
      <tr class="section-row"><td colspan="5">${esc(g.title)}</td></tr>
      ${g.items.map((d) => `
      <tr>
        <td><div class="strong">${esc(d.title)}</div>${d.scope ? `<div class="sub">${esc(d.scope)}</div>` : ''}${d.highRiskWork?.length ? `<div class="sub">High risk construction work: ${esc(d.highRiskWork.join('; '))}</div>` : ''}</td>
        <td class="nowrap">${d.reference ? esc(d.reference) : nil}</td>
        <td>${d.revision ? esc(d.revision) : nil}</td>
        <td class="nowrap">${d.date ? esc(formatDate(d.date)) : nil}</td>
        <td class="nowrap">${attRef(d)}</td>
      </tr>`).join('')}
    </tbody>`).join('')}
  </table>`;

  const attachmentsBody = () => `
  <p class="lede">Documents bound into this pack after this page. Page numbers run on from the pack, and each attached page carries its letter in the top margin.</p>
  <table class="grid attachments">
    <thead>
      <tr><th>Att.</th><th>Document</th><th>Type</th><th class="num">Pages</th></tr>
    </thead>
    <tbody>
    ${attachments.map((a) => `
      <tr>
        <td><span class="att">${esc(a.letter)}</span></td>
        <td>${esc(a.title)}</td>
        <td>${esc(a.kind)}</td>
        <td class="num">${a.start ? (a.end > a.start ? `${a.start}–${a.end}` : `${a.start}`) : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  const sections = [
    pack.claimBreakdown?.length && { title: 'Claim breakdown', blurb: 'Schedule of values that progress claims are assembled against', body: claimBody },
    pack.team?.length && { title: 'Project team', blurb: 'Who to contact, and for what', body: teamBody },
    pack.credentials?.length && { title: 'Tickets and inductions', blurb: 'Licences, tickets and inductions held by the site team', body: credentialsBody },
    pack.insurances?.length && { title: 'Insurances', blurb: 'Policies held and certificates of currency', body: insuranceBody },
    pack.documents?.length && { title: 'Safety and compliance documents', blurb: 'SWMS, plans and licences', body: documentsBody },
    attachments.length && { title: 'Attachments', blurb: `${attachments.length} document${attachments.length === 1 ? '' : 's'} bound into this pack`, body: attachmentsBody },
  ].filter(Boolean);

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
  .muted { color: ${css(p.muted)}; font-size: 8.5pt; }
  .strong { font-weight: 600; }
  .sub { margin-top: 0.8mm; color: ${css(p.muted)}; font-size: 8.5pt; }
  .row-sub { font-weight: 400; color: ${css(p.muted)}; margin-left: 3mm; }

  .chip { display: inline-block; margin-top: 0.8mm; padding: 0.3mm 2mm; border-radius: 1mm; font-size: 7.5pt; font-weight: 600; white-space: nowrap; }
  .chip.ok { color: ${css(p.statusAccepted)}; background: ${css(p.statusAcceptedTint)}; }
  .chip.warn { color: ${css(p.statusAmended)}; background: ${css(p.statusAmendedTint)}; }
  .chip.bad { color: ${css(p.statusRejected)}; background: ${css(p.statusRejectedTint)}; }
  .chip.none { color: ${css(p.muted)}; background: ${css(p.band)}; }

  .att { display: inline-block; min-width: 7mm; padding: 0.3mm 1.6mm; border: 0.3mm solid ${css(p.accent)}; border-radius: 1mm;
         color: ${css(p.accentInk)}; font-weight: 700; font-size: 8pt; text-align: center; }
  .pages { margin-left: 1.5mm; color: ${css(p.muted)}; font-size: 8pt; }
  .insurances td:first-child { width: 40mm; }
  .credentials td:first-child { width: 52mm; }
  .attachments td:first-child { width: 14mm; }
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

  ${rec.sections.length ? `<div class="figures">
    ${rec.contractSum != null ? figure('Contract sum', money(rec.contractSum), esc(pack.commercial.gstTreatment ?? 'Excluding GST')) : ''}
    ${figure('Schedule of values', money(rec.total), scheduleCount(rec))}
    ${rec.variance == null ? '' : figure(
    rec.reconciles ? 'Reconciliation' : 'Difference',
    rec.reconciles ? 'Reconciles' : `${rec.variance > 0 ? '+' : '−'}${money(Math.abs(rec.variance))}`,
    varianceNote(),
    rec.reconciles ? 'ok' : 'warn',
  )}
  </div>` : ''}

  <div class="contents">
    <h3>Contents</h3>
    <ol>
      ${sections.map((s) => `<li><span class="c-title">${esc(s.title)}</span><span class="c-blurb">${esc(s.blurb)}</span></li>`).join('')}
    </ol>
  </div>
</section>

${sections.map((sec, i) => `
<section class="page">
  ${pageHead(sec.title, i + 1)}
  ${sec.body()}
</section>`).join('')}

</body>
</html>`;
}

/** Running footer, repeated by Chromium on every page. */
export function footerTemplate(pack, brand, { totalPages = null } = {}) {
  const p = brand.palette;
  const doc = pack.document ?? {};
  const left = [pack.preparedBy.entity, pack.project.name, doc.reference && `${doc.reference}${doc.revision ? ` Rev ${doc.revision}` : ''}`]
    .filter(Boolean).map(esc).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  return `<div style="width:100%;margin:0 16mm;padding-top:2mm;border-top:0.25mm solid #${p.ruleSoft};display:flex;justify-content:space-between;
    font-family:${brand.fonts.document};font-size:7pt;color:#${p.muted};-webkit-print-color-adjust:exact;">
    <span>${left}</span><span>Page <span class="pageNumber"></span> of ${totalPages ?? '<span class="totalPages"></span>'}</span></div>`;
}

export function footerText(pack) {
  const doc = pack.document ?? {};
  return [pack.preparedBy.entity, pack.project.name, doc.reference && `${doc.reference}${doc.revision ? ` Rev ${doc.revision}` : ''}`]
    .filter(Boolean).join('  ·  ');
}

export async function renderPdf(html, outPath, { footer = '' } = {}) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      ...(outPath ? { path: outPath } : {}),
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
}

const MM = 72 / 25.4;
const A4 = [210 * MM, 297 * MM];
const BAND_TOP = 11 * MM;
const BAND_BOTTOM = 11 * MM;

const rgbOf = async (hex) => {
  const { rgb } = await import('pdf-lib');
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
};

/** Helvetica only carries WinAnsi, so anything outside it is swapped for the nearest plain character. */
const winAnsi = (text) => String(text)
  .replace(/[−‐‑]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x20-\x7E -ÿ–—•…]/g, '');

const resolvePath = (file) => (isAbsolute(file) ? file : resolve(repoRoot, file));

/** Pages an attachment will occupy once bound in: a PDF keeps its own count, an image takes one A4 page. */
async function attachmentPageCount(file) {
  const { PDFDocument } = await import('pdf-lib');
  if (extname(file).toLowerCase() !== '.pdf') return 1;
  return (await PDFDocument.load(readFileSync(resolvePath(file)), { ignoreEncryption: true })).getPageCount();
}

/**
 * Builds the full pack: the branded pages, then every attachment bound in
 * behind them. Attached documents are never restyled — a SWMS or a
 * certificate of currency has to go out exactly as issued — so each page is
 * scaled into a margin band instead, with the attachment letter and title on
 * top and the pack's running footer and page number underneath. Pages are
 * numbered straight through, so the attachments index can give page ranges.
 */
export async function buildPack(pack, brand, outPath, { logoSrc = logoDataUri(brand) } = {}) {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const attachments = planAttachments(pack);
  for (const a of attachments) a.pages = await attachmentPageCount(a.file);

  // Pass 1 counts the pack's own pages so attachment page ranges can be filled in.
  let html = buildPreCommencementHtml(pack, brand, { logoSrc, attachments });
  let packPages = (await PDFDocument.load(await renderPdf(html, null, { footer: footerTemplate(pack, brand) }))).getPageCount();
  let main;
  for (let pass = 0; pass < 3; pass += 1) {
    let next = packPages + 1;
    for (const a of attachments) { a.start = next; a.end = next + a.pages - 1; next = a.end + 1; }
    const total = next - 1;
    html = buildPreCommencementHtml(pack, brand, { logoSrc, attachments });
    main = await PDFDocument.load(await renderPdf(html, null, { footer: footerTemplate(pack, brand, { totalPages: total }) }));
    if (main.getPageCount() === packPages) break;
    packPages = main.getPageCount();
  }

  const total = packPages + attachments.reduce((n, a) => n + a.pages, 0);
  const helv = await main.embedFont(StandardFonts.Helvetica);
  const helvBold = await main.embedFont(StandardFonts.HelveticaBold);
  const p = brand.palette;
  const accent = await rgbOf(p.accent);
  const accentInk = await rgbOf(p.accentInk);
  const muted = await rgbOf(p.muted);
  const rule = await rgbOf(p.ruleSoft);
  const footer = winAnsi(footerText(pack));

  let pageNo = packPages;
  for (const a of attachments) {
    const path = resolvePath(a.file);
    const ext = extname(path).toLowerCase();
    const sources = [];
    if (ext === '.pdf') {
      const src = await PDFDocument.load(readFileSync(path), { ignoreEncryption: true });
      const embedded = await main.embedPages(src.getPages());
      src.getPages().forEach((pg, i) => sources.push({ embedded: embedded[i], size: [pg.getWidth(), pg.getHeight()] }));
    } else {
      const bytes = readFileSync(path);
      const image = ext === '.png' ? await main.embedPng(bytes) : await main.embedJpg(bytes);
      sources.push({ image, size: A4 });
    }

    sources.forEach((src, i) => {
      pageNo += 1;
      const [w, h] = src.size;
      const page = main.addPage([w, h]);
      const side = 10 * MM;
      const boxW = w - side * 2;
      const boxH = h - BAND_TOP - BAND_BOTTOM;
      const natural = src.embedded ? [w, h] : [src.image.width, src.image.height];
      // A photo of a ticket or card is shown at a readable size near the top,
      // not stretched across the page; documents fill the space they have.
      const maxW = src.embedded ? boxW : Math.min(boxW, 130 * MM);
      const scale = Math.min(maxW / natural[0], boxH / natural[1], src.embedded ? 1 : 3);
      const dw = natural[0] * scale;
      const dh = natural[1] * scale;
      const x = (w - dw) / 2;
      const y = src.embedded ? BAND_BOTTOM + (boxH - dh) / 2 : h - BAND_TOP - 8 * MM - dh;
      if (src.embedded) page.drawPage(src.embedded, { x, y, width: dw, height: dh });
      else page.drawImage(src.image, { x, y, width: dw, height: dh });
      if (src.embedded) page.drawRectangle({ x, y, width: dw, height: dh, borderColor: rule, borderWidth: 0.5 });

      // Top band: attachment letter and title.
      const label = `ATTACHMENT ${a.letter}`;
      page.drawRectangle({ x: side, y: h - 7.5 * MM, width: 1.2 * MM, height: 4 * MM, color: accent });
      page.drawText(label, { x: side + 3 * MM, y: h - 6.6 * MM, size: 8, font: helvBold, color: accentInk });
      const labelW = helvBold.widthOfTextAtSize(label, 8);
      const title = winAnsi(`${a.title}${sources.length > 1 ? `  (${i + 1} of ${sources.length})` : ''}`);
      page.drawText(title, { x: side + 3 * MM + labelW + 3 * MM, y: h - 6.6 * MM, size: 8, font: helv, color: muted, maxWidth: w - side * 2 - labelW - 8 * MM });

      // Bottom band: the pack's running footer, page numbers continuous with the pack.
      page.drawLine({ start: { x: side, y: 8.5 * MM }, end: { x: w - side, y: 8.5 * MM }, thickness: 0.6, color: rule });
      page.drawText(footer, { x: side, y: 5.2 * MM, size: 7, font: helv, color: muted });
      const num = `Page ${pageNo} of ${total}`;
      page.drawText(num, { x: w - side - helv.widthOfTextAtSize(num, 7), y: 5.2 * MM, size: 7, font: helv, color: muted });
    });
  }

  main.setTitle(`Pre-Commencement Pack — ${pack.project.name}`);
  main.setAuthor(pack.preparedBy.entity);
  writeFileSync(outPath, await main.save());
  return { outPath, html, pages: total, attachments };
}
