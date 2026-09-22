import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { css, brandAsset } from './brand.mjs';
import { formatDate } from './layout.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n) => `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Builds the draft-departures email.
 *
 * Two identities, deliberately kept apart:
 *   - the SubSync strip at the top is the product talking to its user and is
 *     cut off when the email is forwarded;
 *   - the card below it is the subcontractor's own letter, in the account's
 *     brand, written to be sent to the builder untouched. No SubSync marks
 *     appear inside it, and neither does the AI disclaimer.
 */
export function buildDeparturesEmail(review, brand, product, { logoSrc = 'cid:brandlogo' } = {}) {
  const b = brand.palette;
  const s = product.palette;
  const f = brand.fonts.email;
  const count = review.departures.length;
  const builder = review.headContractor;

  const subjectToForward = `Proposed subcontract departures — ${review.project.name} — ${review.subcontractor.tradePackage}`;
  const subject = `[Draft to forward] ${subjectToForward}`;
  const preheader = `${count} departure${count === 1 ? '' : 's'} drafted for ${review.project.name} — ready to forward to ${builder.shortName}.`;

  const chip = (label, value) => `
              <tr>
                <td style="padding:5px 16px 5px 0;font:600 11px/1.4 ${f};color:${css(s.brandTint)};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
                <td style="padding:5px 0;font:400 12.5px/1.45 ${f};color:#FFFFFF;vertical-align:top;">${esc(value)}</td>
              </tr>`;

  const departureBlock = (d, i) => `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 18px 0;background:${css(b.paper)};border:1px solid ${css(b.ruleSoft)};border-left:3px solid ${css(b.brand)};">
              <tr>
                <td style="padding:14px 18px 10px 18px;">
                  <div style="font:700 10px/1.3 ${f};letter-spacing:0.8px;text-transform:uppercase;color:${css(b.muted)};padding-bottom:4px;">Item ${esc(d.ref)} &nbsp;·&nbsp; ${esc(d.area)}</div>
                  <div style="font:700 15px/1.35 ${f};color:${css(b.ink)};">${i + 1}. ${esc(d.clause)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 18px 4px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="padding:8px 0 2px 0;font:700 10px/1.3 ${f};letter-spacing:0.6px;text-transform:uppercase;color:${css(b.muted)};border-top:1px solid ${css(b.ruleSoft)};">Current subcontract position</td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px 0;font:400 13.5px/1.6 ${f};color:${css(b.muted)};">${esc(d.currentPosition)}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0 2px 0;font:700 10px/1.3 ${f};letter-spacing:0.6px;text-transform:uppercase;color:${css(b.brand)};border-top:1px solid ${css(b.ruleSoft)};">Proposed position</td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px 0;font:400 13.5px/1.6 ${f};color:${css(b.ink)};">${esc(d.proposedPosition)}</td>
                    </tr>${d.basis ? `
                    <tr>
                      <td style="padding:8px 0 2px 0;font:700 10px/1.3 ${f};letter-spacing:0.6px;text-transform:uppercase;color:${css(b.muted)};border-top:1px solid ${css(b.ruleSoft)};">Basis of request</td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 12px 0;font:italic 400 13px/1.55 ${f};color:${css(b.muted)};">${esc(d.basis)}</td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>`;

  const factRow = (label, value) => `
                    <tr>
                      <td style="padding:6px 14px 6px 0;font:600 11px/1.4 ${f};color:${css(b.muted)};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
                      <td style="padding:6px 0;font:400 13px/1.45 ${f};color:${css(b.ink)};vertical-align:top;">${esc(value)}</td>
                    </tr>`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-AU">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { color:${css(b.brand)}; }
  @media screen and (max-width:640px) {
    .wrap { width:100% !important; }
    .pad { padding-left:18px !important; padding-right:18px !important; }
    .stack { display:block !important; width:100% !important; text-align:left !important; }
    .logo { text-align:left !important; padding-top:14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F2F3F5;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F3F5;">
  <tr>
    <td align="center" style="padding:20px 10px 34px 10px;">
      <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640"><tr><td><![endif]-->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="wrap" style="width:640px;max-width:640px;">

        <!-- SubSync control strip: cut off when forwarded -->
        <tr>
          <td style="background:${css(s.brand)};border-radius:8px 8px 0 0;padding:18px 24px 6px 24px;" class="pad">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font:700 15px/1.2 ${f};letter-spacing:1.6px;color:#FFFFFF;">SUBSYNC</td>
                <td align="right" style="font:600 11px/1.2 ${f};letter-spacing:0.6px;text-transform:uppercase;color:${css(s.brandTint)};">Draft to forward</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:${css(s.brand)};padding:4px 24px 20px 24px;" class="pad">
            <p style="margin:10px 0 14px 0;font:400 14px/1.6 ${f};color:#FFFFFF;">Your departures email for <strong style="color:#FFFFFF;">${esc(review.project.name)}</strong> is drafted below, covering ${esc(count)} adopted departure${count === 1 ? '' : 's'}. Read it over, then <strong style="color:#FFFFFF;">forward this email from your own address</strong>, deleting everything above the cut line. ${esc(builder.shortName)} never hears from SubSync.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid rgba(255,255,255,0.18);border-bottom:1px solid rgba(255,255,255,0.18);">
              ${chip('Project', review.project.name)}
              ${chip('Builder', builder.name)}
              ${chip('Departures', String(count))}
              ${chip('Attached', 'Commercial Summary Schedule (.xlsx) — builder-ready, no internal notes')}
            </table>
            <p style="margin:16px 0 4px 0;font:600 10px/1.3 ${f};letter-spacing:0.8px;text-transform:uppercase;color:${css(s.brandTint)};">Subject to use</p>
            <p style="margin:0;padding:10px 14px;background:rgba(255,255,255,0.10);border-radius:5px;font:400 13px/1.5 ${f};color:#FFFFFF;">${esc(subjectToForward)}</p>
            <p style="margin:16px 0 0 0;font:400 11px/1.55 ${f};color:${css(s.brandTint)};">The wording below is AI-generated and is not legal advice. Check it, and take advice from a qualified Australian lawyer where the position matters.</p>
          </td>
        </tr>

        <!-- Forward line -->
        <tr>
          <td style="background:#F2F3F5;padding:14px 0 12px 0;font:600 10px/1.3 ${f};letter-spacing:1px;text-transform:uppercase;color:#7A7F87;text-align:center;">
            &#9986;&nbsp;&nbsp;cut line &mdash; forward everything below&nbsp;&nbsp;- - - - - - - - - - - - -
          </td>
        </tr>

        <!-- The subcontractor's own letter, in their brand -->
        <tr>
          <td style="background:${css(b.paper)};border:1px solid ${css(b.ruleSoft)};border-top:4px solid ${css(b.brand)};border-radius:2px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="pad" style="padding:26px 30px 0 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td class="stack" style="vertical-align:top;font:700 19px/1.3 ${f};color:${css(b.brand)};">Proposed subcontract departures</td>
                      <td class="stack logo" align="right" width="170" style="vertical-align:top;background:${css(b.paper)};">
                        <img src="${logoSrc}" width="150" height="48" alt="${esc(brand.logo.alt)}" style="display:block;width:150px;height:48px;border:0;outline:none;" />
                      </td>
                    </tr>
                  </table>
                  <p style="margin:6px 0 0 0;font:400 12px/1.5 ${f};color:${css(b.muted)};">${esc(review.project.name)} &nbsp;·&nbsp; ${esc(review.document.reference)} &nbsp;·&nbsp; Revision ${esc(review.document.revision)} &nbsp;·&nbsp; ${esc(formatDate(review.document.preparedOn))}</p>
                </td>
              </tr>
              <tr><td class="pad" style="padding:18px 30px 0 30px;"><div style="height:1px;background:${css(b.rule)};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

              <tr>
                <td class="pad" style="padding:20px 30px 0 30px;font:400 14.5px/1.65 ${f};color:${css(b.ink)};">
                  <p style="margin:0 0 14px 0;">Hi,</p>
                  <p style="margin:0 0 14px 0;">Thanks for the subcontract for ${esc(review.project.name)}. We have reviewed it and there ${count === 1 ? 'is one departure' : `are ${esc(count)} departures`} we would like to agree before execution. Our proposed positions are set out below for ${esc(builder.name)}'s consideration, and the full schedule is attached for mark-up and return.</p>
                </td>
              </tr>

              <tr>
                <td class="pad" style="padding:6px 30px 0 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background:${css(b.brandTintSoft)};border:1px solid ${css(b.ruleSoft)};">
                    <tr><td style="padding:12px 16px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        ${factRow('Project', `${review.project.name} — ${review.project.address}`)}
                        ${factRow('Package', review.subcontractor.tradePackage)}
                        ${factRow('Subcontract sum', `${money(review.commercial.subcontractSum)} ${review.commercial.gstTreatment}`)}
                        ${factRow('Departures', `${count} — response requested by ${formatDate(review.document.responseRequestedBy)}`)}
                      </table>
                    </td></tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td class="pad" style="padding:22px 30px 0 30px;">
                  ${review.departures.map(departureBlock).join('')}
                </td>
              </tr>

              <tr>
                <td class="pad" style="padding:0 30px 0 30px;font:400 14.5px/1.65 ${f};color:${css(b.ink)};">
                  <p style="margin:0 0 14px 0;">The attached schedule sets each item out in full with a response column, so it can be marked up and returned in one pass. Happy to walk through any of them on a call — these are about allocating risk where it can actually be managed.</p>
                  <p style="margin:0 0 4px 0;">Kind regards,</p>
                </td>
              </tr>

              <tr>
                <td class="pad" style="padding:8px 30px 26px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid ${css(b.brand)};">
                    <tr><td style="padding:2px 0 2px 12px;font:700 14px/1.5 ${f};color:${css(b.ink)};">${esc(review.preparedBy.contactName)}</td></tr>
                    ${review.preparedBy.position ? `<tr><td style="padding:0 0 2px 12px;font:400 12.5px/1.5 ${f};color:${css(b.muted)};">${esc(review.preparedBy.position)}, ${esc(review.preparedBy.entity)}</td></tr>` : `<tr><td style="padding:0 0 2px 12px;font:400 12.5px/1.5 ${f};color:${css(b.muted)};">${esc(review.preparedBy.entity)}</td></tr>`}
                    <tr><td style="padding:0 0 0 12px;font:400 12.5px/1.5 ${f};color:${css(b.muted)};"><a href="mailto:${esc(review.preparedBy.email)}" style="color:${css(b.brand)};text-decoration:none;">${esc(review.preparedBy.email)}</a>${review.preparedBy.phone ? ` &nbsp;·&nbsp; ${esc(review.preparedBy.phone)}` : ''}</td></tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td class="pad" style="padding:0 30px 22px 30px;">
                  <div style="height:1px;background:${css(b.ruleSoft)};line-height:1px;font-size:0;">&nbsp;</div>
                  <p style="margin:12px 0 0 0;font:400 11px/1.5 ${f};color:${css(b.muted)};">${esc(review.preparedBy.entity)}${brand.contact?.website ? ` &nbsp;·&nbsp; ${esc(brand.contact.website)}` : ''} &nbsp;·&nbsp; Prepared for ${esc(review.subcontractor.name)} (ACN ${esc(review.subcontractor.acn)})</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = buildText({ review, count, subjectToForward, builder });
  return { subject, subjectToForward, preheader, html, text };
}

function buildText({ review, count, subjectToForward, builder }) {
  const lines = [];
  lines.push('SUBSYNC — DRAFT TO FORWARD');
  lines.push('');
  lines.push(`Your departures email for ${review.project.name} is drafted below, covering ${count} adopted departure${count === 1 ? '' : 's'}.`);
  lines.push('Read it over, then forward this email from your own address, deleting everything above the cut line.');
  lines.push(`${builder.shortName} never hears from SubSync.`);
  lines.push('');
  lines.push(`Subject to use: ${subjectToForward}`);
  lines.push(`Attached: Commercial Summary Schedule (.xlsx) — builder-ready, no internal notes.`);
  lines.push('');
  lines.push('This wording is AI-generated and is not legal advice. Check it, and take advice from a');
  lines.push('qualified Australian lawyer where the position matters.');
  lines.push('');
  lines.push('----------- cut line \u2014 forward everything below -----------');
  lines.push('');
  lines.push('PROPOSED SUBCONTRACT DEPARTURES');
  lines.push(`${review.project.name} · ${review.document.reference} · Revision ${review.document.revision} · ${formatDate(review.document.preparedOn)}`);
  lines.push('');
  lines.push('Hi,');
  lines.push('');
  lines.push(`Thanks for the subcontract for ${review.project.name}. We have reviewed it and there ${count === 1 ? 'is one departure' : `are ${count} departures`} we would like to agree before execution. Our proposed positions are set out below for ${builder.name}'s consideration, and the full schedule is attached for mark-up and return.`);
  lines.push('');
  lines.push(`Project:          ${review.project.name} — ${review.project.address}`);
  lines.push(`Package:          ${review.subcontractor.tradePackage}`);
  lines.push(`Subcontract sum:  ${money(review.commercial.subcontractSum)} ${review.commercial.gstTreatment}`);
  lines.push(`Departures:       ${count} — response requested by ${formatDate(review.document.responseRequestedBy)}`);
  lines.push('');
  review.departures.forEach((d, i) => {
    lines.push(`${i + 1}. ${d.clause}  [Item ${d.ref} · ${d.area}]`);
    lines.push(`   Current position:  ${d.currentPosition}`);
    lines.push(`   Proposed position: ${d.proposedPosition}`);
    if (d.basis) lines.push(`   Basis of request:  ${d.basis}`);
    lines.push('');
  });
  lines.push('The attached schedule sets each item out in full with a response column, so it can be marked up and returned in one pass. Happy to walk through any of them on a call — these are about allocating risk where it can actually be managed.');
  lines.push('');
  lines.push('Kind regards,');
  lines.push(review.preparedBy.contactName);
  lines.push(review.preparedBy.position ? `${review.preparedBy.position}, ${review.preparedBy.entity}` : review.preparedBy.entity);
  lines.push(review.preparedBy.email);
  return lines.join('\n');
}

/** Writes a multipart/mixed + related + alternative message with the logo
 *  inline (cid:) so it survives a forward, and the schedule attached. */
export async function writeEml({ email, brand, review, attachment, outPath, from = 'SubSync <noreply@send.subsync.com.au>', to = null }) {
  const boundary = (n) => `----=_SubSync_${n}_${Math.random().toString(36).slice(2, 10)}`;
  const bMixed = boundary('mixed');
  const bRelated = boundary('related');
  const bAlt = boundary('alt');

  const logoPath = brandAsset(brand, 'email') ?? brandAsset(brand, 'print');
  const logo = logoPath ? readFileSync(logoPath) : null;
  const attachmentBytes = readFileSync(attachment.path);
  const b64 = (buf) => buf.toString('base64').replace(/(.{76})/g, '$1\r\n');
  const recipient = to ?? review.preparedBy.email;

  const parts = [];
  parts.push([
    `From: ${from}`,
    `To: ${recipient}`,
    `Subject: ${email.subject}`,
    `Date: ${new Date(`${review.document.preparedOn}T09:00:00+10:00`).toUTCString().replace('GMT', '+0000')}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${bMixed}"`,
    '',
    `--${bMixed}`,
    `Content-Type: multipart/related; boundary="${bRelated}"`,
    '',
    `--${bRelated}`,
    `Content-Type: multipart/alternative; boundary="${bAlt}"`,
    '',
    `--${bAlt}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(Buffer.from(email.text, 'utf8')),
    '',
    `--${bAlt}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(Buffer.from(email.html, 'utf8')),
    '',
    `--${bAlt}--`,
    '',
  ].join('\r\n'));

  if (logo) {
    parts.push([
      `--${bRelated}`,
      'Content-Type: image/png',
      'Content-Transfer-Encoding: base64',
      'Content-ID: <brandlogo>',
      `Content-Disposition: inline; filename="${basename(logoPath)}"`,
      '',
      b64(logo),
      '',
    ].join('\r\n'));
  }

  parts.push([
    `--${bRelated}--`,
    '',
    `--${bMixed}`,
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachment.filename ?? basename(attachment.path)}"`,
    '',
    b64(attachmentBytes),
    '',
    `--${bMixed}--`,
    '',
  ].join('\r\n'));

  writeFileSync(outPath, parts.join('\r\n'));
  return outPath;
}
