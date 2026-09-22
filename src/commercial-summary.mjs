import ExcelJS from 'exceljs';
import { argb, brandAsset } from './brand.mjs';
import { estimateRowHeight, formatDate, rightAlignedAnchor } from './layout.mjs';
import { injectFooterLogo } from './footer-logo.mjs';

const COLUMNS = [
  { key: 'ref', header: 'Item\nRef #', width: 8 },
  { key: 'area', header: 'Relevant\nArea', width: 16 },
  { key: 'clause', header: 'Clause', width: 28 },
  { key: 'currentPosition', header: 'Current Subcontract Position', width: 44 },
  { key: 'proposedPosition', header: "Subcontractor's Proposed Position", width: 52 },
  { key: 'basis', header: 'Basis of Request', width: 28 },
  { key: 'response', header: 'Builder Response', width: 20, builder: true },
  { key: 'comments', header: 'Builder Comments', width: 34, builder: true },
];

const WIDTHS = COLUMNS.map((c) => c.width);
const LAST_COL = COLUMNS.length;            // 8 -> H
const LAST = 'H';
const BUILDER_FIRST = COLUMNS.findIndex((c) => c.builder) + 1; // 7 -> G

export const RESPONSE_OPTIONS = [
  'Accepted',
  'Accepted as amended',
  'Rejected',
  'Further discussion required',
];

const LOGO_WIDTH_PX = 150;

