# SubSync review outputs — Commercial Summary Schedule + departures email

Generators for the two things a subcontractor actually sends to a builder after
a SubSync review:

| Output | Generator | Sample |
| --- | --- | --- |
| Commercial Summary Schedule (`.xlsx`) | `src/commercial-summary.mjs` | `samples/Ridgeline Facades…Commercial Summary Schedule.xlsx` |
| Drafted departures email (HTML + text + `.eml`) | `src/departures-email.mjs` | `samples/departures-email.eml` |

Both take their colours from the account's **Settings → Company Details →
Brand colours** — the `brand_light` and `brand_dark` columns on
`public.organisations`. The generators never hard-code a palette for a tenant;
they derive one from those two stored colours (see [Brand colours](#brand-colours)).

```bash
npm install
npm test                  # palette derivation against every stored colour pairing
npm run build:samples     # writes samples/ from src/sample-data.mjs
npm run preview           # email with the logo inlined, for opening in a browser
BRAND=brand/acme.json npm run build:samples
```

From the pipeline, pass the organisation row straight in:

```js
import { brandFromOrganisation } from './src/brand.mjs';
const brand = brandFromOrganisation(orgRow, { logo, contact });   // orgRow = { name, brand_light, brand_dark }
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

- Logo top right of the print area, with a brand-colour rule closing the
  masthead under it. The band stays white so a dark wordmark always reads.
- Company Details colours applied throughout: brand colour on the title,
  masthead rule and table header; the secondary colour on label cells and zone
  bands; greys tinted toward the brand hue; zebra banding as a
  conditional-format rule (so it survives filtering and re-sorting).
- **Two visual zones.** A band above the headers splits
  `SUBCONTRACT POSITION AND PROPOSED DEPARTURES` (brand colour) from
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

## Decisions worth challenging

- **No risk score, priority or internal note in either output.** SubSync holds
  them, and the current email explicitly promises they stay out of the
  builder-facing file. Useful for triage, wrong to hand the other side.
- **A3 landscape.** Eight columns of contract wording will not read on A4. Set
  `paperSize: 9` in `src/commercial-summary.mjs` for A4 if that is a problem.
- **Sheet protection without a password.** It stops accidental edits to the
  proposed wording; anyone determined can still unprotect it. A password would
  be hostile to the builder.
- **The builder's zone is neutral, not a brand colour.** Each account has at
  most two colours and the second is usually a grey or white, so there is
  rarely a real brand accent to use. A slate derived from the brand hue works
  against any tenant's colour — blue, orange or magenta — without inventing one.
- **Brand colours are darkened, never replaced.** A stored colour too pale to
  carry white header text (e.g. `#e06029` at 3.6:1) is stepped darker until it
  clears 4.5:1. The hue stays the account's own.

## Brand colours

`src/brand.mjs` turns the two stored colours into the full palette.

**Which colour is the brand.** The field names can't be relied on. Across the
six accounts that have set colours, these are the distinct pairings:

| `brand_light` | `brand_dark` | What was entered |
| --- | --- | --- |
| `#1f5fc4` | `#e6e6e6` | dark blue under "light", light grey under "dark" |
| `#e06029` | `#ffffff` | orange, and white as the "dark" colour |
| `#f686fe` | `#f21897` | pale pink and magenta — this one matches the labels |
| `#8e8e8e` | `#40abef` | mid-grey under "light", the actual brand blue under "dark" |

So the brand colour is whichever has more **chroma**, not whichever field it
sits in; the other becomes the secondary. Sorting by lightness would have picked
the grey over the blue in the last row.

**What each colour drives.**

| Token | From | Used for |
| --- | --- | --- |
| `brand` | brand colour, darkened only if white text fails 4.5:1 | title, masthead rule, table header, letter head |
| `brandTint` | secondary colour, lightened only as far as label text needs; derived from the brand if the secondary is white | label cells, zone bands |
| `ink`, `muted`, `rule` | greys carrying a trace of the brand hue | body text, secondary text, borders |
| `accent` | neutral slate, set apart from the brand in hue or lightness | builder's zone |
| `status*` | fixed | response colours — they carry meaning, so never tenant-coloured |

**No colours set** (21 of 27 accounts today) falls back to a charcoal palette.

`npm test` runs every stored pairing and the empty case through the contrast
checks.

**Worth fixing in the app.** "Light" and "dark" are being read as "first" and
"second". Relabelling the fields *Primary brand colour* and *Secondary colour
(optional)* would match how people actually fill them in; the generator already
handles either order.

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
