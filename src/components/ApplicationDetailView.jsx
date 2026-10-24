import React, { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  FileUp,
  History,
  ShieldCheck,
  AlertTriangle,
  Eye,
  CheckCircle2,
  X,
  ClipboardList,
  PlayCircle,
  Download,
  XCircle,
  RotateCcw,
  FileCheck2,
} from 'lucide-react';
import {
  getCategorySchema,
  runOfficerDocumentVerification,
  formatVerificationReportText,
} from '../utils/aicteLogic.js';
import { createPdfBytes } from '../utils/pdfExport.js';
import { StatusText } from './AicteEmblem.jsx';

export default function ApplicationDetailView({
  application,
  userRole = 'institution',
  onBack,
  onReuploadDocument,
  onOfficerAction,
  onRunVerificationAnalysis,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // overview | report | findings | audit
  const [previewDoc, setPreviewDoc] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reuploadNotes, setReuploadNotes] = useState({});
  const [reuploadFiles, setReuploadFiles] = useState({});
  const [officerComment, setOfficerComment] = useState('');
  const [selectedDocForFlag, setSelectedDocForFlag] = useState(
    application?.documents?.[0]?.id || ''
  );

  if (!application) return null;

  const schema = getCategorySchema(application.categoryId);
  const flaggedDocs = (application.documents || []).filter((d) => d.reuploadRequested);

  // Either use stored verificationReport or allow generating on demand
  const verificationReport = application.verificationReport || null;

  const handleStartVerificationAnalysis = () => {
    const nowStr = '2026-10-23 14:35 IST';
    const generatedReport = runOfficerDocumentVerification(application, nowStr);
    if (onRunVerificationAnalysis) {
      onRunVerificationAnalysis(application.id, generatedReport, nowStr);
    }
    setActiveTab('report');
  };

  const handleDownloadReport = () => {
    const reportToExport =
      verificationReport || runOfficerDocumentVerification(application, '2026-10-23 14:35 IST');
    const textContent = formatVerificationReportText(application, reportToExport);
    const blob = new Blob([createPdfBytes(textContent)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AICTE_Verification_Report_${application.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleTriggerReupload = (doc) => {
    const chosenFileName =
      reuploadFiles[doc.id] ||
      `${doc.title.replace(/[^a-zA-Z0-9]+/g, '_')}_v${(doc.currentVersion || 1) + 1}_Corrected.pdf`;
    const note =
      reuploadNotes[doc.id] ||
      `Uploaded corrected replacement v${(doc.currentVersion || 1) + 1} addressing scrutiny officer observation.`;

    onReuploadDocument(
      application.id,
      doc.id,
      {
        fileName: chosenFileName,
        fileSize: '1.28 MB',
        uploadedAt: '2026-10-23 14:40 IST',
      },
      note
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Dossier Header */}
      <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={onBack}
                className="text-blue-900 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Applications</span>
              </button>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-slate-900">{application.id}</span>
              <span aria-hidden="true">·</span>
              <span>{application.clause}</span>
            </div>

            <h1 className="text-xl lg:text-2xl font-bold text-slate-950 font-display">
              {application.categoryTitle} — {application.summaryHeadline}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Institution: {application.formData?.institutionName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">PID: {application.formData?.aictePid}</span>
              <span aria-hidden="true">·</span>
              <span>Submitted: {application.submittedAt}</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated: {application.lastUpdated}</span>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2.5 shrink-0">
            <StatusText status={application.status} />

            {/* Officer Primary Verification & Analysis Trigger Button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartVerificationAnalysis}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" aria-hidden="true" />
                <span>
                  {verificationReport
                    ? 'Re-Run Verification & Analysis'
                    : 'Verify & Analyze All Documents'}
                </span>
              </button>

              {verificationReport && (
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download Verification Report (PDF)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dossier Section Tabs */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Application Dossier Sections"
            className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              1. Application Form &amp; Supporting Documents
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'report'}
              onClick={() => {
                if (!verificationReport) {
                  handleStartVerificationAnalysis();
                } else {
                  setActiveTab('report');
                }
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              2. Per-Document Verification Checklist &amp; Report
              {verificationReport ? ' (Ready)' : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              3. Audit Log &amp; Timestamp History ({application.auditLog?.length || 0})
            </button>
          </div>
        </div>
      </div>

      {/* INSTITUTION VIEW: Officer Clarification / Re-upload Action Center */}
      {userRole === 'institution' && flaggedDocs.length > 0 && (
        <div className="border border-amber-300 rounded-xl bg-amber-50/60 overflow-hidden">
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 space-y-1">
            <h2 className="text-sm font-bold text-amber-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>
                Action Required: AICTE Scrutiny Officer Requested Replacement Document ({flaggedDocs.length})
              </span>
            </h2>
            <p className="text-xs text-amber-900">
              Upload a replacement file below. Your earlier document version (v1) and its verification record will
              remain preserved in the immutable version history.
            </p>
          </div>

          <div className="divide-y divide-amber-200 bg-white">
            {flaggedDocs.map((doc) => (
              <div key={doc.id} className="p-6 space-y-3 text-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-slate-500 mr-2">Doc #{doc.no}</span>
                    <strong className="text-slate-950 font-bold">{doc.title}</strong>
                    <span className="text-slate-500 ml-2 font-mono">
                      (Current: v{doc.currentVersion} — {doc.fileName})
                    </span>
                  </div>
                  <StatusText status="Clarification / Re-upload Requested" />
                </div>

                <p className="text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">Officer Observation:</strong>{' '}
                  {doc.officerClarificationNote}
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end pt-2">
                  <div className="lg:col-span-5">
                    <label
                      htmlFor={`reupload-file-${doc.id}`}
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Replacement File Name (PDF)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`reupload-file-${doc.id}`}
                        type="text"
                        value={
                          reuploadFiles[doc.id] !== undefined
                            ? reuploadFiles[doc.id]
                            : `${doc.title.replace(/[^a-zA-Z0-9]+/g, '_')}_v${
                                (doc.currentVersion || 1) + 1
                              }_Corrected_120Seats.pdf`
                        }
                        onChange={(e) =>
                          setReuploadFiles((prev) => ({ ...prev, [doc.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                      <label className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg whitespace-nowrap cursor-pointer">
                        <span>Browse</span>
                        <input
                          type="file"
                          accept=".pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setReuploadFiles((prev) => ({ ...prev, [doc.id]: f.name }));
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label
                      htmlFor={`reupload-note-${doc.id}`}
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Institution Compliance Response Note
                    </label>
                    <input
                      id={`reupload-note-${doc.id}`}
                      type="text"
                      value={
                        reuploadNotes[doc.id] !== undefined
                          ? reuploadNotes[doc.id]
                          : 'Corrected seat count to 120 seats and attached notarized ₹100 e-Stamp Affidavit.'
                      }
                      onChange={(e) =>
                        setReuploadNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div className="lg:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleTriggerReupload(doc)}
                      className="w-full px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Upload v{(doc.currentVersion || 1) + 1} &amp; Resubmit</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OFFICER VIEW: Official Scrutiny Decision & Action Panel (Approve / Reject / Request Re-upload) */}
      {userRole === 'officer' && onOfficerAction && (
        <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950 font-display">
                AICTE Authorized Officer Decision &amp; Action Panel
              </h2>
              <p className="text-xs text-slate-600">
                Approve, reject, or request replacement document uploads based on the verification checklist report. Every action is logged with date and timestamp.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Official Human-in-the-Loop Decision Authority
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-4">
              <label
                htmlFor="officer-doc-select"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Target Document (for Re-upload Request)
              </label>
              <select
                id="officer-doc-select"
                value={selectedDocForFlag}
                onChange={(e) => setSelectedDocForFlag(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                {(application.documents || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    Doc #{d.no}: {d.title} ({d.verificationStatus})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-8">
              <label
                htmlFor="officer-remark-input"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Official Officer Remark / Reason for Approval, Rejection, or Re-upload
              </label>
              <input
                id="officer-remark-input"
                type="text"
                value={officerComment}
                onChange={(e) => setOfficerComment(e.target.value)}
                placeholder="Enter official scrutiny observation, deficiency reason, or approval order remark..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Need to inspect per-document evidence first? Click{' '}
              <button
                type="button"
                onClick={handleStartVerificationAnalysis}
                className="font-semibold text-blue-950 underline cursor-pointer"
              >
                Verify &amp; Analyze All Documents
              </button>
              .
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onOfficerAction(
                    application.id,
                    'request_reupload',
                    selectedDocForFlag,
                    officerComment ||
                      'Document verification detected discrepancy. Please upload a corrected, duly notarized replacement document.'
                  );
                  setOfficerComment('');
                }}
                className="px-4 py-2 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Request Document Re-upload</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOfficerAction(
                    application.id,
                    'reject',
                    null,
                    officerComment ||
                      'Application rejected due to unresolved supporting document non-compliance with AICTE Approval Process Handbook norms.'
                  );
                  setOfficerComment('');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reject Application</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOfficerAction(
                    application.id,
                    'approve',
                    null,
                    officerComment ||
                      'All 8 application fields and 4 supporting documents verified. Official AICTE Approval granted for AY 2026-2027.'
                  );
                  setOfficerComment('');
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Approve Application</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Complete Application Form (8 Fields) + Supporting Documents (4 Docs) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 6 Columns: 8 Submitted Form Fields */}
          <div className="lg:col-span-6 border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-950 font-display">
                  Submitted Application Form Data (8 Fields)
                </h2>
                <p className="text-xs text-slate-600">{schema?.purpose}</p>
              </div>
              <ClipboardList className="w-4 h-4 text-blue-900 shrink-0" aria-hidden="true" />
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              {(schema?.fields || []).map((field) => (
                <div key={field.key} className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">
                      <span className="font-mono mr-2 text-slate-500">No. {field.no}</span>
                      {field.label}
                    </span>
                    <span className="text-[11px]">{field.description}</span>
                  </div>
                  <p className="text-slate-900 font-medium pl-8 leading-relaxed">
                    {String(application.formData?.[field.key] || '—')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right 6 Columns: 4 Supporting Documents, Extracted Fields & Version History */}
          <div className="lg:col-span-6 border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-950 font-display">
                  Supporting Documents &amp; Version Ledger (4 Checklist Records)
                </h2>
                <p className="text-xs text-slate-600">
                  Inspect uploaded files, extracted fields, and preserved versions
                </p>
              </div>
              <FileText className="w-4 h-4 text-blue-900 shrink-0" aria-hidden="true" />
            </div>

            <div className="divide-y divide-slate-200">
              {(application.documents || []).map((doc) => (
                <div key={doc.id} className="p-5 space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-950 text-sm">
                        <span className="font-mono text-slate-500 mr-2">No. {doc.no}</span>
                        {doc.title}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-800">System verifies:</span> {doc.verifies}
                      </p>
                    </div>
                    <StatusText status={doc.verificationStatus} />
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-slate-800">
                        <span className="font-bold text-blue-950">v{doc.currentVersion || 1}</span>
                        <span>·</span>
                        <span className="font-semibold">{doc.fileName}</span>
                        <span>·</span>
                        <span className="text-slate-500">{doc.fileSize}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-950 bg-slate-100 hover:bg-slate-200 rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Inspect Document &amp; OCR</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span>Uploaded: {doc.uploadedAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>Engine: {doc.extractionMethod}</span>
                      {doc.docuPassReused && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-blue-900">
                            Reused via DocuPass ({doc.docuPassPassportId})
                          </span>
                        </>
                      )}
                    </div>

                    {doc.officerClarificationNote && doc.reuploadRequested && (
                      <p className="text-amber-900 bg-amber-50 p-2.5 rounded border border-amber-200">
                        <strong>Reason Not Verified:</strong> {doc.officerClarificationNote}
                      </p>
                    )}

                    {doc.institutionResponseNote && (
                      <p className="text-emerald-800 bg-emerald-50/70 p-2.5 rounded border border-emerald-200">
                        <strong>Institution Clarification Response (v{doc.currentVersion}):</strong>{' '}
                        {doc.institutionResponseNote}
                      </p>
                    )}

                    {/* Preserved Earlier Versions */}
                    {doc.versions && doc.versions.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <p className="font-semibold text-slate-700">
                          Preserved Prior Versions ({doc.versions.length}):
                        </p>
                        {doc.versions.map((ver) => (
                          <div
                            key={ver.version}
                            className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500"
                          >
                            <span className="font-mono">
                              v{ver.version} · {ver.fileName} ({ver.fileSize})
                            </span>
                            <span>
                              Uploaded {ver.uploadedAt} · Prior Outcome: {ver.verificationStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PER-DOCUMENT VERIFICATION CHECKLIST & EVIDENCE REPORT (No Mixed Evidence!) */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {(() => {
            const report =
              verificationReport ||
              runOfficerDocumentVerification(application, '2026-10-23 14:35 IST');
            return (
              <>
                {/* Report Header & Download Bar */}
                <div className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-bold text-blue-950">{report.reportId}</span>
                      <span aria-hidden="true">·</span>
                      <span>Generated: {report.generatedAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>Each Document Examined &amp; Reported Separately</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-950 font-display">
                      Per-Document Verification Checklist &amp; Isolated Evidence Report
                    </h2>
                    <p className="text-xs text-slate-600">
                      Individual verification status, extracted OCR evidence, and explicit verification reason for each
                      supporting document, followed by the overall officer decision summary.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Preview Verification Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download Verification Report (PDF)</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 1: 4 Separate Document Evidence Cards (Strictly Isolated Per Document) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 font-display px-1">
                    Section 1: Individual Supporting Document Verification &amp; Isolated Evidence ({report.documentReports.length} Documents)
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    {report.documentReports.map((docRep) => (
                      <div
                        key={docRep.docId}
                        className="border border-slate-200 rounded-xl bg-white overflow-hidden"
                      >
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-blue-950">
                                Document #{docRep.docNo}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <h4 className="text-sm font-bold text-slate-950 font-display">
                                {docRep.documentTitle}
                              </h4>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                {docRep.ruleCode}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              <strong className="text-slate-800">What System Verifies:</strong>{' '}
                              {docRep.whatSystemVerifies}
                            </p>
                          </div>

                          <div className="shrink-0">
                            <StatusText status={docRep.statusLabel} />
                          </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
                          {/* Left 6 Cols: Isolated Extracted Evidence from this specific document */}
                          <div className="lg:col-span-6 space-y-2.5">
                            <p className="font-bold text-slate-900">
                              Isolated Evidence Extracted from {docRep.fileName} (v{docRep.version})
                            </p>
                            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                              {docRep.extractedEvidence.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="px-3.5 py-2 flex items-center justify-between gap-4"
                                >
                                  <span className="text-slate-600 font-medium">{item.field}</span>
                                  <span className="font-mono font-semibold text-slate-900 text-right">
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="font-mono text-[11px] text-slate-500 break-all">
                              {docRep.extractionMethod}
                            </p>
                          </div>

                          {/* Right 6 Cols: Explicit Verification Outcome & Reason (Why Verified or Why Not Verified) */}
                          <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
                            <div className="space-y-2">
                              <p className="font-bold text-slate-900">
                                {docRep.verified
                                  ? 'Verification Finding — Why Document is Verified'
                                  : 'Discrepancy Finding — Why Document is NOT Verified'}
                              </p>
                              <div
                                className={`p-4 rounded-lg border leading-relaxed ${
                                  docRep.verified
                                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                    : 'bg-red-50/70 border-red-200 text-red-950'
                                }`}
                              >
                                {docRep.verificationReason}
                              </div>
                            </div>

                            {userRole === 'officer' && !docRep.verified && (
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOfficerAction(
                                      application.id,
                                      'request_reupload',
                                      docRep.docId,
                                      docRep.discrepancyDetail ||
                                        `Please re-upload a corrected ${docRep.documentTitle}.`
                                    );
                                  }}
                                  className="px-3.5 py-1.5 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors cursor-pointer"
                                >
                                  Flag Doc #{docRep.docNo} for Re-upload
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 2: Overall Summary of All Documents (Decision Guidance for Officer) */}
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-950 font-display">
                        Section 2: Overall Executive Summary of Documents &amp; Officer Decision Guidance
                      </h3>
                      <p className="text-xs text-slate-600">
                        Consolidated verification checklist tally across all {report.totalDocuments} supporting documents
                      </p>
                    </div>
                    <StatusText status={report.overallOutcome} />
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pb-5 border-b border-slate-200">
                      <div>
                        <p className="text-xs text-slate-500">Total Documents Examined</p>
                        <p className="text-2xl font-bold font-mono tabular-nums text-slate-950 mt-1">
                          {report.totalDocuments}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Documents Verified (Passed)</p>
                        <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                          {report.verifiedCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Documents Not Verified</p>
                        <p className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
                          {report.failedCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">DocuPass Passports Reused</p>
                        <p className="text-2xl font-bold font-mono tabular-nums text-blue-900 mt-1">
                          {report.reusedCount}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold text-slate-900">
                        Overall Verification Summary for Scrutiny Officer:
                      </p>
                      <p className="text-slate-700 leading-relaxed">{report.executiveNarrative}</p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* TAB 3: Immutable Audit Log & Action History */}
      {activeTab === 'audit' && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950 font-display">
                Application Audit Trail &amp; Timestamped Action History
              </h2>
              <p className="text-xs text-slate-600">
                Chronological record of institutional submissions, officer verification runs, clarification requests, replacement uploads, and official decisions
              </p>
            </div>
            <History className="w-4 h-4 text-blue-900 shrink-0" aria-hidden="true" />
          </div>

          <div className="divide-y divide-slate-200 text-xs">
            {(application.auditLog || []).map((entry) => (
              <div
                key={entry.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-slate-600">{entry.timestamp}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-slate-900">{entry.action}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600">{entry.actor}</span>
                  </div>
                  <p className="text-slate-600">{entry.details}</p>
                </div>
                <div className="shrink-0">
                  <StatusText status={entry.outcome} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Printable Official Text Report Modal */}
      {reportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="printable-report-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  Official AICTE Verification Checklist Export
                </p>
                <h3
                  id="printable-report-title"
                  className="text-base font-bold text-slate-950 font-display"
                >
                  Verification Report — {application.id}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close report preview"
                onClick={() => setReportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {formatVerificationReportText(
                application,
                verificationReport ||
                  runOfficerDocumentVerification(application, '2026-10-23 14:35 IST')
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download Verification Report (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document & Extracted OCR Inspector Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-preview-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  Document Version v{previewDoc.currentVersion || 1} · {previewDoc.fileName}
                </p>
                <h3 id="doc-preview-title" className="text-base font-bold text-slate-950 font-display">
                  {previewDoc.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close document preview"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Verification Status:</span>
                  <StatusText status={previewDoc.verificationStatus} />
                </div>
                <p className="text-slate-600">
                  Extraction Method: <strong>{previewDoc.extractionMethod}</strong>
                </p>
                {previewDoc.docuPassPassportId && (
                  <p className="font-mono text-blue-900 font-semibold">
                    Linked DocuPass Passport: {previewDoc.docuPassPassportId}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">
                  Extracted Document Fields (Compared Against Application Form)
                </h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {Object.entries(previewDoc.extractedFields || {}).map(([k, v]) => (
                    <div key={k} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                      <span className="font-medium text-slate-600">{k}</span>
                      <span className="font-mono font-semibold text-slate-900 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
