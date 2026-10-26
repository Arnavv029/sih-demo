import React from 'react';
import { StatusText } from './AicteEmblem.jsx';

export default function DocuPassVaultView({ docuPassVault, onStartNewApplication }) {
  return (
    <div className="space-y-6">
      <div className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-blue-900">
            DocuPass — Reusable Document Verification Passport Ledger
          </p>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-950 font-display">
            Institution Verified Document Passports ({docuPassVault.length})
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            Guiding Principle: &ldquo;Verify once, reuse when eligible, and re-verify whenever necessary.&rdquo; Eligible
            foundational documents with an eligible prior review and active validity periods can be reused across
            EoA, Intake Increase, and New Course applications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onStartNewApplication('eoa')}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Apply Using DocuPass Vault
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {docuPassVault.map((record) => (
          <div
            key={record.passportId}
            className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-blue-900">{record.passportId}</span>
                  <h2 className="text-base font-bold text-slate-950 font-display mt-0.5">
                    {record.documentTitle}
                  </h2>
                </div>
                <StatusText status="Passed · Active Passport" />
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">{record.extractedSummary}</p>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Original Verified File:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {record.fileName} ({record.fileSize})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Valid Until / Reused Count:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {record.validUntil} · Reused {record.reuseCount}x
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Verified by: {record.verifiedBy}</span>
              <span className="font-mono">{record.verifiedTimestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
