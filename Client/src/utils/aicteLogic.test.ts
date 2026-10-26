import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCategorySchema,
  validateApplicationForm,
  evaluateDocuPassEligibility,
  validateChecklistCompleteness,
  applyDocumentReupload,
} from './aicteLogic.js';
import { createPdfBytes } from './pdfExport.js';

test('getCategorySchema returns exact 8 fields and 4 checklist items for all 3 MVP categories', () => {
  const eoa = getCategorySchema('eoa');
  const intake = getCategorySchema('intake_increase');
  const newCourse = getCategorySchema('new_course');

  assert.ok(eoa);
  assert.equal(eoa.fields.length, 8);
  assert.equal(eoa.checklist.length, 4);

  assert.ok(intake);
  assert.equal(intake.fields.length, 8);
  assert.equal(intake.checklist.length, 4);

  assert.ok(newCourse);
  assert.equal(newCourse.fields.length, 8);
  assert.equal(newCourse.checklist.length, 4);
});

test('validateApplicationForm enforces seat increase rules and PID format', () => {
  const invalidResult = validateApplicationForm('intake_increase', {
    institutionName: 'Delhi Technical Campus',
    aictePid: 'INVALID-PID',
    academicYear: '2026-2027',
    existingApprovedCourse: 'B.Tech CSE',
    currentlyApprovedIntake: 120,
    requestedIntake: 60,
    facultyAvailabilityDetails: '18 Faculty available',
    infrastructureReadinessDetails: 'Labs ready',
  });

  assert.equal(invalidResult.isValid, false);
  assert.ok('aictePid' in invalidResult.errors);
  assert.ok('requestedIntake' in invalidResult.errors);

  const validResult = validateApplicationForm('intake_increase', {
    institutionName: 'Delhi Technical Campus',
    aictePid: '1-4829104321',
    academicYear: '2026-2027',
    existingApprovedCourse: 'B.Tech CSE',
    currentlyApprovedIntake: 60,
    requestedIntake: 120,
    facultyAvailabilityDetails: '18 Faculty available',
    infrastructureReadinessDetails: 'Labs ready',
  });

  assert.equal(validResult.isValid, true);
  assert.deepEqual(validResult.errors, {});
});

test('evaluateDocuPassEligibility distinguishes eligible, expired, and non-reusable documents', () => {
  const eligibleRecord = {
    passportId: 'DP-2026-8841',
    docuPassEligibleType: true,
    revoked: false,
    expired: false,
    validAcademicYears: ['2025-2026', '2026-2027'],
    priorOutcome: 'Passed',
  };
  const res1 = evaluateDocuPassEligibility(eligibleRecord, '2026-2027');
  assert.equal(res1.eligible, true);
  assert.equal(res1.status, 'Passed');

  const affidavitRecord = {
    ...eligibleRecord,
    docuPassEligibleType: false,
  };
  const res2 = evaluateDocuPassEligibility(affidavitRecord, '2026-2027');
  assert.equal(res2.eligible, false);
  assert.equal(res2.status, 'Not applicable');

  const expiredRecord = {
    ...eligibleRecord,
    validAcademicYears: ['2025-2026'],
  };
  const res3 = evaluateDocuPassEligibility(expiredRecord, '2026-2027');
  assert.equal(res3.eligible, false);
  assert.equal(res3.status, 'Expired');
});

test('validateChecklistCompleteness checks all 4 required supporting documents', () => {
  const partialState = {
    'eoa-doc-1': { fileName: 'prev_eoa.pdf' },
    'eoa-doc-2': { fileName: 'affidavit2.pdf' },
  };
  const check1 = validateChecklistCompleteness('eoa', partialState);
  assert.equal(check1.isComplete, false);
  assert.equal(check1.missingDocs.length, 2);

  const fullState = {
    'eoa-doc-1': { fileName: 'prev_eoa.pdf' },
    'eoa-doc-2': { fileName: 'affidavit2.pdf' },
    'eoa-doc-3': { docuPassId: 'DP-2026-102' },
    'eoa-doc-4': { fileName: 'infra.pdf' },
  };
  const check2 = validateChecklistCompleteness('eoa', fullState);
  assert.equal(check2.isComplete, true);
  assert.equal(check2.missingDocs.length, 0);
});

