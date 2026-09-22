/**
 * The payload contract both generators consume. This is the shape the app (or
 * n8n) has to supply — every string here is rendered verbatim, no truncation.
 *
 * review = {
 *   document:  { reference, revision, preparedOn, responseRequestedBy, status },
 *   project:   { name, address },
 *   headContractor:   { name, acn, shortName },
 *   subcontractor:    { name, acn, tradePackage },
 *   commercial:       { subcontractSum, gstTreatment, contractType },
 *   preparedBy:       { entity, contactName, position, email, phone },
 *   departures: [{ ref, area, clause, currentPosition, proposedPosition, basis }]
 * }
 *
 * Nothing internal to SubSync belongs in here — no risk score, no priority, no
 * reviewer note. This payload is builder-facing by definition.
 *
 * The data below is fictional. Sample payloads live in the repo, so they never
 * carry a real subcontract's parties, figures or wording.
 */
export const sampleReview = {
  document: {
    reference: 'VTX-HARROW-CSS-001',
    revision: 'A',
    preparedOn: '2026-09-18',
    responseRequestedBy: '2026-09-25',
    status: 'For builder review',
  },
  project: {
    name: 'Harrow Street',
    address: '42 Harrow Street, Brunswick East, Victoria 3057',
  },
  headContractor: {
    name: 'Northline Constructions (Vic) Pty Ltd',
    shortName: 'Northline',
    acn: '111 222 333',
  },
  subcontractor: {
    name: 'Ridgeline Facades Pty Ltd',
    acn: '444 555 666',
    tradePackage: 'FC01 Facade Cladding Package',
  },
  commercial: {
    subcontractSum: 240000,
    gstTreatment: 'excluding GST',
    contractType: 'Lump Sum – Supply and Install of FC01 Facade Cladding Package',
  },
  preparedBy: {
    entity: 'Vettex Pty Ltd',
    contactName: 'Chris Coyle',
    position: 'Director',
    email: 'chris@vettex.com.au',
    phone: '',
  },
  departures: [
    {
      ref: 80,
      area: 'Body Clause',
      clause: 'Cl. 10.9 – Payment of Tax Invoice',
      currentPosition:
        "'The Tax Invoice is payable by Northline within the period specified in the Contract Particulars.' The Contract Particulars specify the Tax Invoice is payable on the last day of the calendar month following the month in which the Progress Claim is made.",
      proposedPosition:
        "Replace 'The Tax Invoice is payable by Northline within the period specified in the Contract Particulars.' with 'The Tax Invoice is payable by Northline within 30 days of receipt, consistent with the Trade Contractor's tendered payment terms.'",
      basis: "Tender qualification: '30 days from invoice.'",
    },
    {
      ref: 213,
      area: 'Annexure/Schedule',
      clause: 'Schedule 1 Item 28 – Liquidated Damages',
      currentPosition:
        '(a) $5,000 per day for failure to achieve Works Completion; and (b) an additional $5,000 per day for delay to Head Contract Practical Completion. No aggregate cap.',
      proposedPosition:
        "Replace '(a) $5,000 per day; or (b) $5,000 per day.' with '(a) $120 per day (being 5% of the Contract Price pro-rated over 100 days); and (b) Nil. Total LDs payable under this Trade Contract shall not exceed $12,000 (5% of the Contract Price). Liquidated damages are the sole and exclusive remedy of Northline for delay in achieving Works Completion.'",
      basis: "Tender qualification: 'Will not accept liquidated damages above 5% of subcontract sum'.",
    },
  ],
};