export async function buildCommercialSummary(review, brand, outPath) {
  const p = brand.palette;
  const font = brand.fonts.spreadsheet;

  const wb = new ExcelJS.Workbook();
  wb.creator = review.preparedBy.entity;
  wb.lastModifiedBy = review.preparedBy.entity;
  wb.created = new Date(`${review.document.preparedOn}T00:00:00Z`);
  wb.modified = new Date(`${review.document.preparedOn}T00:00:00Z`);
  wb.title = `${review.subcontractor.name} – ${review.project.name} – Commercial Summary Schedule`;
  wb.subject = `Proposed subcontract departures – ${review.project.name}`;
  wb.company = review.preparedBy.entity;
  wb.keywords = `${review.document.reference}, Revision ${review.document.revision}`;

  const ws = wb.addWorksheet('Commercial Summary', {
    properties: { tabColor: { argb: argb(p.accent) }, defaultRowHeight: 15 },
    pageSetup: {
      orientation: 'landscape',
      paperSize: 8, // A3 — an eight-column text schedule is unreadable shrunk onto A4.
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      printTitlesRow: '',
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.75, header: 0.3, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });

  COLUMNS.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  const row = (() => { let n = 0; return { next: () => ++n, peek: () => n + 1, current: () => n }; })();
  const span = (r, from = 'A', to = LAST) => `${from}${r}:${to}${r}`;

  // ── Brand band ──────────────────────────────────────────────────────────
  addBrandBand(ws, wb, brand, row, {
    widths: WIDTHS,
    title: 'Commercial Summary Schedule',
    subtitle: `Proposed subcontract departures \u2013 ${review.project.name}`,
    meta: [
      review.document.reference,
      `Revision ${review.document.revision}`,
      `Prepared ${formatDate(review.document.preparedOn)}`,
      review.document.status,
    ].join('   \u00b7   '),
    titleSpanTo: 'F',
    lastCol: LAST,
  });

  // ── Document control block, two pairs per row ───────────────────────────
  const sum = review.commercial.subcontractSum;
  const left = [
    ['Project', review.project.name, { bold: true }],
    ['Project Address', review.project.address],
    ['Head Contractor', `${review.headContractor.name} (ACN ${review.headContractor.acn})`],
    ['Subcontractor', `${review.subcontractor.name} (ACN ${review.subcontractor.acn})`],
    ['Departures Proposed', review.departures.length, { bold: true, numFmt: '0' }],
  ];
  const right = [
    ['Trade Package', review.subcontractor.tradePackage],
    ['Contract Type', review.commercial.contractType],
    ['Subcontract Sum', sum, { bold: true, numFmt: `"$"#,##0.00" ${review.commercial.gstTreatment}"` }],
    ['Prepared By', `${review.preparedBy.entity} – ${review.preparedBy.contactName}`],
    ['Response Requested By', new Date(`${review.document.responseRequestedBy}T00:00:00Z`), { bold: true, numFmt: 'd mmmm yyyy' }],
  ];

  const labelStyle = {
    font: { name: font, size: 9, bold: true, color: { argb: argb(p.muted) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.tintSoft) } },
    alignment: { vertical: 'middle', indent: 1 },
    border: { bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
  };
  const valueStyle = (opts = {}) => ({
    font: { name: font, size: 10.5, bold: !!opts.bold, color: { argb: argb(p.ink) } },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: false },
    border: { bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
    ...(opts.numFmt ? { numFmt: opts.numFmt } : {}),
  });

  for (let i = 0; i < left.length; i += 1) {
    const r = row.next();
    ws.getRow(r).height = 19;
    const pairs = [
      { label: left[i], labelRange: [`A${r}`, `B${r}`], valueRange: [`C${r}`, `D${r}`] },
      { label: right[i], labelRange: [`E${r}`, `E${r}`], valueRange: [`F${r}`, `H${r}`] },
    ];
    for (const { label: [text, value, opts], labelRange, valueRange } of pairs) {
      paintRange(ws, r, labelRange, { value: text, ...labelStyle });
      paintRange(ws, r, valueRange, { value, ...valueStyle(opts) });
    }
  }

  ws.getRow(row.next()).height = 10;

  // ── Zone band: whose column is whose ────────────────────────────────────
  const rZone = row.next();
  ws.getRow(rZone).height = 18;
  ws.mergeCells(span(rZone, 'A', 'F'));
  ws.mergeCells(span(rZone, 'G', LAST));
  Object.assign(ws.getCell(`A${rZone}`), {
    value: 'SUBCONTRACT POSITION AND PROPOSED DEPARTURES',
    font: { name: font, size: 9, bold: true, color: { argb: argb(p.accent) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.tint) } },
    alignment: { vertical: 'middle', indent: 1 },
  });
  Object.assign(ws.getCell(`G${rZone}`), {
    value: 'FOR BUILDER COMPLETION',
    font: { name: font, size: 9, bold: true, color: { argb: argb(p.builderZone) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.builderZoneTint) } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });

  // ── Column headers ─────────────────────────────────────────────────────
  const rHead = row.next();
  ws.getRow(rHead).height = 32;
  COLUMNS.forEach((c, i) => {
    const cell = ws.getRow(rHead).getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: font, size: 10, bold: true, color: { argb: argb(c.builder ? 'FFFFFF' : p.onPanel) } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(c.builder ? p.builderZone : p.panel) } };
    cell.alignment = { vertical: 'middle', horizontal: c.builder || i < 2 ? 'center' : 'left', wrapText: true, indent: c.builder || i < 2 ? 0 : 1 };
    cell.border = { bottom: { style: 'medium', color: { argb: argb(c.builder ? p.builderZone : p.panelRule) } } };
  });

  // ── Departure rows ─────────────────────────────────────────────────────
  const firstDataRow = row.peek();
  for (const d of review.departures) {
    const r = row.next();
    ws.getRow(r).height = estimateRowHeight([
      { text: d.currentPosition, width: COLUMNS[3].width, fontSize: 9.5 },
      { text: d.proposedPosition, width: COLUMNS[4].width, fontSize: 10 },
      { text: d.basis, width: COLUMNS[5].width, fontSize: 9 },
      { text: d.clause, width: COLUMNS[2].width, fontSize: 10 },
    ]);

    const body = (extra = {}) => ({
      border: {
        top: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
        bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
        left: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
        right: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
      },
      alignment: { vertical: 'top', wrapText: true, indent: 1 },
      ...extra,
    });

    Object.assign(ws.getCell(`A${r}`), { value: d.ref }, body({
      font: { name: font, size: 10, bold: true, color: { argb: argb(p.inkOnWhite) } },
      alignment: { vertical: 'top', horizontal: 'center' },
    }));
    Object.assign(ws.getCell(`B${r}`), { value: d.area }, body({
      font: { name: font, size: 9.5, color: { argb: argb(p.muted) } },
      alignment: { vertical: 'top', horizontal: 'center', wrapText: true },
    }));
    Object.assign(ws.getCell(`C${r}`), { value: d.clause }, body({
      font: { name: font, size: 10, bold: true, color: { argb: argb(p.ink) } },
    }));
    Object.assign(ws.getCell(`D${r}`), { value: d.currentPosition }, body({
      font: { name: font, size: 9.5, color: { argb: argb(p.muted) } },
    }));
    Object.assign(ws.getCell(`E${r}`), { value: d.proposedPosition }, body({
      font: { name: font, size: 10, color: { argb: argb(p.ink) } },
      border: {
        top: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
        bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
        left: { style: 'thin', color: { argb: argb(p.rule) } },
        right: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
      },
    }));
    Object.assign(ws.getCell(`F${r}`), { value: d.basis || '' }, body({
      font: { name: font, size: 9, italic: true, color: { argb: argb(p.muted) } },
    }));

    for (const col of ['G', 'H']) {
      const cell = ws.getCell(`${col}${r}`);
      Object.assign(cell, {}, body({
        font: { name: font, size: col === 'G' ? 10 : 9.5, bold: col === 'G', color: { argb: argb(p.ink) } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.inputField) } },
        alignment: col === 'G'
          ? { vertical: 'middle', horizontal: 'center', wrapText: true }
          : { vertical: 'top', wrapText: true, indent: 1 },
        border: {
          top: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
          bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
          left: { style: col === 'G' ? 'medium' : 'thin', color: { argb: argb(col === 'G' ? p.builderZone : p.ruleSoft) } },
          right: { style: 'thin', color: { argb: argb(p.ruleSoft) } },
        },
      }));
      cell.protection = { locked: false };
    }

    ws.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${RESPONSE_OPTIONS.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Pick a response',
      error: `Choose one of: ${RESPONSE_OPTIONS.join(', ')}.`,
      showInputMessage: true,
      promptTitle: 'Builder response',
      prompt: 'Select a response, then add any qualification in Builder Comments.',
    };
  }
  const lastDataRow = row.current();

  // Zebra banding as a rule, not as baked-in fill, so it survives filtering
  // and re-sorting — and it stops at column F so the builder's input columns
  // keep their own fill.
  ws.addConditionalFormatting({
    ref: `A${firstDataRow}:F${lastDataRow}`,
    rules: [{
      type: 'expression',
      formulae: [`MOD(ROW()-${firstDataRow},2)=1`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: argb(p.band) } } },
      priority: 5,
    }],
  });

  const statusRules = [
    ['Accepted', p.statusAccepted, p.statusAcceptedTint],
    ['Accepted as amended', p.statusAmended, p.statusAmendedTint],
    ['Rejected', p.statusRejected, p.statusRejectedTint],
    ['Further discussion required', p.statusDiscuss, p.statusDiscussTint],
  ];
  ws.addConditionalFormatting({
    ref: `G${firstDataRow}:G${lastDataRow}`,
    rules: statusRules.map(([text, fg, bg], i) => ({
      type: 'containsText',
      operator: 'containsText',
      text,
      priority: i + 1,
      style: {
        font: { name: font, size: 10, bold: true, color: { argb: argb(fg) } },
        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: argb(bg) } },
      },
    })),
  });

  ws.autoFilter = { from: `A${rHead}`, to: `${LAST}${lastDataRow}` };
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: rHead, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${rZone}:${rHead}`;

  // ── Sign-off ───────────────────────────────────────────────────────────
  ws.getRow(row.next()).height = 12;

  const rSignBand = row.next();
  ws.getRow(rSignBand).height = 18;
  ws.mergeCells(span(rSignBand));
  Object.assign(ws.getCell(`A${rSignBand}`), {
    value: 'BUILDER SIGN-OFF',
    font: { name: font, size: 9, bold: true, color: { argb: argb(p.accent) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.tint) } },
    alignment: { vertical: 'middle', indent: 1 },
  });

  const rSignNote = row.next();
  ws.getRow(rSignNote).height = 28;
  ws.mergeCells(span(rSignNote));
  Object.assign(ws.getCell(`A${rSignNote}`), {
    value: `Departures marked Accepted or Accepted as amended are to be incorporated into the subcontract by formal amendment before ${review.subcontractor.name} executes. Returning this schedule does not of itself amend the subcontract.`,
    font: { name: font, size: 9.5, color: { argb: argb(p.muted) } },
    alignment: { vertical: 'middle', wrapText: true, indent: 1 },
  });

  const signFields = [
    ['Name', ''],
    ['Position', ''],
    ['Signature', ''],
    ['Date', ''],
  ];
  const preparedFields = [
    ['Prepared by', review.preparedBy.entity],
    ['Contact', `${review.preparedBy.contactName}${review.preparedBy.position ? `, ${review.preparedBy.position}` : ''}`],
    ['Email', review.preparedBy.email],
    ['Document', `${review.document.reference} · Revision ${review.document.revision}`],
  ];

  const rSignHead = row.next();
  ws.getRow(rSignHead).height = 16;
  ws.mergeCells(span(rSignHead, 'A', 'D'));
  ws.mergeCells(span(rSignHead, 'E', LAST));
  Object.assign(ws.getCell(`A${rSignHead}`), {
    value: `For and on behalf of ${review.headContractor.name}`,
    font: { name: font, size: 9.5, bold: true, color: { argb: argb(p.ink) } },
    alignment: { vertical: 'middle', indent: 1 },
  });
  Object.assign(ws.getCell(`E${rSignHead}`), {
    value: 'Issued by',
    font: { name: font, size: 9.5, bold: true, color: { argb: argb(p.ink) } },
    alignment: { vertical: 'middle', indent: 1 },
  });

  for (let i = 0; i < signFields.length; i += 1) {
    const r = row.next();
    ws.getRow(r).height = 20;
    ws.mergeCells(`A${r}:B${r}`);
    ws.mergeCells(`C${r}:D${r}`);
    ws.mergeCells(`E${r}:E${r}`);
    ws.mergeCells(`F${r}:H${r}`);

    Object.assign(ws.getCell(`A${r}`), { value: signFields[i][0] }, labelStyle);
    const input = ws.getCell(`C${r}`);
    input.value = signFields[i][1];
    input.font = { name: font, size: 10.5, color: { argb: argb(p.ink) } };
    input.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.inputField) } };
    input.alignment = { vertical: 'middle', indent: 1 };
    input.protection = { locked: false };
    for (const c of ['C', 'D']) {
      ws.getCell(`${c}${r}`).border = { bottom: { style: 'thin', color: { argb: argb(p.rule) } } };
    }
    for (const c of ['A', 'B']) {
      ws.getCell(`${c}${r}`).border = { bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } } };
    }

    Object.assign(ws.getCell(`E${r}`), { value: preparedFields[i][0] }, labelStyle);
    Object.assign(ws.getCell(`F${r}`), { value: preparedFields[i][1] }, valueStyle({ bold: i === 0 }));
    for (const c of ['F', 'G', 'H']) {
      ws.getCell(`${c}${r}`).border = { bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } } };
    }
  }

  ws.getRow(row.next()).height = 10;

  const rNote = row.next();
  ws.getRow(rNote).height = 26;
  ws.mergeCells(span(rNote));
  Object.assign(ws.getCell(`A${rNote}`), {
    value: 'This schedule records the Subcontractor\'s proposed departures from the subcontract documents issued for the Project. Quoted wording is reproduced from those documents. Commercial positions only — not legal advice.',
    font: { name: font, size: 8.5, italic: true, color: { argb: argb(p.muted) } },
    alignment: { vertical: 'middle', wrapText: true, indent: 1 },
    border: { top: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
  });

  ws.pageSetup.printArea = `A1:${LAST}${rNote}`;
  ws.headerFooter = {
    oddFooter: `&L&"${font},Italic"&8${review.document.reference}  ·  Revision ${review.document.revision}  ·  ${review.project.name}&C&"${font},Regular"&9Page &P of &N&R&G`,
  };

  // Locked by default; only the builder's response columns and signature
  // fields were unlocked above. No password — a guardrail, not a lock.
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    autoFilter: true,
    sort: true,
    formatColumns: true,
    formatRows: true,
    insertRows: false,
    deleteRows: false,
  });

  addInstructionsSheet(wb, review, brand);

  await wb.xlsx.writeFile(outPath);
  const logoPath = brandAsset(brand, 'print');
  if (logoPath) await injectFooterLogo(outPath, logoPath, { widthPt: 102, heightPt: 33 });
  return outPath;
}

/**
 * The masthead every sheet opens with: wordmark hard right, title block left,
 * document reference underneath and a brand rule closing it off. The wordmark
 * is dark, so the band stays white and the rule carries the brand colour.
 */
/**
 * Merges a horizontal range, styles it, and repaints the style on every cell
 * the merge covers — Excel reads a merged block's borders from the individual
 * cells, not from the master.
 */
function paintRange(ws, r, [from, to], { value, ...style }) {
  if (from !== to) ws.mergeCells(`${from}:${to}`);
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c += 1) {
    // Only the master carries the value: assigning to a merged slave writes
    // through to the master and would clear it.
    Object.assign(ws.getCell(`${String.fromCharCode(c)}${r}`), style);
  }
  if (value !== undefined) ws.getCell(from).value = value;
}

function addBrandBand(ws, wb, brand, row, { widths, title, subtitle, meta, titleSpanTo, lastCol, logoWidthPx = 150 }) {
  const p = brand.palette;
  const font = brand.fonts.spreadsheet;

  ws.getRow(row.next()).height = 8;

  const rTitle = row.next();
  ws.getRow(rTitle).height = 27;
  ws.mergeCells(`A${rTitle}:${titleSpanTo}${rTitle}`);
  Object.assign(ws.getCell(`A${rTitle}`), {
    value: title,
    font: { name: font, size: 18, bold: true, color: { argb: argb(p.accent) } },
    alignment: { vertical: 'middle' },
  });

  const rSub = row.next();
  ws.getRow(rSub).height = 17;
  ws.mergeCells(`A${rSub}:${titleSpanTo}${rSub}`);
  Object.assign(ws.getCell(`A${rSub}`), {
    value: subtitle,
    font: { name: font, size: 11.5, color: { argb: argb(p.muted) } },
    alignment: { vertical: 'middle' },
  });

  const rMeta = row.next();
  ws.getRow(rMeta).height = 15;
  ws.mergeCells(`A${rMeta}:${titleSpanTo}${rMeta}`);
  Object.assign(ws.getCell(`A${rMeta}`), {
    value: meta,
    font: { name: font, size: 9, color: { argb: argb(p.muted) } },
    alignment: { vertical: 'middle' },
  });

  const logoPath = brandAsset(brand, 'print');
  if (logoPath) {
    const imageId = wb.addImage({ filename: logoPath, extension: 'png' });
    ws.addImage(imageId, {
      tl: rightAlignedAnchor(widths, logoWidthPx, { row: rTitle - 1, rowOffsetPt: 3 }),
      ext: { width: logoWidthPx, height: Math.round(logoWidthPx / (brand.logo.aspectRatio || 3.1)) },
      editAs: 'oneCell',
    });
  }

  const rRule = row.next();
  ws.getRow(rRule).height = 6;
  ws.mergeCells(`A${rRule}:${lastCol}${rRule}`);
  ws.getCell(`A${rRule}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(p.accent) } };

  ws.getRow(row.next()).height = 8;
  return row.current();
}

