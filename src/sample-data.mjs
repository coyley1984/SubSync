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

/**
 * Pre-Commencement Pack payload.
 *
 * pack = {
 *   document:   { reference, revision, preparedOn, status },
 *   project:    { name, address },
 *   preparedFor: { name },
 *   preparedBy:  { entity },
 *   commercial:  { contractSum, gstTreatment },
 *   claimBreakdown: [{ title, kind: 'contract' | 'provisional' | 'adjustment', items: [{ description, amount }] }],
 *   team: [{ name, role, position, organisation, phone, email }],
 *   credentials: [{ name, role, items: [{ type, number, issuer, expires, file }] }],
 *   insurances:  [{ cover, insurer, policyNumber, limit, expires, certificate }],
 *   documents:   [{ category: 'SWMS' | 'Plan' | 'Licence' | other, title, reference,
 *                   revision, date, scope, highRiskWork: [], file }]
 * }
 *
 * Every section is optional and appears only when the builder-facing pack
 * includes it (the ticks on the pack screen). `file` / `certificate` is a PDF,
 * PNG or JPG; when present it is bound in behind the pack as a lettered
 * attachment, when absent the register shows "Not attached".
 *
 * `kind` is what lets the pack reconcile the schedule to the contract sum:
 * contract works are expected to equal it, provisional sums and adjustments
 * explain any difference. From the app's demo seed.
 */
export const samplePack = {
  document: {
    reference: 'VTX-COLLINS-PCP-001',
    revision: 'A',
    preparedOn: '2026-10-14',
    status: 'Issued for commencement',
  },
  project: {
    name: 'Collins St facade demolition',
    address: '480 Collins Street, Melbourne VIC 3000',
  },
  preparedFor: { name: 'Meridian Built Pty Ltd' },
  preparedBy: { entity: 'Vettex Pty Ltd' },
  commercial: { contractSum: 1260000, gstTreatment: 'Excluding GST' },
  claimBreakdown: [
    {
      title: 'Contract works',
      kind: 'contract',
      items: [
        { description: 'Preliminaries and road occupancy', amount: 96000 },
        { description: 'Scaffold, screens and public protection', amount: 178000 },
        { description: 'Facade panel removal, levels 1–8', amount: 384000 },
        { description: 'Structural take-down, podium', amount: 342000 },
        { description: 'Spoil removal and disposal', amount: 156000 },
        { description: 'Make good and handover', amount: 104000 },
      ],
    },
    {
      title: 'Provisional sums',
      kind: 'provisional',
      items: [{ description: 'Heritage stonework salvage', amount: 45000 }],
    },
    {
      title: 'Adjustments',
      kind: 'adjustment',
      items: [{ description: 'Credit — builder-supplied hoarding', amount: -18000 }],
    },
  ],
  team: [
    { name: 'Grace Okonkwo', role: 'Project Manager', email: 'grace.okonkwo@demo-seed.subsync.com.au' },
    { name: 'Chris Coyle', role: 'Director', phone: '0421 841 929', email: 'chris@vettex.com.au' },
    { name: 'Anita Rahman', role: 'Contract Administrator', position: 'Contracts Administrator', email: 'anita.rahman@demo-seed.subsync.com.au' },
    { name: 'Tom Whelan', role: 'Project Manager', position: 'Project Manager', email: 'tom.whelan@demo-seed.subsync.com.au' },
    { name: 'Dean Kovac', role: 'Site Manager', position: 'Site Manager', email: 'dean.kovac@demo-seed.subsync.com.au' },
  ],
  // Ticket numbers, policy numbers and attachments are fictional.
  credentials: [
    {
      name: 'Dean Kovac',
      role: 'Site Manager',
      items: [
        { type: 'Construction induction (white card)', number: 'CIC-0000001', issuer: 'WorkSafe Victoria' },
        { type: 'High risk work licence — DG, RB, WP', number: 'HRW-0000000', issuer: 'WorkSafe Victoria', expires: '2026-11-02', file: 'samples/fixtures/ticket-dean-kovac-hrwl.png' },
        { type: 'First aid (HLTAID011)', number: 'FA-24-0000', issuer: 'St John Ambulance Victoria', expires: '2027-08-15' },
      ],
    },
    {
      name: 'Tom Whelan',
      role: 'Project Manager',
      items: [
        { type: 'Construction induction (white card)', number: 'CIC-0000002', issuer: 'WorkSafe Victoria' },
        { type: 'Work safely at heights (RIIWHS204E)', number: 'WAH-23-0000', issuer: 'Registered training organisation', expires: '2026-09-30' },
      ],
    },
    {
      name: 'Grace Okonkwo',
      role: 'Project Manager',
      items: [
        { type: 'Construction induction (white card)', number: 'CIC-0000003', issuer: 'WorkSafe Victoria' },
        { type: 'Site induction — 480 Collins Street', issuer: 'Meridian Built', expires: '2027-10-14' },
      ],
    },
  ],
  insurances: [
    { cover: 'Contract Works and Mobile Plant', insurer: 'QBE Insurance', policyNumber: 'CW-SAMPLE-01', limit: 2000000, expires: '2027-02-28' },
    { cover: 'Motor Vehicle Fleet', insurer: 'Allianz Australia', policyNumber: 'MV-SAMPLE-02', expires: '2027-05-31' },
    { cover: 'Professional Indemnity', insurer: 'Chubb Insurance', policyNumber: 'PI-SAMPLE-03', limit: 5000000, expires: '2027-04-30' },
    { cover: 'Public and Products Liability', insurer: 'CGU Insurance', policyNumber: 'PL-SAMPLE-04', limit: 20000000, expires: '2027-03-31', certificate: 'samples/fixtures/certificate-public-liability.pdf' },
    { cover: 'WorkCover (Victoria)', insurer: 'WorkSafe Victoria', policyNumber: 'WC-SAMPLE-05', expires: '2027-06-30' },
  ],
  documents: [
    {
      category: 'SWMS', title: 'Facade panel removal, levels 1–8', reference: 'SWMS-01', revision: 'B', date: '2026-10-06',
      highRiskWork: ['Work at heights over 2 m', 'Work near a public road', 'Demolition of load-bearing elements'],
      file: 'samples/fixtures/swms-01-facade-panel-removal.pdf',
    },
    {
      category: 'SWMS', title: 'Structural take-down, podium', reference: 'SWMS-02', revision: 'A', date: '2026-10-06',
      highRiskWork: ['Demolition of load-bearing elements', 'Work involving powered mobile plant'],
      file: 'samples/fixtures/swms-02-podium-take-down.pdf',
    },
    {
      category: 'Plan', title: 'Traffic management plan — Collins Street lane closure', reference: 'TMP-01', revision: 'C', date: '2026-09-29',
      scope: 'Night works, lane 1 closed 7:00 pm–5:00 am', file: 'samples/fixtures/traffic-management-plan.pdf',
    },
    { category: 'Licence', title: 'Demolition and asbestos removal licence', reference: 'Class A', date: '2025-07-01' },
  ],
};
