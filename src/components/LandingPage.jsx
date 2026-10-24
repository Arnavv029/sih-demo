import React, { useState } from 'react';
import {
  Building2,
  UserCheck,
  ArrowRight,
  ExternalLink,
  BookOpen,
  FileCheck2,
  TrendingUp,
  PlusCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AicteCrestIcon } from './AicteEmblem.jsx';
import { APPLICATION_CATEGORIES } from '../utils/aicteLogic.js';

export default function LandingPage({
  onNavigateLogin,
  onQuickStartCategory,
}) {
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [selectedRuleCategory, setSelectedRuleCategory] = useState('eoa');

  const categoryCards = [
    {
      id: 'eoa',
      clause: 'Clause 2.1',
      title: 'Extension of Approval (EoA)',
      description: 'For existing institutions applying to continue their approval.',
      meta: '8 Form Fields · 4 Supporting Documents',
      icon: FileCheck2,
    },
    {
      id: 'intake_increase',
      clause: 'Clause 2.5',
      title: 'Increase in Student Intake',
      description: 'For institutions requesting additional seats in an existing course.',
      meta: '8 Form Fields · 4 Supporting Documents',
      icon: TrendingUp,
    },
    {
      id: 'new_course',
      clause: 'Clause 2.7',
      title: 'Introduction of a New Course',
      description: 'For institutions applying to introduce a new course or programme.',
      meta: '8 Form Fields · 4 Supporting Documents',
      icon: PlusCircle,
    },
  ];

  const activeRuleSchema = APPLICATION_CATEGORIES[selectedRuleCategory];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/90 px-6 lg:px-12 py-4 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0"
        >
          AICTE Verification Portal
        </a>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600"
        >
          <a
            href="#top"
            className="hover:text-blue-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Home
          </a>
          <a
            href="#categories"
            className="hover:text-blue-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Approval Categories
          </a>
          <a
            href="#guidelines"
            className="hover:text-blue-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Guidelines
          </a>
          <a
            href="https://www.aicte.gov.in/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-950 hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>Official AICTE</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateLogin('institution')}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Clean, Spacious Hero Section */}
        <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-white">
          <div className="max-w-[1160px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Core Message & Dual Portal Actions */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center gap-3">
                  <AicteCrestIcon className="w-10 h-10 shrink-0" />
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-blue-950">Technical Institution Approval</span>
                    <span aria-hidden="true" className="mx-2">
                      ·
                    </span>
                    <span>Application Verification System · Version 1</span>
                  </div>
                </div>

                <h1
                  className="font-display font-bold text-slate-950 tracking-tight leading-[1.12]"
                  style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.4rem)', textWrap: 'balance' }}
                >
                  AICTE Application Verification Portal
                </h1>

                <div className="space-y-3 text-base text-slate-600 leading-relaxed max-w-[60ch]">
                  <p>
                    A digital platform for managing technical institution approval applications,
                    supporting document verification, and officer review.
                  </p>
                  <p className="text-sm text-slate-500">
                    Submit applications, track progress, and review verification findings through
                    connected institution and officer portals.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => onNavigateLogin('institution')}
                    className="px-6 py-3 text-sm font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" aria-hidden="true" />
                    <span>Institution Portal</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateLogin('officer')}
                    className="px-6 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-blue-950" aria-hidden="true" />
                    <span>Officer Portal</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Clean Connected Portals Visual Card */}
              <div className="lg:col-span-5">
                <div className="border border-slate-200 rounded-2xl bg-white p-7 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Connected Workflow</p>
                      <h2 className="text-base font-bold text-slate-950 font-display mt-0.5">
                        Role-Based Portal Access
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-slate-500">AY 2026–2027</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    <div className="pb-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Institution Portal</h3>
                        <span className="text-xs text-blue-900 font-medium">For Colleges &amp; Institutes</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Select an approval category, complete the 8-field application form, upload
                        supporting checklist documents, and track real-time verification status.
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigateLogin('institution')}
                        className="text-xs font-semibold text-blue-950 hover:text-blue-800 inline-flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        <span>Continue as Institution</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="pt-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Officer Portal</h3>
                        <span className="text-xs text-amber-800 font-medium">For AICTE Reviewers</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Inspect submitted applications, verify supporting documents and findings,
                        request replacement uploads, and record official review outcomes.
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigateLogin('officer')}
                        className="text-xs font-semibold text-blue-950 hover:text-blue-800 inline-flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        <span>Continue as Officer</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Application Categories Section */}
        <section id="categories" className="py-16 lg:py-20 border-b border-slate-200/80 bg-white">
          <div className="max-w-[1160px] mx-auto px-6 lg:px-12 space-y-10">
            <div className="space-y-2">
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-950 font-display tracking-tight">
                Application Categories
              </h2>
              <p className="text-sm text-slate-600">
                Select the relevant category after entering the institution portal.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {categoryCards.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <div
                    key={cat.id}
                    className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col justify-between space-y-6 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 text-blue-950 flex items-center justify-center">
                          <IconComponent className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-mono text-slate-500">{cat.clause}</span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-950 font-display">
                          {cat.title}
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {cat.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">{cat.meta}</span>
                      <button
                        type="button"
                        onClick={() => onQuickStartCategory(cat.id)}
                        className="text-xs font-semibold text-blue-950 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <span>Apply</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Application Guidelines Section */}
        <section id="guidelines" className="py-16 lg:py-20 bg-slate-50/60">
          <div className="max-w-[1160px] mx-auto px-6 lg:px-12 space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-950 font-display tracking-tight">
                Application Guidelines
              </h2>
              <p className="text-sm text-slate-600">
                Review the applicable AICTE rules before preparing an application.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl bg-white p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-lg bg-slate-100 text-blue-950 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-950 font-display">
                    Approval Process Handbook
                  </h3>
                  <p className="text-sm text-slate-600">
                    Official rules, approval requirements, and supporting-document guidance.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRulesModalOpen(true)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>View rules</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <a
                  href="https://www.aicte.gov.in/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Official AICTE Website</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6 lg:px-12 text-xs text-slate-500">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-bold text-slate-900">AICTE Application Verification Portal</p>
            <p>Independent prototype for demonstration purposes. Not an official AICTE service.</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigateLogin('institution')}
              className="hover:text-slate-900 underline-offset-4 hover:underline cursor-pointer"
            >
              Institution Portal
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigateLogin('officer')}
              className="hover:text-slate-900 underline-offset-4 hover:underline cursor-pointer"
            >
              Officer Portal
            </button>
          </div>
        </div>
      </footer>

      {/* Lightweight Rules & Supporting Documents Modal when "View rules" is clicked */}
      {rulesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="handbook-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-900">Approval Process Handbook</p>
                <h3 id="handbook-modal-title" className="text-base font-bold text-slate-950 font-display">
                  Application Fields &amp; Supporting Document Requirements
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close rules dialog"
                onClick={() => setRulesModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {Object.values(APPLICATION_CATEGORIES).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedRuleCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      selectedRuleCategory === cat.id
                        ? 'bg-blue-950 text-white'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    {cat.shortTitle}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">
                  Required Form Fields ({activeRuleSchema.fields.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeRuleSchema.fields.map((f) => (
                    <div key={f.key} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="font-semibold text-slate-900">
                        <span className="font-mono text-slate-500 mr-1.5">{f.no}.</span>
                        {f.label}
                      </p>
                      <p className="text-slate-500 mt-0.5">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">
                  Mandatory Supporting Documents ({activeRuleSchema.checklist.length})
                </h4>
                <div className="space-y-2">
                  {activeRuleSchema.checklist.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {doc.no}. {doc.title}
                        </p>
                        <p className="text-slate-600 mt-0.5">Verifies: {doc.verifies}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setRulesModalOpen(false);
                  onQuickStartCategory(selectedRuleCategory);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg cursor-pointer"
              >
                Proceed to {activeRuleSchema.shortTitle}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