function addInstructionsSheet(wb, review, brand) {
  const p = brand.palette;
  const font = brand.fonts.spreadsheet;
  const ws = wb.addWorksheet('How to Complete', {
    properties: { tabColor: { argb: argb(p.rule) } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  const INSTR_WIDTHS = [4, 26, 78];
  INSTR_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const row = (() => { let n = 0; return { next: () => ++n, current: () => n }; })();
  addBrandBand(ws, wb, brand, row, {
    widths: INSTR_WIDTHS,
    title: 'How to complete this schedule',
    subtitle: `${review.project.name} \u2014 ${review.subcontractor.tradePackage}`,
    meta: `${review.document.reference}   \u00b7   Revision ${review.document.revision}   \u00b7   Response requested by ${formatDate(review.document.responseRequestedBy)}`,
    titleSpanTo: 'C',
    lastCol: 'C',
    logoWidthPx: 130,
  });

  let r = row.current() + 1;
  const heading = (text, size = 14) => {
    ws.getRow(r).height = size + 12;
    ws.mergeCells(`B${r}:C${r}`);
    Object.assign(ws.getCell(`B${r}`), {
      value: text,
      font: { name: font, size, bold: true, color: { argb: argb(p.accent) } },
      alignment: { vertical: 'middle' },
    });
    r += 1;
  };
  const para = (text, opts = {}) => {
    ws.getRow(r).height = estimateRowHeight([{ text, width: 104, fontSize: 10.5 }], { minHeight: 18, lineHeight: 13 });
    ws.mergeCells(`B${r}:C${r}`);
    Object.assign(ws.getCell(`B${r}`), {
      value: text,
      font: { name: font, size: 10.5, color: { argb: argb(opts.muted ? p.muted : p.ink) }, italic: !!opts.italic },
      alignment: { vertical: 'top', wrapText: true },
    });
    r += 1;
  };
  const definition = (term, text, colour) => {
    ws.getRow(r).height = estimateRowHeight([{ text, width: 78, fontSize: 10 }], { minHeight: 20, lineHeight: 13 });
    Object.assign(ws.getCell(`B${r}`), {
      value: term,
      font: { name: font, size: 10, bold: true, color: { argb: argb(colour) } },
      alignment: { vertical: 'top' },
      border: { top: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
    });
    Object.assign(ws.getCell(`C${r}`), {
      value: text,
      font: { name: font, size: 10, color: { argb: argb(p.ink) } },
      alignment: { vertical: 'top', wrapText: true },
      border: { top: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
    });
    r += 1;
  };

  heading('Three steps', 12);
  para('1.  Work through the Commercial Summary tab. The two right-hand columns are the only cells open for editing — everything else is locked so the recorded positions cannot be altered by accident.');
  para('2.  Pick a Builder Response against each item from the drop-down, then use Builder Comments for any qualification or alternative wording.');
  para(`3.  Complete the Builder Sign-off block at the foot of the schedule and return the file to ${review.preparedBy.email} by ${formatDate(review.document.responseRequestedBy)}.`);
  ws.getRow(r).height = 12; r += 1;

  heading('What each response means', 12);
  definition('Accepted', 'The proposed wording is agreed and will be incorporated by amendment before execution.', p.statusAccepted);
  definition('Accepted as amended', 'Agreed in principle, subject to the alternative wording recorded in Builder Comments.', p.statusAmended);
  definition('Rejected', 'Not agreed. Please record the reason so the item can be closed out or escalated.', p.statusRejected);
  definition('Further discussion required', 'Needs a call before either party commits. Note who to contact.', p.statusDiscuss);
  ws.getRow(r).height = 14; r += 1;

  heading('Document control', 12);
  const control = [
    ['Reference', review.document.reference],
    ['Revision', review.document.revision],
    ['Prepared', formatDate(review.document.preparedOn)],
    ['Response requested by', formatDate(review.document.responseRequestedBy)],
    ['Prepared by', `${review.preparedBy.entity} — ${review.preparedBy.contactName}, ${review.preparedBy.email}`],
    ['Departures proposed', String(review.departures.length)],
  ];
  for (const [k, v] of control) {
    ws.getRow(r).height = 18;
    Object.assign(ws.getCell(`B${r}`), {
      value: k,
      font: { name: font, size: 9, bold: true, color: { argb: argb(p.muted) } },
      alignment: { vertical: 'middle' },
      border: { bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
    });
    Object.assign(ws.getCell(`C${r}`), {
      value: v,
      font: { name: font, size: 10.5, color: { argb: argb(p.ink) } },
      alignment: { vertical: 'middle' },
      border: { bottom: { style: 'thin', color: { argb: argb(p.ruleSoft) } } },
    });
    r += 1;
  }
  return ws;
}

export { COLUMNS };
