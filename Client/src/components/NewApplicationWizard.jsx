import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  FileText,
  KeyRound,
} from 'lucide-react';
import {
  APPLICATION_CATEGORIES,
  getCategorySchema,
  validateApplicationForm,
  validateChecklistCompleteness,
  evaluateDocuPassEligibility,
} from '../utils/aicteLogic.js';
import { SAMPLE_CATEGORY_PREFILLS } from '../data/seedApplications.js';
import { StatusText } from './AicteEmblem.jsx';

export default function NewApplicationWizard({
  initialCategoryId = 'eoa',
  docuPassVault,
  onCancel,
  onSubmitApplication,
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || 'eoa');
  const [step, setStep] = useState(1); // 1 = Application Form (8 fields), 2 = Supporting Document Checklist (4 docs)
  const [formData, setFormData] = useState(() => ({
    ...SAMPLE_CATEGORY_PREFILLS[initialCategoryId || 'eoa'],
  }));
  const [formErrors, setFormErrors] = useState({});
  const [checklistState, setChecklistState] = useState({});
  const [checklistError, setChecklistError] = useState('');

  const schema = getCategorySchema(selectedCategoryId);

  const handleCategorySwitch = (nextCategoryId) => {
    setSelectedCategoryId(nextCategoryId);
    setFormData({ ...SAMPLE_CATEGORY_PREFILLS[nextCategoryId] });
    setFormErrors({});
    setChecklistState({});
    setChecklistError('');
    setStep(1);
  };

  const handleFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleClearForm = () => {
    const empty = {
      institutionName: '',
      aictePid: '',
      academicYear: '2026-2027',
      selfDisclosureChecked: false,
    };
    setFormData(empty);
    setFormErrors({});
  };

  const handlePrefillSample = () => {
    setFormData({ ...SAMPLE_CATEGORY_PREFILLS[selectedCategoryId] });
    setFormErrors({});
  };

  const handleProceedToChecklist = (e) => {
    e.preventDefault();
    const validation = validateApplicationForm(selectedCategoryId, formData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});
    setStep(2);
  };

  // Attach a new file (via file input or simulated sample PDF upload)
  const handleUploadChecklistFile = (checklistItem, customFileName) => {
    const generatedName =
      customFileName ||
      `${checklistItem.title.replace(/[^a-zA-Z0-9]+/g, '_')}_AY2026_27_Signed.pdf`;
    setChecklistState((prev) => ({
      ...prev,
      [checklistItem.id]: {
        mode: 'upload',
        fileName: generatedName,
        fileSize: '1.34 MB',
        uploadedAt: '2026-10-23 11:10 IST',
        extractionMethod: checklistItem.docuPassEligible
          ? 'PyMuPDF Digital Text Extraction'
          : 'PaddleOCR v2.7 Document Review',
        verificationStatus: 'Passed',
        docuPassReused: false,
        docuPassPassportId: null,
      },
    }));
    setChecklistError('');
  };

  // Reuse an eligible DocuPass record from the institution's vault
  const handleReuseDocuPass = (checklistItem, vaultRecord) => {
    const evalResult = evaluateDocuPassEligibility(vaultRecord, formData.academicYear || '2026-2027');
    setChecklistState((prev) => ({
      ...prev,
      [checklistItem.id]: {
        mode: 'docupass',
        fileName: vaultRecord.fileName,
        fileSize: vaultRecord.fileSize,
        uploadedAt: '2026-10-23 11:12 IST (Reused via DocuPass)',
        extractionMethod: 'DocuPass Prior Review & Validity Check',
        verificationStatus: evalResult.status,
        docuPassId: vaultRecord.passportId,
        docuPassReused: evalResult.eligible,
        docuPassPassportId: vaultRecord.passportId,
        docuPassReason: evalResult.reason,
      },
    }));
    setChecklistError('');
  };

  const handleAttachAllChecklistDefaults = () => {
    const nextState = {};
    for (const item of schema.checklist) {
      const matchingVault = docuPassVault.find(
        (v) =>
          item.docuPassEligible &&
          v.matchingChecklistTitles.some((t) => t.toLowerCase() === item.title.toLowerCase())
      );
      if (matchingVault) {
        const evalResult = evaluateDocuPassEligibility(
          matchingVault,
          formData.academicYear || '2026-2027'
        );
        nextState[item.id] = {
          mode: 'docupass',
          fileName: matchingVault.fileName,
          fileSize: matchingVault.fileSize,
          uploadedAt: '2026-10-23 11:12 IST (Reused via DocuPass)',
          extractionMethod: 'DocuPass Prior Review & Validity Check',
          verificationStatus: evalResult.status,
          docuPassId: matchingVault.passportId,
          docuPassReused: evalResult.eligible,
          docuPassPassportId: matchingVault.passportId,
          docuPassReason: evalResult.reason,
        };
      } else {
        const fname = `${item.title.replace(/[^a-zA-Z0-9]+/g, '_')}_AY2026_27.pdf`;
        nextState[item.id] = {
          mode: 'upload',
          fileName: fname,
          fileSize: '1.18 MB',
          uploadedAt: '2026-10-23 11:12 IST',
          extractionMethod: 'PaddleOCR v2.7 Document Review',
          verificationStatus: 'Passed',
          docuPassReused: false,
          docuPassPassportId: null,
        };
      }
    }
    setChecklistState(nextState);
    setChecklistError('');
  };

  const handleFinalSubmit = () => {
    const check = validateChecklistCompleteness(selectedCategoryId, checklistState);
    if (!check.isComplete) {
      setChecklistError(
        `Please upload or link all required supporting documents before submitting. Missing: ${check.missingDocs.join(
          ', '
        )}`
      );
      return;
    }

    const prefix =
      selectedCategoryId === 'eoa'
        ? 'EOA'
        : selectedCategoryId === 'intake_increase'
        ? 'INC'
        : 'NEW';
    const newAppId = `AICTE-2026-${prefix}-${Math.floor(5000 + Math.random() * 3999)}`;

    let summaryHeadline = '';
    if (selectedCategoryId === 'eoa') {
      summaryHeadline = `Extension of Approval (${formData.academicYear}) — ${String(
        formData.existingProgrammes || ''
      ).slice(0, 62)}...`;
    } else if (selectedCategoryId === 'intake_increase') {
      summaryHeadline = `${formData.existingApprovedCourse} (${formData.currentlyApprovedIntake} → ${formData.requestedIntake} Seats)`;
    } else {
      summaryHeadline = `New Course: ${formData.proposedCourseName} (${formData.proposedAnnualIntake} Seats)`;
    }

    const builtDocuments = schema.checklist.map((item) => {
      const attached = checklistState[item.id];
      return {
        no: item.no,
        id: item.id,
        title: item.title,
        verifies: item.verifies,
        currentVersion: 1,
        fileName: attached.fileName,
        fileSize: attached.fileSize,
        uploadedAt: attached.uploadedAt,
        extractionMethod: attached.extractionMethod,
        verificationStatus: attached.verificationStatus || 'Passed',
        docuPassReused: Boolean(attached.docuPassReused),
        docuPassPassportId: attached.docuPassPassportId || null,
        reuploadRequested: false,
        officerClarificationNote: null,
        extractedFields: {
          'Institution Name': formData.institutionName,
          'AICTE PID': formData.aictePid,
          'Target Academic Year': formData.academicYear,
          'Rule Verification Scope': item.verifies,
        },
        versions: [],
      };
    });

    const reusedCount = builtDocuments.filter((d) => d.docuPassReused).length;

    const builtFindings = schema.checklist.map((item, idx) => {
      const doc = builtDocuments[idx];
      return {
        id: `vf-new-${idx + 1}`,
        ruleCode: item.ruleCode,
        checkName: `${item.title} — ${item.verifies}`,
        documentRef: doc.docuPassPassportId
          ? `${doc.title} (DocuPass ${doc.docuPassPassportId})`
          : `${doc.title} (v1)`,
        status: doc.verificationStatus,
        evidence: doc.docuPassReused
          ? `Prior review and current-status checks for Passport ${doc.docuPassPassportId} are valid for ${formData.academicYear}.`
          : `Extracted fields from ${doc.fileName} match application form values for PID ${formData.aictePid}.`,
        manualReviewRequired: !doc.docuPassReused,
      };
    });

    const newApplication = {
      id: newAppId,
      categoryId: selectedCategoryId,
      categoryTitle: schema.shortTitle,
      clause: schema.clause,
      submittedAt: '2026-10-23 11:15 IST',
      lastUpdated: '2026-10-23 11:15 IST',
      academicYear: formData.academicYear,
      status: 'Under Officer Scrutiny',
      assignedOfficer: 'Shri Vikramaditya Sen, IAS (NRO Scrutiny Chair)',
      summaryHeadline,
      docuPassReusedCount: reusedCount,
      formData: { ...formData },
      documents: builtDocuments,
      verificationFindings: builtFindings,
      auditLog: [
        {
          id: `aud-${Date.now()}-2`,
          timestamp: '2026-10-23 11:15 IST',
          actor: 'AICTE Verification & DocuPass Engine v1.0',
          action: `Executed Automated Verification & DocuPass Evaluation`,
          target: `${builtDocuments.length} Supporting Documents`,
          outcome: `${builtDocuments.length} Passed (${reusedCount} DocuPass Reused) · Routed to Officer Queue`,
          details: `All 8 form fields cross-checked against 4 supporting documents for ${schema.shortTitle}.`,
        },
        {
          id: `aud-${Date.now()}-1`,
          timestamp: '2026-10-23 11:15 IST',
          actor: `${formData.institutionName} (Institution)`,
          action: `Submitted ${schema.shortTitle} Application`,
          target: newAppId,
          outcome: 'Submitted — Under Officer Scrutiny',
          details: `Completed 8 category-specific fields and attached all 4 checklist documents.`,
        },
      ],
    };

    onSubmitApplication(newApplication);
  };

  const completeness = validateChecklistCompleteness(selectedCategoryId, checklistState);

  return (
    <div className="space-y-6">
      {/* Top Wizard Header & Step Indicator */}
      <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={onCancel}
                className="text-blue-900 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Dashboard</span>
              </button>
              <span aria-hidden="true">/</span>
              <span>New Approval Application</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">{schema.shortTitle}</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-950 font-display">
              {schema.title}
            </h1>
            <p className="text-xs text-slate-600">
              {schema.purpose} · <span className="font-mono text-slate-500">{schema.clause}</span>
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                step === 1
                  ? 'bg-blue-950 text-white'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              1. Application Form (8 Fields)
            </button>
            <ArrowRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                const v = validateApplicationForm(selectedCategoryId, formData);
                if (v.isValid) setStep(2);
                else setFormErrors(v.errors);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                step === 2
                  ? 'bg-blue-950 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Supporting Document Checklist (4 Docs)
            </button>
          </div>
        </div>

        {/* Category Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-700">
            Select Approval Category (MVP Phase 1):
          </span>
          <div
            role="tablist"
            aria-label="Select Application Category"
            className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            {Object.values(APPLICATION_CATEGORIES).map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleCategorySwitch(cat.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-blue-950 text-white'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  {cat.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* STEP 1: 8-Field Category-Specific Application Form */}
      {step === 1 && (
        <form
          onSubmit={handleProceedToChecklist}
          className="border border-slate-200 rounded-xl bg-white overflow-hidden"
          noValidate
        >
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950 font-display">
                Step 1: Complete {schema.shortTitle} Application Form
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                All 8 official fields below are cross-checked against your uploaded supporting documents in Step 2.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrefillSample}
                className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Fill Official Sample Data
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Clear Fields
              </button>
            </div>
          </div>

          {Object.keys(formErrors).length > 0 && (
            <div
              role="alert"
              className="mx-6 mt-5 p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1"
            >
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Please resolve the following validation errors before proceeding to the checklist:</span>
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {Object.values(formErrors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-6 divide-y divide-slate-200">
            {schema.fields.map((field) => {
              const inputId = `field-${selectedCategoryId}-${field.key}`;
              const fieldError = formErrors[field.key];
              return (
                <div
                  key={field.key}
                  className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
                >
                  <div className="lg:col-span-4 space-y-1">
                    <label
                      htmlFor={inputId}
                      className="text-xs font-bold text-slate-900 flex items-baseline gap-2"
                    >
                      <span className="font-mono tabular-nums text-slate-500">No. {field.no}</span>
                      <span>{field.label}</span>
                    </label>
                    <p className="text-xs text-slate-500 pl-9">{field.description}</p>
                  </div>

                  <div className="lg:col-span-8 space-y-1.5">
                    {field.type === 'select' && (
                      <select
                        id={inputId}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                      >
                        <option value="">Select {field.label}...</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        id={inputId}
                        rows={2}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    )}

                    {(field.type === 'text' || field.type === 'number') && (
                      <input
                        id={inputId}
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 ${
                          field.key === 'aictePid' || field.type === 'number' ? 'font-mono tabular-nums' : ''
                        }`}
                      />
                    )}

                    {field.type === 'file_ref' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id={inputId}
                          type="text"
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="flex-1 px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                        <label className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                          <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Browse PDF</span>
                          <input
                            type="file"
                            accept=".pdf"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFieldChange(
                                  field.key,
                                  `${file.name} (Uploaded — ${(file.size / 1024).toFixed(0)} KB)`
                                );
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {field.type === 'compliance_confirm' && (
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                        <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.selfDisclosureChecked !== false}
                            onChange={(e) => {
                              handleFieldChange('selfDisclosureChecked', e.target.checked);
                              if (e.target.checked && !formData[field.key]) {
                                handleFieldChange(
                                  field.key,
                                  'Confirmed that applicable AICTE Approval Process Handbook requirements are met with zero deficiency.'
                                );
                              }
                            }}
                            className="mt-0.5 rounded border-slate-300 text-blue-950 focus:ring-blue-900"
                          />
                          <span>
                            I hereby affirm as Head of Institution / Principal Nodal Officer that all applicable AICTE
                            norms, faculty cadre ratios, and infrastructure requirements are satisfied.
                          </span>
                        </label>
                        <input
                          id={inputId}
                          type="text"
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>
                    )}

                    {fieldError && <p className="text-xs font-medium text-red-600">{fieldError}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <span>Save &amp; Continue to Supporting Document Checklist</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: 4-Document Supporting Checklist & DocuPass Matcher */}
      {step === 2 && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-950 font-display">
                Step 2: Supporting Document Checklist — {schema.shortTitle}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">{schema.checklistPurpose}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono tabular-nums text-slate-600">
                Attached: {completeness.completedCount} / {completeness.totalRequired}
              </span>
              <button
                type="button"
                onClick={handleAttachAllChecklistDefaults}
                className="px-3.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Auto-Attach All 4 Supporting Documents (With DocuPass Match)
              </button>
            </div>
          </div>

          {checklistError && (
            <div
              role="alert"
              className="mx-6 mt-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>{checklistError}</span>
            </div>
          )}

          {/* Checklist Table matching user's exact specification */}
          <div className="divide-y divide-slate-200">
            {schema.checklist.map((item) => {
              const attached = checklistState[item.id];
              const eligibleVaultRecord = docuPassVault.find(
                (v) =>
                  item.docuPassEligible &&
                  v.matchingChecklistTitles.some((t) => t.toLowerCase() === item.title.toLowerCase())
              );

              return (
                <div key={item.id} className="p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">No. {item.no}</span>
                        <h3 className="text-sm font-bold text-slate-950">{item.title}</h3>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-xs font-mono text-slate-500">{item.ruleCode}</span>
                      </div>

                      <p className="text-xs text-slate-600">
                        <strong className="font-semibold text-slate-800">What the system verifies:</strong>{' '}
                        {item.verifies}
                      </p>

                      {item.docuPassEligible ? (
                        <p className="text-xs text-blue-900">
                          DocuPass Eligible: Can reuse a prior review record if current-status and{' '}
                          {formData.academicYear} validity checks pass.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Cycle-Specific Sworn / Affiliation Document: Requires fresh upload for{' '}
                          {formData.academicYear} (DocuPass reuse not applicable).
                        </p>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {eligibleVaultRecord && (
                        <button
                          type="button"
                          onClick={() => handleReuseDocuPass(item, eligibleVaultRecord)}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            attached?.mode === 'docupass'
                              ? 'bg-blue-950 text-white border-blue-950'
                              : 'bg-white text-blue-950 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {attached?.mode === 'docupass' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>Reuse DocuPass ({eligibleVaultRecord.passportId})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleUploadChecklistFile(item)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          attached?.mode === 'upload'
                            ? 'bg-blue-950 text-white border-blue-950'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {attached?.mode === 'upload' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                        ) : (
                          <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>Upload Fresh PDF</span>
                      </button>

                      <label className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer">
                        <span>Choose Local File</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadChecklistFile(item, f.name);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Attached File / DocuPass Verification Summary */}
                  {attached && (
                    <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-900 shrink-0" aria-hidden="true" />
                          <span className="font-semibold text-slate-900">{attached.fileName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-600">{attached.fileSize}</span>
                          {attached.docuPassPassportId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono font-semibold text-blue-900">
                                DocuPass: {attached.docuPassPassportId}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-slate-500">
                          {attached.extractionMethod}
                        </p>
                        {attached.docuPassReason && (
                          <p className="text-slate-600">{attached.docuPassReason}</p>
                        )}
                      </div>

                      <div className="shrink-0">
                        <StatusText status={attached.verificationStatus} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Step 1 (Application Form)</span>
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Submit Application to AICTE Officer for Approval</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
