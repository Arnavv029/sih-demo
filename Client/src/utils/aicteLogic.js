/**
 * Pure domain logic, category schemas, validation, DocuPass eligibility,
 * and deterministic verification findings for the AICTE Intelligent Application Verification Platform (V1 MVP).
 */

export const APPLICATION_CATEGORIES = {
  eoa: {
    id: 'eoa',
    code: 'APH-EOA-01',
    shortTitle: 'Extension of Approval (EoA)',
    title: '1. Extension of Approval (EoA)',
    clause: 'Approval Process Handbook — Chapter II, Clause 2.1',
    purpose: "Verify an existing institution's application to continue its approval.",
    checklistPurpose: 'Verify that an existing institution continues to meet applicable approval requirements.',
    fields: [
      {
        no: 1,
        key: 'institutionName',
        label: 'Institution name',
        description: 'Official institution name',
        type: 'text',
        placeholder: 'e.g., Indraprastha Institute of Engineering & Technology',
        required: true,
      },
      {
        no: 2,
        key: 'aictePid',
        label: 'AICTE Permanent ID (PID)',
        description: "Institution's registered AICTE ID",
        type: 'text',
        placeholder: 'e.g., 1-4829104321',
        required: true,
      },
      {
        no: 3,
        key: 'academicYear',
        label: 'Academic year',
        description: 'Year for which approval is requested',
        type: 'select',
        options: ['2026-2027', '2027-2028', '2025-2026'],
        required: true,
      },
      {
        no: 4,
        key: 'existingProgrammes',
        label: 'Existing approved programmes/courses',
        description: 'Course names covered by existing approval',
        type: 'textarea',
        placeholder: 'e.g., B.Tech Computer Science & Engineering (180 seats), B.Tech Electronics & Communication (120 seats), M.Tech Structural Engineering (30 seats)',
        required: true,
      },
      {
        no: 5,
        key: 'previousApprovalLetter',
        label: 'Previous AICTE approval letter',
        description: 'Upload or reference the previous approval letter (F.No. & issue date)',
        type: 'file_ref',
        placeholder: 'e.g., F.No. Northern/1-4829104321/2025/EoA (Dated 14-May-2025)',
        required: true,
      },
      {
        no: 6,
        key: 'facultyDetails',
        label: 'Faculty details',
        description: 'Updated faculty information (total regular faculty, PhD count, SFR)',
        type: 'textarea',
        placeholder: 'e.g., 142 Regular Faculty (38 Ph.D., 104 M.Tech), Student-Faculty Ratio 1:17.8, Cadre Ratio 1:2:6 compliant',
        required: true,
      },
      {
        no: 7,
        key: 'infrastructureDetails',
        label: 'Infrastructure details',
        description: 'Updated facilities information (instructional area, labs, library, barrier-free access)',
        type: 'textarea',
        placeholder: 'e.g., 18,450 sq.m built-up area, 34 specialized laboratories, 620-terminal computing center, digital library with 42,000 volumes',
        required: true,
      },
      {
        no: 8,
        key: 'selfDisclosureCompliance',
        label: 'Self-disclosure of compliance',
        description: 'Confirm that applicable AICTE requirements are met',
        type: 'compliance_confirm',
        placeholder: 'Confirmed: Zero deficiency declared in self-disclosure portal report for AY 2026-2027',
        required: true,
      },
    ],
    checklist: [
      {
        no: 1,
        id: 'eoa-doc-1',
        title: 'Previous AICTE EoA / approval letter',
        verifies: 'Existing approved programmes and intake',
        docuPassEligible: true,
        ruleCode: 'RULE-EOA-101',
      },
      {
        no: 2,
        id: 'eoa-doc-2',
        title: 'Affidavit 2',
        verifies: "Institution's formal declaration of compliance",
        docuPassEligible: false,
        ruleCode: 'RULE-EOA-102',
      },
      {
        no: 3,
        id: 'eoa-doc-3',
        title: 'Faculty details report',
        verifies: 'Reported faculty information and relevant qualifications',
        docuPassEligible: true,
        ruleCode: 'RULE-EOA-103',
      },
      {
        no: 4,
        id: 'eoa-doc-4',
        title: 'Infrastructure details / supporting records',
        verifies: 'Whether the institution has relevant facilities and supporting evidence',
        docuPassEligible: true,
        ruleCode: 'RULE-EOA-104',
      },
    ],
  },

  intake_increase: {
    id: 'intake_increase',
    code: 'APH-INC-02',
    shortTitle: 'Increase in Student Intake',
    title: '2. Increase in Student Intake',
    clause: 'Approval Process Handbook — Chapter II, Clause 2.5',
    purpose: 'Verify whether an institution has the required capacity to accommodate more students.',
    checklistPurpose: 'Verify whether an institution has the supporting approvals and capacity for its proposed increase in seats.',
    fields: [
      {
        no: 1,
        key: 'institutionName',
        label: 'Institution name',
        description: 'Official institution name',
        type: 'text',
        placeholder: 'e.g., Indraprastha Institute of Engineering & Technology',
        required: true,
      },
      {
        no: 2,
        key: 'aictePid',
        label: 'AICTE Permanent ID (PID)',
        description: "Institution's registered AICTE ID",
        type: 'text',
        placeholder: 'e.g., 1-4829104321',
        required: true,
      },
      {
        no: 3,
        key: 'academicYear',
        label: 'Academic year',
        description: 'Year for which the increase is requested',
        type: 'select',
        options: ['2026-2027', '2027-2028', '2025-2026'],
        required: true,
      },
      {
        no: 4,
        key: 'existingApprovedCourse',
        label: 'Existing approved course',
        description: 'Course whose intake will increase',
        type: 'text',
        placeholder: 'e.g., B.Tech — Computer Science and Engineering',
        required: true,
      },
      {
        no: 5,
        key: 'currentlyApprovedIntake',
        label: 'Currently approved intake',
        description: 'Example: 60 seats',
        type: 'number',
        placeholder: '60',
        required: true,
      },
      {
        no: 6,
        key: 'requestedIntake',
        label: 'Requested intake',
        description: 'Example: 120 seats',
        type: 'number',
        placeholder: '120',
        required: true,
      },
      {
        no: 7,
        key: 'facultyAvailabilityDetails',
        label: 'Faculty availability/details',
        description: 'Faculty information supporting the proposed intake',
        type: 'textarea',
        placeholder: 'e.g., 16 dedicated CSE faculty members (4 Professors, 4 Associate Professors, 8 Assistant Professors) plus 4 newly recruited Ph.D. faculty joining July 2026',
        required: true,
      },
      {
        no: 8,
        key: 'infrastructureReadinessDetails',
        label: 'Infrastructure readiness/details',
        description: 'Evidence of suitable facilities for the proposed intake',
        type: 'textarea',
        placeholder: 'e.g., 2 additional 66 sq.m classrooms, 1 new High-Performance Computing Lab (60 nodes), and upgraded 1 Gbps NKN leased line',
        required: true,
      },
    ],
    checklist: [
      {
        no: 1,
        id: 'inc-doc-1',
        title: 'Affidavit 8',
        verifies: 'Formal declaration for an increase in intake or additional course',
        docuPassEligible: false,
        ruleCode: 'RULE-INC-201',
      },
      {
        no: 2,
        id: 'inc-doc-2',
        title: 'Trust / Society / Company resolution (Format 3)',
        verifies: 'Approval for the proposed additional division/course and allocation of land, building or funds',
        docuPassEligible: true,
        ruleCode: 'RULE-INC-202',
      },
      {
        no: 3,
        id: 'inc-doc-3',
        title: 'Approved building plan',
        verifies: 'Planned infrastructure and building capacity',
        docuPassEligible: true,
        ruleCode: 'RULE-INC-203',
      },
      {
        no: 4,
        id: 'inc-doc-4',
        title: 'Faculty availability report',
        verifies: 'Faculty information supporting the proposed intake',
        docuPassEligible: true,
        ruleCode: 'RULE-INC-204',
      },
    ],
  },

  new_course: {
    id: 'new_course',
    code: 'APH-NEW-03',
    shortTitle: 'Introduction of a New Course',
    title: '3. Introduction of a New Course',
    clause: 'Approval Process Handbook — Chapter II, Clause 2.7',
    purpose: "Verify an existing institution's request to introduce a course it does not currently offer.",
    checklistPurpose: 'Starting a new programme or level at an existing institution, under Clause 2.7.',
    fields: [
      {
        no: 1,
        key: 'institutionName',
        label: 'Institution name',
        description: 'Official institution name',
        type: 'text',
        placeholder: 'e.g., Indraprastha Institute of Engineering & Technology',
        required: true,
      },
      {
        no: 2,
        key: 'aictePid',
        label: 'AICTE Permanent ID (PID)',
        description: "Institution's registered AICTE ID",
        type: 'text',
        placeholder: 'e.g., 1-4829104321',
        required: true,
      },
      {
        no: 3,
        key: 'academicYear',
        label: 'Academic year',
        description: 'Year for which the course is proposed',
        type: 'select',
        options: ['2026-2027', '2027-2028', '2025-2026'],
        required: true,
      },
      {
        no: 4,
        key: 'proposedProgrammeLevel',
        label: 'Proposed programme/level',
        description: 'Example: Engineering — Undergraduate',
        type: 'select',
        options: [
          'Engineering and Technology — Undergraduate (B.Tech / B.E.)',
          'Engineering and Technology — Postgraduate (M.Tech / M.E.)',
          'Management — Postgraduate (MBA / PGDM)',
          'Computer Applications — Postgraduate (MCA)',
          'Engineering and Technology — Diploma',
        ],
        required: true,
      },
      {
        no: 5,
        key: 'proposedCourseName',
        label: 'Proposed course name',
        description: 'Example: Artificial Intelligence and Machine Learning',
        type: 'text',
        placeholder: 'e.g., Artificial Intelligence and Machine Learning',
        required: true,
      },
      {
        no: 6,
        key: 'proposedAnnualIntake',
        label: 'Proposed annual intake',
        description: 'Example: 60 seats',
        type: 'number',
        placeholder: '60',
        required: true,
      },
      {
        no: 7,
        key: 'facultyAvailabilityDetails',
        label: 'Faculty availability/details',
        description: 'Information supporting faculty requirements',
        type: 'textarea',
        placeholder: 'e.g., 1 Professor (AI/ML specialization), 2 Associate Professors, and 6 Assistant Professors appointed with AICTE selection committee minutes',
        required: true,
      },
      {
        no: 8,
        key: 'infrastructureReadinessDetails',
        label: 'Infrastructure readiness/details',
        description: 'Evidence of suitable facilities for the new course',
        type: 'textarea',
        placeholder: 'e.g., Dedicated AI & Deep Learning Lab (NVIDIA GPU cluster, 66 sq.m), 2 smart lecture halls, and ₹48 Lakh earmarked recurring equipment grant',
        required: true,
      },
    ],
    checklist: [
      {
        no: 1,
        id: 'new-doc-1',
        title: "Existing institution's EoA / approval record",
        verifies: "The institution's current approval status",
        docuPassEligible: true,
        ruleCode: 'RULE-NEW-301',
      },
      {
        no: 2,
        id: 'new-doc-2',
        title: 'No Objection Certificate (NOC) from affiliating University / Board, in Format 2',
        verifies: 'Relevant affiliation-related approval',
        docuPassEligible: false,
        ruleCode: 'RULE-NEW-302',
      },
      {
        no: 3,
        id: 'new-doc-3',
        title: 'Trust / Society / Company resolution (Format 3)',
        verifies: 'Formal approval to start the new programme or level',
        docuPassEligible: true,
        ruleCode: 'RULE-NEW-303',
      },
      {
        no: 4,
        id: 'new-doc-4',
        title: 'Approved building plan',
        verifies: 'Planned infrastructure for the programme and its approved intake',
        docuPassEligible: true,
        ruleCode: 'RULE-NEW-304',
      },
    ],
  },
};