test('applyDocumentReupload preserves v1 in versions history and transitions status', () => {
  const sampleApp = {
    id: 'AICTE-2026-INC-4092',
    status: 'Clarification Requested',
    formData: { institutionName: 'IIET New Delhi' },
    documents: [
      {
        id: 'inc-doc-1',
        title: 'Affidavit 8',
        currentVersion: 1,
        fileName: 'Affidavit_8_v1_unsigned.pdf',
        fileSize: '840 KB',
        uploadedAt: '2026-10-18 14:20 IST',
        verificationStatus: 'Issue detected',
        reuploadRequested: true,
        versions: [],
      },
    ],
    auditLog: [],
  };

  const updated = applyDocumentReupload(
    sampleApp,
    'inc-doc-1',
    { fileName: 'Affidavit_8_v2_Notarized_100Rs.pdf', fileSize: '1.12 MB', uploadedAt: '2026-10-22 18:00 IST' },
    'Uploaded notarized Affidavit 8 with e-Stamp serial verified.'
  );

  assert.equal(updated.status, 'Resubmitted — Pending Officer Review');
  assert.equal(updated.documents[0].currentVersion, 2);
  assert.equal(updated.documents[0].reuploadRequested, false);
  assert.equal(updated.documents[0].versions.length, 1);
  assert.equal(updated.documents[0].versions[0].fileName, 'Affidavit_8_v1_unsigned.pdf');
  assert.equal(updated.auditLog.length, 1);
});

test('runOfficerDocumentVerification produces isolated per-document evidence and overall summary', async () => {
  const { runOfficerDocumentVerification, formatVerificationReportText } = await import('./aicteLogic.js');
  const sampleApp = {
    id: 'AICTE-2026-INC-4092',
    categoryId: 'intake_increase',
    categoryTitle: 'Increase in Student Intake',
    clause: 'Clause 2.5',
    status: 'Clarification Requested',
    formData: {
      institutionName: 'IIET New Delhi',
      aictePid: '1-4829104321',
      academicYear: '2026-2027',
    },
    documents: [
      {
        no: 1,
        id: 'inc-doc-1',
        title: 'Affidavit 8',
        verifies: 'Formal declaration for an increase in intake',
        currentVersion: 1,
        fileName: 'Affidavit_8_v1.pdf',
        verificationStatus: 'Issue detected',
        reuploadRequested: true,
        officerClarificationNote: 'Seat intake mismatch (90 vs 120 seats).',
        extractedFields: { 'Requested Intake': '90 Seats' },
      },
      {
        no: 2,
        id: 'inc-doc-2',
        title: 'Trust / Society / Company resolution (Format 3)',
        verifies: 'Approval for proposed additional seats',
        currentVersion: 1,
        fileName: 'Resolution_Format3.pdf',
        verificationStatus: 'Passed',
        docuPassReused: true,
        docuPassPassportId: 'DP-2026-NRO-71509',
        reuploadRequested: false,
        extractedFields: { 'Approved Action': '60 to 120 seats' },
      },
    ],
  };

  const report = runOfficerDocumentVerification(sampleApp, '2026-10-23 14:30 IST');
  assert.equal(report.totalDocuments, 2);
  assert.equal(report.verifiedCount, 1);
  assert.equal(report.failedCount, 1);
  assert.equal(report.documentReports[0].verified, false);
  assert.ok(report.documentReports[0].verificationReason.includes('Seat intake mismatch'));
  assert.equal(report.documentReports[1].verified, true);

  const text = formatVerificationReportText(sampleApp, report);
  assert.ok(text.includes('[DOCUMENT #1] Affidavit 8'));
  assert.ok(text.includes('[DOCUMENT #2] Trust / Society / Company resolution (Format 3)'));
  assert.ok(text.includes('SECTION 2: OVERALL EXECUTIVE VERIFICATION SUMMARY'));
});

test('createPdfBytes returns a PDF with xref and report text', () => {
  const report = Array.from({ length: 60 }, (_, index) => `Line ${index + 1} (verification)`).join('\n');
  const bytes = createPdfBytes(`AICTE Verification Report\nApplication ID: AICTE-2026-TEST\n${report}`);
  const pdf = new TextDecoder().decode(bytes);

  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('(AICTE Verification Report) Tj'));
  assert.ok(pdf.includes('(Line 1 \\(verification\\)) Tj'));
  assert.ok(pdf.includes('/Count 2'));
  assert.ok(pdf.includes('xref'));
  assert.ok(pdf.endsWith('%%EOF'));
});
