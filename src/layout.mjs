/** Shared geometry helpers. Excel column widths are in characters, image
 *  anchors are in pixels, so anything that has to line up needs converting. */

/** Excel's own conversion for the default 11pt font. */
export const charsToPx = (chars) => Math.round(chars * 7 + 5);

export const totalPx = (widths) => widths.reduce((sum, w) => sum + charsToPx(w), 0);

export const EMU_PER_PIXEL = 9525;   // at 96 dpi
export const EMU_PER_POINT = 12700;

/**
 * Anchor for an image whose right edge sits `insetPx` in from the right edge
 * of the last column.
 *
 * exceljs accepts a decimal `col`, but converts the fraction to an offset of
 * `width * 10000` rather than EMU, which lands the image well left of where it
 * was asked for — so the native EMU offsets are supplied directly.
 */
export function rightAlignedAnchor(widths, imageWidthPx, { insetPx = 10, row = 0, rowOffsetPt = 0 } = {}) {
  const target = totalPx(widths) - imageWidthPx - insetPx;
  let consumed = 0;
  let nativeCol = widths.length - 1;
  let offsetPx = 0;
  for (let i = 0; i < widths.length; i += 1) {
    const w = charsToPx(widths[i]);
    if (consumed + w > target) {
      nativeCol = i;
      offsetPx = target - consumed;
      break;
    }
    consumed += w;
  }
  return {
    nativeCol,
    nativeColOff: Math.max(0, Math.round(offsetPx * EMU_PER_PIXEL)),
    nativeRow: row,
    nativeRowOff: Math.max(0, Math.round(rowOffsetPt * EMU_PER_POINT)),
  };
}

/**
 * Wrapped-text row height. Excel will not auto-fit a wrapped cell that the
 * generator wrote, so the height is computed from the content instead of
 * being left at default (which is what clipped text in the old output).
 */
export function estimateRowHeight(cells, { minHeight = 30, maxHeight = 240, lineHeight = 12.6, padding = 9 } = {}) {
  let lines = 1;
  for (const { text, width, fontSize = 10 } of cells) {
    if (!text) continue;
    // ~1.9 characters per width-unit-per-point at 10pt Calibri.
    const charsPerLine = Math.max(6, Math.floor((width * 11) / fontSize));
    const wrapped = String(text)
      .split('\n')
      .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / charsPerLine)), 0);
    lines = Math.max(lines, wrapped);
  }
  return Math.min(maxHeight, Math.max(minHeight, lines * lineHeight + padding));
}

export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
