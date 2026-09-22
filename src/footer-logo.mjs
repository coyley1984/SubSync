import { readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

/**
 * Repeats the logo in the print footer of every page.
 *
 * Header/footer graphics are the only images Excel repeats across printed
 * pages, and they live in a legacy VML part that exceljs does not write — so
 * the part is injected into the finished package. The '&G' placeholder in the
 * worksheet's footer is what this hooks up.
 */
export async function injectFooterLogo(xlsxPath, logoPath, { widthPt = 102, heightPt = 33, sheetFile = 'xl/worksheets/sheet1.xml' } = {}) {
  const zip = await JSZip.loadAsync(await readFile(xlsxPath));

  const sheetPath = sheetFile;
  const sheetXml = await zip.file(sheetPath).async('string');
  if (!sheetXml.includes('&amp;G') && !sheetXml.includes('&G')) {
    return xlsxPath; // nothing asked for a footer graphic
  }

  const mediaName = 'hf-logo.png';
  zip.file(`xl/media/${mediaName}`, await readFile(logoPath));

  zip.file('xl/drawings/vmlDrawingHF1.vml', vml({ widthPt, heightPt }));
  zip.file('xl/drawings/_rels/vmlDrawingHF1.vml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rIdHFLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`
    + `</Relationships>`);

  // Worksheet -> VML relationship
  const relPath = sheetPath.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels');
  const relXml = zip.file(relPath)
    ? await zip.file(relPath).async('string')
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const relId = nextRelId(relXml);
  zip.file(relPath, relXml.replace('</Relationships>',
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawingHF1.vml"/></Relationships>`));

  // <legacyDrawingHF/> has a fixed position in the schema: after <drawing/>,
  // before <picture/>, <tableParts/> and <extLst/>.
  zip.file(sheetPath, insertLegacyDrawingHF(sheetXml, relId));

  // Declare the vml and png part types if they are not already defaulted.
  const ctPath = '[Content_Types].xml';
  let ct = await zip.file(ctPath).async('string');
  if (!ct.includes('Extension="vml"')) {
    ct = ct.replace('<Types ', '<Types ').replace(/(<Types[^>]*>)/,
      `$1<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>`);
  }
  if (!ct.includes('Extension="png"')) {
    ct = ct.replace(/(<Types[^>]*>)/, `$1<Default Extension="png" ContentType="image/png"/>`);
  }
  zip.file(ctPath, ct);

  await writeFile(xlsxPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return xlsxPath;
}

function nextRelId(relXml) {
  const used = [...relXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  return `rId${(used.length ? Math.max(...used) : 0) + 1}`;
}

function insertLegacyDrawingHF(sheetXml, relId) {
  const tag = `<legacyDrawingHF r:id="${relId}"/>`;
  const followers = ['<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst'];
  let at = -1;
  for (const f of followers) {
    const i = sheetXml.indexOf(f);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) at = sheetXml.lastIndexOf('</worksheet>');
  return sheetXml.slice(0, at) + tag + sheetXml.slice(at);
}

const vml = ({ widthPt, heightPt }) => `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">`
  + `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>`
  + `<v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f">`
  + `<v:stroke joinstyle="miter"/>`
  + `<v:formulas><v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/>`
  + `<v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/>`
  + `<v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/></v:formulas>`
  + `<v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype>`
  + `<v:shape id="RF" o:spid="_x0000_s1025" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${widthPt}pt;height:${heightPt}pt;z-index:1">`
  + `<v:imagedata o:relid="rIdHFLogo" o:title="logo"/><o:lock v:ext="edit" rotation="t"/></v:shape></xml>`;