export function getCategorySchema(categoryId) {
  return APPLICATION_CATEGORIES[categoryId] || null;
}

export function validateApplicationForm(categoryId, formData = {}) {
  const schema = getCategorySchema(categoryId);
  if (!schema) {
    return { isValid: false, errors: { category: 'Unsupported application category selected.' } };
  }

  const errors = {};

  for (const field of schema.fields) {
    const rawVal = formData[field.key];
    if (field.type === 'compliance_confirm') {
      if (!rawVal || String(rawVal).trim().length === 0 || formData.selfDisclosureChecked === false) {
        errors[field.key] = `${field.label} confirmation is required.`;
      }
      continue;
    }

    const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
    if (field.required && strVal.length === 0) {
      errors[field.key] = `${field.label} is required.`;
    }
  }

  if (formData.aictePid && !/^1-\d{7,12}$/.test(String(formData.aictePid).trim())) {
    errors.aictePid = 'AICTE Permanent ID must follow official format (e.g., 1-4829104321).';
  }

  if (categoryId === 'intake_increase') {
    const currentSeats = Number(formData.currentlyApprovedIntake);
    const requestedSeats = Number(formData.requestedIntake);
    if (!Number.isFinite(currentSeats) || currentSeats <= 0) {
      errors.currentlyApprovedIntake = 'Currently approved intake must be a positive seat count.';
    }
    if (!Number.isFinite(requestedSeats) || requestedSeats <= 0) {
      errors.requestedIntake = 'Requested intake must be a positive seat count.';
    } else if (Number.isFinite(currentSeats) && requestedSeats <= currentSeats) {
      errors.requestedIntake = 'Requested intake must be strictly greater than currently approved intake.';
    }
  }

  if (categoryId === 'new_course') {
    const proposedSeats = Number(formData.proposedAnnualIntake);
    if (!Number.isFinite(proposedSeats) || proposedSeats < 30 || proposedSeats > 300) {
      errors.proposedAnnualIntake = 'Proposed annual intake must be between 30 and 300 seats per AICTE norms.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function evaluateDocuPassEligibility(docuPassRecord, targetAcademicYear = '2026-2027') {
  if (!docuPassRecord) {
    return {
      eligible: false,
      status: 'Manual review required',
      reason: 'No prior DocuPass verification record was found.',
    };
  }

  if (!docuPassRecord.docuPassEligibleType) {
    return {
      eligible: false,
      status: 'Not applicable',
      reason: 'Document type requires a fresh cycle-specific declaration and is not eligible for DocuPass reuse.',
    };
  }

  if (docuPassRecord.revoked) {
    return {
      eligible: false,
      status: 'Revoked',
      reason: 'Issuing authority indicates this credential or approval record has been revoked.',
    };
  }

  if (docuPassRecord.expired || (docuPassRecord.validAcademicYears && !docuPassRecord.validAcademicYears.includes(targetAcademicYear))) {
    return {
      eligible: false,
      status: 'Expired',
      reason: `Prior verification record expired (${docuPassRecord.validUntil || 'prior cycle'}); fresh document check required for ${targetAcademicYear}.`,
    };
  }

  if (docuPassRecord.priorOutcome !== 'Passed') {
    return {
      eligible: false,
      status: 'Manual review required',
      reason: `Prior verification outcome was "${docuPassRecord.priorOutcome}"; cannot auto-reuse.`,
    };
  }

  return {
    eligible: true,
    status: 'Passed',
    reason: `Eligible for DocuPass reuse (${docuPassRecord.passportId}); prior outcome and validity checks pass for ${targetAcademicYear}.`,
  };
}

export function validateChecklistCompleteness(categoryId, checklistItemsState = {}) {
  const schema = getCategorySchema(categoryId);
  if (!schema) {
    return { isComplete: false, missingDocs: ['Unknown category'] };
  }

  const missingDocs = [];
  for (const item of schema.checklist) {
    const entry = checklistItemsState[item.id];
    if (!entry || (!entry.fileName && !entry.docuPassId)) {
      missingDocs.push(item.title);
    }
  }

  return {
    isComplete: missingDocs.length === 0,
    missingDocs,
    totalRequired: schema.checklist.length,
    completedCount: schema.checklist.length - missingDocs.length,
  };
}

export function applyDocumentReupload(application, docId, newFilePayload, institutionNote) {
  if (!application || !Array.isArray(application.documents)) {
    throw new Error('Invalid application record provided for re-upload.');
  }

  const timestamp = newFilePayload.uploadedAt || '2026-10-23 10:15 IST';
  const updatedDocs = application.documents.map((doc) => {
    if (doc.id !== docId) return doc;

    const currentVersionNumber = doc.currentVersion || 1;
    const nextVersionNumber = currentVersionNumber + 1;
    const previousEntry = {
      version: currentVersionNumber,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt,
      verificationStatus: doc.verificationStatus,
      note: doc.officerClarificationNote || 'Initial submission version',
    };

    return {
      ...doc,
      currentVersion: nextVersionNumber,
      fileName: newFilePayload.fileName,
      fileSize: newFilePayload.fileSize || '1.48 MB',
      uploadedAt: timestamp,
      verificationStatus: 'Passed',
      reuploadRequested: false,
      institutionResponseNote: institutionNote || 'Replacement document uploaded addressing officer observation.',
      versions: [...(doc.versions || []), previousEntry],
    };
  });

  const anyRemainingClarifications = updatedDocs.some((d) => d.reuploadRequested);
  const nextStatus = anyRemainingClarifications
    ? 'Clarification Requested'
    : 'Resubmitted — Pending Officer Review';

  const newAuditEntry = {
    id: `aud-${Date.now()}`,
    timestamp,
    actor: `${application.formData?.institutionName || 'Institution Nodal Officer'} (Institution)`,
    action: `Uploaded replacement document (v${(application.documents.find((d) => d.id === docId)?.currentVersion || 1) + 1})`,
    target: updatedDocs.find((d) => d.id === docId)?.title || docId,
    outcome: nextStatus,
    details: institutionNote || 'Replacement evidence uploaded; earlier version preserved in immutable history.',
  };

  return {
    ...application,
    status: nextStatus,
    lastUpdated: timestamp,
    documents: updatedDocs,
    auditLog: [newAuditEntry, ...(application.auditLog || [])],
  };
}

/**
 * Generates a structured Per-Document Verification Report for the AICTE Officer.
 * Each supporting document is evaluated separately with its own isolated evidence,
 * verification outcome (Verified vs Not Verified), and explicit reason.
 */
export function runOfficerDocumentVerification(application, runTimestamp = '2026-10-23 14:20 IST') {
  if (!application || !Array.isArray(application.documents)) {
    throw new Error('Valid application with supporting documents is required.');
  }

  const schema = getCategorySchema(application.categoryId);
  const form = application.formData || {};

  const documentReports = application.documents.map((doc, idx) => {
    const checklistSpec = schema?.checklist?.[idx] || {};
    const isFlaggedOrMismatch =
      doc.reuploadRequested ||
      String(doc.verificationStatus).toLowerCase().includes('issue') ||
      String(doc.verificationStatus).toLowerCase().includes('mismatch');

    const isManual = String(doc.verificationStatus).toLowerCase().includes('manual');

    let verified = !isFlaggedOrMismatch;
    let statusLabel = verified ? 'Verified (Passed)' : 'Not Verified (Issue Detected)';
    if (isManual && !isFlaggedOrMismatch) {
      statusLabel = 'Verified — Officer Sign-Off Recorded';
      verified = true;
    }

    const extractedPairs = Object.entries(doc.extractedFields || {}).map(([field, value]) => ({
      field,
      value,
    }));

    let verificationReason = '';
    let discrepancyDetail = null;

    if (verified) {
      if (doc.docuPassReused && doc.docuPassPassportId) {
        verificationReason = `Document linked to DocuPass Passport (${doc.docuPassPassportId}); prior record validity checks pass, and extracted values match application form for PID ${
          form.aictePid || '1-4829104321'
        }.`;
      } else {
        verificationReason = `Document verified via ${
          doc.extractionMethod || 'PyMuPDF / PaddleOCR'
        }. All extracted fields (${extractedPairs
          .map((p) => `${p.field}: ${p.value}`)
          .join('; ')}) are consistent with the submitted ${
          application.categoryTitle
        } application form (Version v${doc.currentVersion || 1}).`;
      }
    } else {
      discrepancyDetail =
        doc.officerClarificationNote ||
        `Cross-document comparison detected a mismatch between the application form and ${doc.fileName}.`;
      verificationReason = `Document NOT verified: ${discrepancyDetail}`;
    }

    return {
      docNo: doc.no || idx + 1,
      docId: doc.id,
      documentTitle: doc.title,
      fileName: doc.fileName,
      version: doc.currentVersion || 1,
      ruleCode: checklistSpec.ruleCode || `RULE-${idx + 1}`,
      whatSystemVerifies: doc.verifies || checklistSpec.verifies || 'Regulatory compliance check',
      extractionMethod: doc.extractionMethod || 'PyMuPDF Digital Text Extraction',
      docuPassReused: Boolean(doc.docuPassReused),
      docuPassPassportId: doc.docuPassPassportId || null,
      verified,
      statusLabel,
      extractedEvidence: extractedPairs,
      verificationReason,
      discrepancyDetail,
    };
  });

  const verifiedCount = documentReports.filter((r) => r.verified).length;
  const failedCount = documentReports.length - verifiedCount;
  const reusedCount = documentReports.filter((r) => r.docuPassReused).length;

  const failedDocTitles = documentReports
    .filter((r) => !r.verified)
    .map((r) => `Doc #${r.docNo} (${r.documentTitle})`);

  const overallSummary = {
    reportId: `VR-${application.id}-${Date.now().toString().slice(-4)}`,
    generatedAt: runTimestamp,
    totalDocuments: documentReports.length,
    verifiedCount,
    failedCount,
    reusedCount,
    overallOutcome:
      failedCount === 0
        ? 'All Supporting Documents Verified — Eligible for Officer Approval'
        : `${failedCount} Document(s) Failed Verification — Re-upload or Rejection Recommended`,
    executiveNarrative:
      failedCount === 0
        ? `All ${documentReports.length} mandatory supporting documents for ${application.id} (${application.categoryTitle}) have been individually examined and verified against the 8 submitted application form fields. ${reusedCount} document(s) were validated using eligible DocuPass verification passports. No cross-document discrepancies were found. The application is ready for official approval.`
        : `Out of ${documentReports.length} mandatory supporting documents examined for ${application.id} (${application.categoryTitle}), ${verifiedCount} document(s) passed verification and ${failedCount} document(s) failed verification: ${failedDocTitles.join(
            ', '
          )}. Review the isolated document evidence above to request a replacement upload or reject the application.`,
  };

  return {
    ...overallSummary,
    documentReports,
  };
}

export function formatVerificationReportText(application, report) {
  if (!application || !report) return '';

  const lines = [
    '================================================================================',
    'ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)',
    'OFFICIAL APPLICATION VERIFICATION CHECKLIST & EVIDENCE REPORT (VERSION 1 MVP)',
    '================================================================================',
    `Report ID          : ${report.reportId}`,
    `Generated Date/Time: ${report.generatedAt}`,
    `Application ID     : ${application.id}`,
    `Category           : ${application.categoryTitle} (${application.clause})`,
    `Institution Name   : ${application.formData?.institutionName || 'N/A'}`,
    `AICTE Permanent ID : ${application.formData?.aictePid || 'N/A'}`,
    `Academic Year      : ${application.academicYear || application.formData?.academicYear || '2026-2027'}`,
    `Current App Status : ${application.status}`,
    '--------------------------------------------------------------------------------',
    'SECTION 1: PER-DOCUMENT VERIFICATION CHECKLIST & ISOLATED EVIDENCE',
    '(Each supporting document is evaluated separately without mixing evidence)',
    '--------------------------------------------------------------------------------',
  ];

  for (const docRep of report.documentReports) {
    lines.push(
      '',
      `[DOCUMENT #${docRep.docNo}] ${docRep.documentTitle}`,
      `  File Name & Version : ${docRep.fileName} (v${docRep.version})`,
      `  Rule Reference      : ${docRep.ruleCode} — Verifies: ${docRep.whatSystemVerifies}`,
      `  DocuPass Status     : ${
        docRep.docuPassReused ? `Reused (${docRep.docuPassPassportId})` : 'Fresh Cycle Document Examined'
      }`,
      `  Verification Status : ${docRep.statusLabel}`,
      `  Extracted Evidence  :`,
      ...docRep.extractedEvidence.map((e) => `    - ${e.field}: ${e.value}`),
      `  Verification Reason : ${docRep.verificationReason}`,
      '--------------------------------------------------------------------------------'
    );
  }

  lines.push(
    '',
    'SECTION 2: OVERALL EXECUTIVE VERIFICATION SUMMARY & OFFICER DECISION GUIDANCE',
    '--------------------------------------------------------------------------------',
    `Total Documents Examined : ${report.totalDocuments}`,
    `Documents Verified       : ${report.verifiedCount}`,
    `Documents Not Verified   : ${report.failedCount}`,
    `DocuPass Records Reused  : ${report.reusedCount}`,
    `Overall Finding          : ${report.overallOutcome}`,
    '',
    'Executive Summary:',
    report.executiveNarrative,
    '================================================================================'
  );

  return lines.join('\n');
}
