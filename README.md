# SubSync review outputs — Commercial Summary Schedule, departures email, Pre-Commencement Pack

Generators for the documents a subcontractor sends to a builder out of SubSync:

| Output | Generator | Sample |
| --- | --- | --- |
| Commercial Summary Schedule (`.xlsx`) | `src/commercial-summary.mjs` | `samples/Ridgeline Facades…Commercial Summary Schedule.xlsx` |
| Drafted departures email (HTML + text + `.eml`) | `src/departures-email.mjs` | `samples/departures-email.eml` |
| Pre-Commencement Pack (`.pdf`, A4) | `src/pre-commencement-pack.mjs` | `samples/pre-commencement/` (one per example brand) |

All three take their colours from the account's **Settings → Company Details →
Brand colours**, using the same rules the app applies to its own notices,
orders and variations (see [Brand colours](#brand-colours)).

```bash
npm install
npm test                  # palette derivation against every stored colour pairing
npm run build:samples     # writes samples/ from src/sample-data.mjs
npm run preview           # email with the logo inlined, for opening in a browser
npm run build:pack        # Pre-Commencement Pack PDF for each example brand
npm run build:fixtures    # regenerate the fictional SWMS, plan, certificate and ticket it binds in
BRAND=brand/acme.json npm run build:samples
```

From the pipeline, pass the organisation row straight in:

```js
import { brandFromOrganisation } from './src/brand.mjs';
const brand = brandFromOrganisation(orgRow, { logo, contact });   // orgRow = { name, brand_dark, brand_light }
```

Previews: [`samples/preview/schedule-page1.png`](samples/preview/schedule-page1.png),
[`samples/preview/schedule-page2.png`](samples/preview/schedule-page2.png),
[`samples/preview/email-full.png`](samples/preview/email-full.png).

---

## Review of the current output

Measured against a live production output — a cladding package schedule and its
covering email. The sample payload in this repo is fictional; the findings below
are from the real pair.

**Spreadsheet**

1. **No logo where anyone sees it.** The Vettex wordmark was only in the print
   footer, via a VML part. On screen — which is how the builder opens it — the
   document was unbranded.
2. **No brand colours at all.** Header fill `#E6E6E6`, borders `#B8C4E0`
   (a blue), body text default black. `styles.xml` also carried a full
   green→amber→red fill ramp that nothing referenced — dead styles from an
   earlier template.
3. **Clause text was truncated with an ellipsis.** The `Current Subcontract
   Clause` column held a one-line summary cut off mid-sentence, so the builder
   was asked to agree a change to wording the schedule never showed them. This
   is a payload problem, not a formatting one — the generator now renders
   whatever it is given, in full.
4. **Nowhere to respond.** `Builder Review and Sign Off` was one empty,
   unconstrained column. No response values, no comments column, no sign-off
   block, so replies come back as free prose in an email instead of in the file.
5. **Nothing locked.** Any recipient could quietly edit the proposed wording and
   return it looking untouched.
6. **`AutoFilter` set but no frozen panes.** Scroll past two items and the
   headers are gone.
7. **No print titles, gridlines on, fit-to-one-page-wide on default paper.** A
   230-character wide schedule shrunk onto A4 is unreadable.
8. **Subcontract sum stored as a string** in the form `$0.00 (excluding GST)`, so
   it cannot be used in a formula and the GST basis is buried in the value.
9. **No document control** — no reference, revision, date, or response-by date,
   on a document that will go through several rounds.

**Email**

1. **No logo anywhere.** SubSync was a 4px navy bar; the account's own brand was
   absent, so the letter the builder receives had no branding at all.
2. **The forwardable draft was a grey `pre-wrap` block** — the user had to
   copy it out, paste it somewhere, and lose the formatting.
3. **Two identities in one message with no boundary**, plus a plain-text note
   telling the user to hand-delete it before forwarding.
4. **`div`-based layout, no MSO wrapper and no preheader text,** and disclaimer
   text at `#9aa3b2` on white (≈2.9:1 — fails WCAG AA).

## What changed

**Spreadsheet** — `samples/preview/schedule-page1.png`

- Logo top right of the print area, with an accent-colour rule closing the
  masthead under it. The band stays white so a dark wordmark always reads.
- Company Details colours applied the way the app applies them: the header
  panel colour on the table header row (white or near-black text, whichever the
  app would use), the accent colour on the title, masthead rule and section
  headings, and zebra banding as a conditional-format rule (so it survives
  filtering and re-sorting).
- **Two visual zones.** A band above the headers splits
  `SUBCONTRACT POSITION AND PROPOSED DEPARTURES` (accent) from
  `FOR BUILDER COMPLETION` (a neutral slate), and the builder's two columns keep
  a slate header, a medium left border and a cream input fill.
- `Builder Response` is a drop-down — Accepted / Accepted as amended / Rejected /
  Further discussion required — with conditional formatting per value, plus a
  `Builder Comments` column beside it.
- `Basis of Request` column. The tender qualification behind each item is
  already in the email; putting it in the schedule is what makes a departure
  arguable rather than a preference.
- Everything locked except the builder's two columns and the signature fields.
  No password, so it is a guardrail rather than a lock.
- Builder sign-off block (name, position, signature, date) against an "Issued
  by" block, and a line stating that returning the schedule does not itself
  amend the subcontract.
- Frozen panes at the header, print titles repeated on every page, gridlines
  off, A3 landscape fit-to-width so 10pt text stays 10pt.
- Subcontract sum is a real number with the GST basis in the number format.
  Dates are real dates. Document reference, revision, prepared date and
  response-by date in the header block, and in the footer of every page.
- Second tab, `How to Complete`: three steps, what each response value means,
  document control. Same masthead and logo.
- Row heights computed from the content, so nothing is clipped and nothing is
  truncated.

**Email** — `samples/preview/email-full.png`

- **Split into two zones with a cut line.** The navy SubSync strip at the top is
  the product talking to its user. Below the cut line sits the subcontractor's
  own letter, in their brand, written to be forwarded as-is — no copy-and-paste.
- **Logo in the letter head**, top right, embedded as `cid:brandlogo` in a
  `multipart/related` part so it survives a forward. `npm run preview` swaps it
  for a data URI for browser checks.
- **No SubSync marks below the cut line**, and the AI disclaimer stays in the
  SubSync strip. The builder should not be told the position they are being
  asked to agree was AI-drafted — and the current copy already promises "the
  builder never hears from SubSync".
- Each departure is a card: item ref and area, clause, current position,
  proposed position, basis of request — so the builder can respond without
  opening the attachment.
- Facts table (project, package, sum, count, response-by), signature block, and
  the account's own footer line.
- Table-based layout with an MSO conditional wrapper, fixed 640px with a mobile
  stack, hidden preheader, `alt` text on the logo, `color-scheme: light` and
  explicit backgrounds so dark-mode inversion cannot hide a dark logo on a dark
  card. Greys darkened to `#5A5A5A` (7:1 on white).
- Plain-text alternative mirrors the letter item for item, with the same cut
  line.

## Pre-Commencement Pack

Measured against the pack the app produced for Collins St facade demolition
(Meridian Built, 14/10/2026).

**What was wrong**

1. **The title and section headings were near-invisible.** They were set in a
   pale brand colour on white, so they all but disappeared.
2. **The schedule did not reconcile and the pack buried it.** Total
   $1,287,000 against a recorded contract sum of $1,260,000, noted in grey
   under the table. The $27,000 is the provisional sum ($45,000) less the
   hoarding credit ($18,000); contract works alone agree with the sum.
3. **No item numbers.** Claims had nothing to reference line by line.
4. **Role printed twice** — "Project Manager — Project Manager",
   "Contract Administrator — Contracts Administrator".
5. **Emails wrapped mid-word** (`grace.okonkwo@demo-` / `seed…`).
6. **Pages 2 and 3 had no masthead or document control**; the cover was a logo
   and five lines; dates were `14/10/2026`.

**What changed** — `samples/preview/pack-*.png`

- Logo top right on the cover and every section page; entity name as a
  wordmark when no logo is on file. Accent rule under the masthead.
- Company Details colours applied by the same rules as the schedule: panel
  colour on table header rows, tint on section rows, accent on rules. New
  `accentInk` token: the accent darkened only when it carries text, so a pale
  accent still reads.
- Cover carries the figures that matter: contract sum, schedule total,
  difference (amber when it does not reconcile, green when it does).
- Claim breakdown numbered `1.1`, `1.2`…, with section subtotals, % of
  contract sum, a total, a reconciliation strip and, when it does not
  reconcile, a flag stating where the difference comes from.
- Team table de-duplicates role/position, breaks emails only after the `@`,
  makes phone and email live links, shows `—` for missing details.
- Document reference, revision, status and a long-form date on the cover;
  running footer with entity, project, reference and page x of y.

**Everything the pack screen can include.** Each tick on the pack screen maps
to a section, and a section only prints when it is ticked:

| Pack screen | Section | What it shows |
| --- | --- | --- |
| Claim breakdown | Claim breakdown | numbered schedule, subtotals, reconciliation |
| Project team | Project team | names, roles, phone, email |
| Tickets & inductions | Tickets and inductions | per person: ticket, number, issuer, expiry and status, copy |
| Your insurances | Insurances | cover, insurer, policy no., limit, expiry and status, certificate |
| Your standard documents | Safety and compliance documents | grouped SWMS / plans / licences, ref, rev, date, high risk construction work categories for SWMS |
| (any attached file) | Attachments | lettered index with page ranges |

Expiry status is worked out from the pack date: *Expired* (red), *Expires in
n days* inside 30 days (amber), *Current* (green), *No expiry*.

**Attachments are bound in, not restyled.** A SWMS, plan or certificate of
currency has to go out exactly as issued, so each one keeps its own layout,
page size and orientation (A4 landscape SWMS and A3 plans included). Each
page is scaled into a margin band carrying the attachment letter and title on
top and the pack's footer and page number underneath, so pages run 1 to n
across the whole pack and the index can give page ranges. Ticket photos (PNG
or JPG) are placed at card size at the top of an A4 page. Anything listed
without a file prints as *Not attached*.

The payload contract is `samplePack` in `src/sample-data.mjs`. The one field
the app does not obviously supply is `claimBreakdown[].kind`
(`contract` / `provisional` / `adjustment`); without it the pack cannot say
which lines explain a difference.

## Decisions worth challenging

- **No risk score, priority or internal note in either output.** SubSync holds
  them, and the current email explicitly promises they stay out of the
  builder-facing file. Useful for triage, wrong to hand the other side.
- **A3 landscape.** Eight columns of contract wording will not read on A4. Set
  `paperSize: 9` in `src/commercial-summary.mjs` for A4 if that is a problem.
- **Sheet protection without a password.** It stops accidental edits to the
  proposed wording; anyone determined can still unprotect it. A password would
  be hostile to the builder.
- **The builder's zone is neutral, not a brand colour.** Company Details holds
  two colours and both are already spoken for, so the builder's columns take a
  slate that sits apart from any panel — navy, grey, white or magenta.
- **This repo sits alongside the app's own generator.** The production schedule
  comes from `lib/documents/departure-schedule.ts` in `subsync-app`, which already
  reads `brand_dark` for its header and prints the logo in the footer. The
  layout here (response drop-downs, sign-off block, locked cells, logo top
  right) is the reference for porting into that generator.

## Brand colours

`src/brand.mjs` follows the app's rules in `subsync-app` `lib/branding.ts`
exactly, so a schedule or letter from here matches every other document the
app prints for the same account.

| Column | Label in Settings | Drives here |
| --- | --- | --- |
| `brand_dark` | Header panel colour | table header row fill |
| `brand_light` | Accent colour | title, masthead rule, section headings, accent borders, links |

**Header text follows the app's rule.** White text when the panel clears
4.5:1 against white; otherwise near-black `#1a1a1a`, letterhead style. A white
or light-grey panel is a deliberate choice in the app (there is a *Use white*
button), not a mistake to correct.

**Unset columns fall back to the app's defaults** — navy `#091747` panel and
blue `#1f5fc4` accent — which is what 21 of 27 accounts get today.

Derived tokens:

| Token | From | Used for |
| --- | --- | --- |
| `panel`, `onPanel`, `panelRule` | `brand_dark` and the app's 4.5:1 rule | table header row |
| `accent` | `brand_light`, unchanged | title, rule, headings, borders |
| `inkOnWhite` | the panel if dark, else `#1a1a1a` (the app's `inkOnWhite`) | item reference numbers |
| `tint`, `tintSoft` | pale panel, or pale accent when the panel is white; lightened until label text reads | label cells, zone bands |
| `builderZone` | neutral slate apart from the panel | builder's columns |
| `status*` | fixed | response colours — they carry meaning, so never tenant-coloured |

`npm test` runs every stored pairing and the empty case through the app's
panel rule and the contrast checks.

## Payload contract

`src/sample-data.mjs` documents the shape both generators consume, with a
fictional payload — real parties, figures and clause wording stay out of the
repo. Two fields the current pipeline does not appear to supply:

- `departures[].basis` — the tender qualification (already generated for the
  email body).
- `document.{reference,revision,preparedOn,responseRequestedBy,status}` —
  document control. Both degrade gracefully, but the schedule is stronger with
  them.

Full clause text is required, not a truncated summary.
