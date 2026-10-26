import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  FolderKanban,
  LogOut,
  Search,
  AlertTriangle,
  PlayCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import LandingPage from './components/LandingPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import NewApplicationWizard from './components/NewApplicationWizard.jsx';
import ApplicationDetailView from './components/ApplicationDetailView.jsx';
import RagDocumentIntelligenceView from './components/RagDocumentIntelligenceView.jsx';
import AicteRagAssistantModal from './components/AicteRagAssistantModal.jsx';

import { AicteCrestIcon, StatusText } from './components/AicteEmblem.jsx';
import {
  INSTITUTION_PROFILE,
  OFFICER_PROFILE,
  INITIAL_APPLICATIONS,
} from './data/seedApplications.js';
import {
  applyDocumentReupload,
  APPLICATION_CATEGORIES,
} from './utils/aicteLogic.js';

export default function App() {
  const initialScreenFromUrl = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'portal';
    }
    return 'landing';
  };

  const [screen, setScreen] = useState(initialScreenFromUrl); // 'landing' | 'login' | 'portal'
  const [userRole, setUserRole] = useState('institution'); // 'institution' | 'officer'
  const [activeInstitutionProfile, setActiveInstitutionProfile] = useState(INSTITUTION_PROFILE);
  const [institutionAccounts, setInstitutionAccounts] = useState([
    { ...INSTITUTION_PROFILE, password: 'AICTE-Portal-2026#' },
  ]);
  const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard' | 'new_app' | 'applications' | 'detail' | 'docupass' | 'rag_assistant'
  const [wizardCategoryId, setWizardCategoryId] = useState('eoa');
  const [applications, setApplications] = useState(INITIAL_APPLICATIONS);

  const [selectedApplicationId, setSelectedApplicationId] = useState(INITIAL_APPLICATIONS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bannerNotice, setBannerNotice] = useState('');

  // AICTE Saathi RAG Assistant Modal state
  const [ragModalOpen, setRagModalOpen] = useState(false);
  const [ragModalQuery, setRagModalQuery] = useState('');
  const [ragModalClause, setRagModalClause] = useState('');

  const handleOpenRagAssistant = (query = '', clause = '') => {
    setRagModalQuery(query);
    setRagModalClause(clause);
    setRagModalOpen(true);
  };

  const selectedApplication = useMemo(
    () => applications.find((a) => a.id === selectedApplicationId) || applications[0],
    [applications, selectedApplicationId]
  );

  // Dashboard KPI statistics for both Institution and Officer views
  const stats = useMemo(() => {
    const total = applications.length;
    const approved = applications.filter((a) => a.status.toLowerCase().includes('approved')).length;
    const rejected = applications.filter((a) => a.status.toLowerCase().includes('rejected')).length;
    const clarification = applications.filter((a) =>
      a.status.toLowerCase().includes('clarification')
    ).length;
    const pendingScrutiny = applications.filter(
      (a) =>
        a.status.toLowerCase().includes('scrutiny') ||
        a.status.toLowerCase().includes('resubmitted')
    ).length;
    const checkCompleted = applications.filter(
      (a) =>
        Boolean(a.verificationReport) ||
        a.status.toLowerCase().includes('approved') ||
        a.status.toLowerCase().includes('rejected')
    ).length;

    return {
      total,
      approved,
      rejected,
      clarification,
      pendingScrutiny,
      checkCompleted,
    };
  }, [applications]);

  // Filtered applications for dashboard and tracking table
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesCategory = categoryFilter === 'all' || app.categoryId === categoryFilter;
      const st = app.status.toLowerCase();
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'clarification' && st.includes('clarification')) ||
        (statusFilter === 'pending' && (st.includes('scrutiny') || st.includes('resubmitted'))) ||
        (statusFilter === 'completed' &&
          (Boolean(app.verificationReport) || st.includes('approved') || st.includes('rejected'))) ||
        (statusFilter === 'approved' && st.includes('approved')) ||
        (statusFilter === 'rejected' && st.includes('rejected'));

      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        app.id.toLowerCase().includes(q) ||
        app.categoryTitle.toLowerCase().includes(q) ||
        app.summaryHeadline.toLowerCase().includes(q) ||
        (app.formData?.institutionName || '').toLowerCase().includes(q) ||
        (app.formData?.aictePid || '').toLowerCase().includes(q);

      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [applications, categoryFilter, statusFilter, searchQuery]);

  const handleNavigateLogin = (targetRole = 'institution') => {
    setUserRole(targetRole);
    setScreen('login');
  };

  const handleQuickStartCategory = (categoryId) => {
    setUserRole('institution');
    setWizardCategoryId(categoryId);
    setScreen('portal');
    setActiveNav('new_app');
  };

  const handleLoginSuccess = (loggedInRole, institutionAccount) => {
    setUserRole(loggedInRole);
    if (loggedInRole === 'institution' && institutionAccount) {
      const { password: _password, ...profile } = institutionAccount;
      setActiveInstitutionProfile(profile);
    }
    setScreen('portal');
    setActiveNav('dashboard');
  };

  const handleRegisterInstitution = (institutionAccount) => {
    setInstitutionAccounts((current) => [...current, institutionAccount]);
    const { password: _password, ...profile } = institutionAccount;
    setActiveInstitutionProfile(profile);
    setUserRole('institution');
    setScreen('portal');
    setActiveNav('dashboard');
  };

  const handleStartNewApp = (categoryId = 'eoa') => {
    setWizardCategoryId(categoryId);
    setActiveNav('new_app');
  };

  const handleOpenApplicationDetail = (appId) => {
    setSelectedApplicationId(appId);
    setActiveNav('detail');
  };

  const handleCreateApplication = (newApp) => {
    setApplications((prev) => [newApp, ...prev]);
    setSelectedApplicationId(newApp.id);
    setActiveNav('detail');
    setBannerNotice(
      `Application ${newApp.id} (${newApp.categoryTitle}) submitted in real time and routed to AICTE Scrutiny Officer queue.`
    );
  };

  const handleReuploadDocument = (appId, docId, filePayload, institutionNote) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        return applyDocumentReupload(app, docId, filePayload, institutionNote);
      })
    );
    setBannerNotice(
      `Replacement document (${filePayload.fileName}) uploaded for ${appId}. Earlier version preserved in history and application resubmitted to AICTE Officer.`
    );
  };

  const handleRunVerificationAnalysis = (appId, generatedReport, timestamp) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const actorName =
          userRole === 'officer'
            ? `${OFFICER_PROFILE.name} (AICTE Scrutiny Officer)`
            : 'AICTE Verification Engine';
        const auditEntry = {
          id: `aud-ver-${Date.now()}`,
          timestamp,
          actor: actorName,
          action: `Executed Per-Document Verification & Generated Report (${generatedReport.reportId})`,
          target: `${generatedReport.totalDocuments} Supporting Documents`,
          outcome: `${generatedReport.verifiedCount} Verified · ${generatedReport.failedCount} Not Verified`,
          details: generatedReport.executiveNarrative,
        };
        return {
          ...app,
          lastUpdated: timestamp,
          verificationReport: generatedReport,
          auditLog: [auditEntry, ...(app.auditLog || [])],
        };
      })
    );
    setBannerNotice(
      `Verification analysis completed for ${appId}. Per-document evidence checklist and overall summary generated (${generatedReport.verifiedCount}/${generatedReport.totalDocuments} documents verified).`
    );
  };

  const handleOfficerAction = (appId, actionType, targetDocId, officerComment) => {
    const timestamp = '2026-10-23 14:50 IST';
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;

        if (actionType === 'request_reupload') {
          const updatedDocs = app.documents.map((d) =>
            d.id === targetDocId
              ? {
                  ...d,
                  reuploadRequested: true,
                  verificationStatus: 'Issue detected',
                  officerClarificationNote: officerComment,
                }
              : d
          );
          const targetDocTitle =
            app.documents.find((d) => d.id === targetDocId)?.title || 'Supporting Document';
          return {
            ...app,
            status: 'Clarification Requested',
            lastUpdated: timestamp,
            documents: updatedDocs,
            auditLog: [
              {
                id: `aud-off-${Date.now()}`,
                timestamp,
                actor: `${OFFICER_PROFILE.name} (AICTE Scrutiny Officer)`,
                action: `Requested Document Re-upload: ${targetDocTitle}`,
                target: targetDocTitle,
                outcome: 'Clarification Requested',
                details: officerComment,
              },
              ...(app.auditLog || []),
            ],
          };
        }

        if (actionType === 'reject') {
          return {
            ...app,
            status: 'Rejected — Non-Compliance Recorded',
            lastUpdated: timestamp,
            auditLog: [
              {
                id: `aud-off-${Date.now()}`,
                timestamp,
                actor: `${OFFICER_PROFILE.name} (AICTE Scrutiny Officer)`,
                action: 'Recorded Official Regulatory Rejection',
                target: app.id,
                outcome: 'Rejected — Non-Compliance Recorded',
                details: officerComment,
              },
              ...(app.auditLog || []),
            ],
          };
        }

        if (actionType === 'approve') {
          const updatedDocs = app.documents.map((d) => ({
            ...d,
            reuploadRequested: false,
            verificationStatus: 'Passed',
          }));
          return {
            ...app,
            status: 'Approved — EoA / Order Issued',
            lastUpdated: timestamp,
            documents: updatedDocs,
            auditLog: [
              {
                id: `aud-off-${Date.now()}`,
                timestamp,
                actor: `${OFFICER_PROFILE.name} (AICTE Scrutiny Officer)`,
                action: 'Recorded Official Regulatory Approval',
                target: app.id,
                outcome: 'Approved — EoA / Order Issued',
                details: officerComment,
              },
              ...(app.auditLog || []),
            ],
          };
        }

        return app;
      })
    );

    if (actionType === 'request_reupload') {
      setBannerNotice(
        `Clarification & replacement upload requested on ${appId} (logged at ${timestamp}). The institution can sign in to upload a replacement.`
      );
    } else if (actionType === 'reject') {
      setBannerNotice(`Official rejection recorded for ${appId} and logged in the audit trail.`);
    } else {
      setBannerNotice(`Official approval recorded for ${appId} and logged in the audit trail.`);
    }
  };

  if (screen === 'landing') {
    return (
      <LandingPage
        onNavigateLogin={handleNavigateLogin}
        onQuickStartCategory={handleQuickStartCategory}
        onOpenRagAssistant={handleOpenRagAssistant}
        applications={applications}
      />
    );
  }

  if (screen === 'login') {
    return (
      <LoginPage
        initialRole={userRole}
        institutionAccounts={institutionAccounts}
        onBackToLanding={() => setScreen('landing')}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterInstitution}
      />
    );
  }

  const appsRequiringReupload = applications.filter((a) =>
    (a.documents || []).some((d) => d.reuploadRequested)
  );

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col lg:flex-row">
      {/* Left Sidebar Navigation */}
      <aside className="w-full lg:w-[264px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200">
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between lg:justify-start gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <AicteCrestIcon className="w-9 h-9 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-950 font-display leading-tight">
                  AICTE Portal
                </p>
                <p className="text-[11px] text-slate-500">
                  {userRole === 'institution' ? 'Institution Workspace' : 'Officer Scrutiny Desk'}
                </p>
              </div>
            </div>
          </div>

          <nav aria-label="Portal Workspace Navigation" className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                activeNav === 'dashboard'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                <span>{userRole === 'institution' ? 'Institution Dashboard' : 'Officer Dashboard'}</span>
              </span>
            </button>

            {userRole === 'institution' && (
              <button
                type="button"
                onClick={() => handleStartNewApp('eoa')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  activeNav === 'new_app'
                    ? 'bg-blue-950 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                  <span>Apply for Approval</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveNav('applications')}
              className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                activeNav === 'applications' || activeNav === 'detail'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FolderKanban className="w-4 h-4" aria-hidden="true" />
                <span>
                  {userRole === 'institution' ? 'Track Applications' : 'Examine Applications'}
                </span>
              </span>
              <span className="font-mono text-[11px] opacity-80">{applications.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('rag_assistant')}
              className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                activeNav === 'rag_assistant'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>AI Regulatory Assistant</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/20 text-blue-800 border border-blue-300">
                RAG
              </span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
            <span className="font-semibold text-slate-900">
              {userRole === 'institution' ? 'Institution Portal' : 'AICTE Officer Portal'}
            </span>
            <span aria-hidden="true">/</span>
            <span className="font-mono text-slate-500">
              {userRole === 'institution' ? activeInstitutionProfile.aictePid : OFFICER_PROFILE.officerId}
            </span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-blue-950">
              {activeNav === 'dashboard' &&
                (userRole === 'institution'
                  ? 'Overview & Applications'
                  : 'Officer Scrutiny Dashboard')}
              {activeNav === 'new_app' && 'New Application Wizard'}
              {activeNav === 'applications' && 'Application Queue'}
              {activeNav === 'detail' && selectedApplication?.id}
              {activeNav === 'docupass' && 'DocuPass Verification Vault'}
              {activeNav === 'rag_assistant' && 'AICTE Regulatory Knowledge & RAG Intelligence Desk'}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {userRole === 'institution' ? (
              <button
                type="button"
                onClick={() => handleStartNewApp('eoa')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Application</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenApplicationDetail(applications[0].id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Examine Next Application</span>
              </button>
            )}
            <div className="hidden sm:block max-w-64 border-l border-slate-200 pl-3 text-right">
              <p className="truncate text-xs font-bold text-slate-900">
                {userRole === 'institution' ? activeInstitutionProfile.name : OFFICER_PROFILE.name}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-500">
                {userRole === 'institution'
                  ? `PID: ${activeInstitutionProfile.aictePid}`
                  : `ID: ${OFFICER_PROFILE.officerId}`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sign out to Public Landing Page"
              onClick={() => setScreen('landing')}
              className="p-2 text-slate-600 hover:text-slate-950 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {bannerNotice && (
          <div
            role="status"
            className="mx-6 lg:mx-10 mt-5 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-center justify-between gap-4"
          >
            <span className="font-medium">{bannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice('')}
              className="text-xs font-semibold underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 p-6 lg:p-10 max-w-[1280px] w-full mx-auto space-y-8">
          {/* VIEW 1: INSTITUTION OR OFFICER DASHBOARD */}
          {activeNav === 'dashboard' && (
            <>
              {/* Profile Header Card */}
              <div className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-blue-900">
                      {userRole === 'institution'
                        ? `AICTE PID: ${activeInstitutionProfile.aictePid}`
                        : `Scrutiny Officer ID: ${OFFICER_PROFILE.officerId}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {userRole === 'institution'
                        ? activeInstitutionProfile.region
                        : OFFICER_PROFILE.bureau}
                    </span>
                  </div>
                  <h1 className="text-xl lg:text-2xl font-bold text-slate-950 font-display">
                    {userRole === 'institution'
                      ? activeInstitutionProfile.name
                      : `${OFFICER_PROFILE.name} — AICTE Officer Scrutiny Dashboard`}
                  </h1>
                  <p className="text-xs text-slate-600">
                    {userRole === 'institution'
                      ? [activeInstitutionProfile.universityAffiliation, activeInstitutionProfile.naacAccreditation]
                          .filter(Boolean)
                          .join(' · ') || 'Institute workspace'
                      : 'Examine submitted institutional applications, run per-document verification checklists, download evidence reports, and record official decisions.'}
                  </p>
                </div>

                {userRole === 'institution' ? (
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartNewApp('eoa')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Apply for AY 2026–2027
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveNav('applications')}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Filter All Applications ({stats.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenApplicationDetail(applications[0].id)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Examine Priority Application
                    </button>
                  </div>
                )}
              </div>

              {/* 4-Metric KPI Strip (Tailored for Officer vs Institution) */}
              {userRole === 'officer' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Pending Scrutiny Applications</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-blue-900">
                      {stats.pendingScrutiny}
                    </p>
                    <p className="text-xs text-slate-500">Awaiting Officer Examination</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      Re-upload / Clarification Requested
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                      {stats.clarification}
                    </p>
                    <p className="text-xs text-slate-500">Flagged for replacement document</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Verification Check Completed</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-950">
                      {stats.checkCompleted} / {stats.total}
                    </p>
                    <p className="text-xs text-slate-500">Per-document evidence evaluated</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Official Decisions Recorded</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                      {stats.approved + stats.rejected} Decisions
                    </p>
                    <p className="text-xs text-slate-500">
                      {stats.approved} Approved · {stats.rejected} Rejected
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Total Submitted Applications</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-950">
                      {stats.total}
                    </p>
                    <p className="text-xs text-slate-500">Academic Cycle 2026–2027</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Pending Officer Scrutiny</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-blue-900">
                      {stats.pendingScrutiny}
                    </p>
                    <p className="text-xs text-slate-500">Automated OCR &amp; Rule Checks Complete</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      Clarification / Re-upload Requested
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                      {stats.clarification}
                    </p>
                    <p className="text-xs text-slate-500">Action required on flagged documents</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Approved Applications</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                      {stats.approved} Approved
                    </p>
                    <p className="text-xs text-slate-500">EoA / Orders Issued</p>
                  </div>
                </div>
              )}

              {/* Officer Clarification Task Alert on Institution Dashboard */}
              {userRole === 'institution' && appsRequiringReupload.length > 0 && (
                <div className="border border-amber-200 rounded-xl bg-amber-50/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-950 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                      <span>
                        Officer Clarification Task Pending ({appsRequiringReupload.length}{' '}
                        Application)
                      </span>
                    </p>
                    <p className="text-xs text-amber-900">
                      Application{' '}
                      <strong className="font-mono">{appsRequiringReupload[0].id}</strong> (
                      {appsRequiringReupload[0].categoryTitle}) has a document flagged by the AICTE
                      Scrutiny Officer for replacement upload.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenApplicationDetail(appsRequiringReupload[0].id)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Application &amp; Re-upload Document
                  </button>
                </div>
              )}

              {/* 3 MVP Application Category Launch Cards (Institution View) */}
              {userRole === 'institution' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-950 font-display">
                        Apply for AICTE Approval — Select MVP Category
                      </h2>
                      <p className="text-xs text-slate-600">
                        Choose one of the 3 supported approval categories to open its 8-field form and 4-document checklist
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Object.values(APPLICATION_CATEGORIES).map((cat) => (
                      <div
                        key={cat.id}
                        className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col justify-between space-y-5 hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                            <span>{cat.code}</span>
                            <span>8 Fields · 4 Checklist Docs</span>
                          </div>
                          <h3 className="text-base font-bold text-slate-950 font-display">
                            {cat.title}
                          </h3>
                          <p className="text-xs text-slate-600 leading-relaxed">{cat.purpose}</p>

                          <div className="pt-2 space-y-1 text-[11px] text-slate-500">
                            <p className="font-semibold text-slate-700">Key Checklist Documents:</p>
                            <p>{cat.checklist.map((c) => c.title).join(' · ')}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStartNewApp(cat.id)}
                          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Start {cat.shortTitle} Application</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Applications Queue & Filter Table */}
              <section className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-950 font-display">
                      {userRole === 'institution'
                        ? 'Submitted & Active Institutional Applications'
                        : 'Incoming Institutional Applications Queue (Click to Examine & Verify)'}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Filter applications by status or category and click to examine the 8 form fields, 4 supporting documents, and run per-document verification
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        aria-label="Search applications"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search ID, PID, or course..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    </div>

                    <select
                      aria-label="Filter by category"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="all">All 3 Categories</option>
                      <option value="eoa">Extension of Approval (EoA)</option>
                      <option value="intake_increase">Increase in Student Intake</option>
                      <option value="new_course">Introduction of a New Course</option>
                    </select>

                    <select
                      aria-label="Filter by status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending Scrutiny</option>
                      <option value="clarification">Re-upload Requested</option>
                      <option value="completed">Verification Check Completed</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold">
                        <th className="py-3 px-4 font-mono">Application ID</th>
                        <th className="py-3 px-4">Institution &amp; Category Summary</th>
                        <th className="py-3 px-4 font-mono">Submitted</th>

                        <th className="py-3 px-4">Current Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/90 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-950 whitespace-nowrap">
                            {app.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">
                              {app.categoryTitle} ·{' '}
                              <span className="font-normal text-slate-600">
                                {app.formData?.institutionName}
                              </span>
                            </p>
                            <p className="text-slate-600 mt-0.5">{app.summaryHeadline}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {app.submittedAt}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <StatusText status={app.status} />
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenApplicationDetail(app.id)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>
                                {userRole === 'officer' ? 'Examine & Verify' : 'Inspect Dossier'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* VIEW 2: NEW APPLICATION WIZARD */}
          {activeNav === 'new_app' && (
            <NewApplicationWizard
              initialCategoryId={wizardCategoryId}
              docuPassVault={[]}
              onCancel={() => setActiveNav('dashboard')}
              onSubmitApplication={handleCreateApplication}
            />
          )}

          {/* VIEW 3: ALL APPLICATIONS TRACKER / OFFICER SCRUTINY LIST */}
          {activeNav === 'applications' && (
            <div className="space-y-6">
              <div className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-950 font-display">
                    {userRole === 'officer'
                      ? `Officer Application Scrutiny Queue (${filteredApplications.length})`
                      : `Application Tracking & Compliance Ledger (${filteredApplications.length})`}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Filter by status and click any application to examine its 8 form fields, 4 supporting documents, per-document verification report, and audit trail
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {['all', 'pending', 'clarification', 'completed', 'approved', 'rejected'].map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          statusFilter === st
                            ? 'bg-blue-950 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'all' && 'All'}
                        {st === 'pending' && 'Pending Scrutiny'}
                        {st === 'clarification' && 'Re-upload Requested'}
                        {st === 'completed' && 'Check Completed'}
                        {st === 'approved' && 'Approved'}
                        {st === 'rejected' && 'Rejected'}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {filteredApplications.map((app) => {
                  const hasFlagged = (app.documents || []).some((d) => d.reuploadRequested);
                  return (
                    <div
                      key={app.id}
                      className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-blue-950">{app.id}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800">{app.categoryTitle}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600">{app.formData?.institutionName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-500">Submitted {app.submittedAt}</span>
                        </div>

                        <h2 className="text-base font-bold text-slate-950 font-display">
                          {app.summaryHeadline}
                        </h2>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span>4 Supporting Documents Attached</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {app.docuPassReusedCount || 0} DocuPass Records Reused
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {app.auditLog?.length || 0} Audit Trail Events
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
                        <StatusText status={app.status} />
                        <button
                          type="button"
                          onClick={() => handleOpenApplicationDetail(app.id)}
                          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            userRole === 'institution' && hasFlagged
                              ? 'bg-amber-800 text-white hover:bg-amber-900'
                              : 'bg-blue-950 text-white hover:bg-blue-900'
                          }`}
                        >
                          <span>
                            {userRole === 'officer'
                              ? 'Examine Application & Run Verification'
                              : hasFlagged
                              ? 'Respond & Re-upload Document'
                              : 'Open Complete Application Dossier'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: COMPLETE APPLICATION DOSSIER & OFFICER VERIFICATION REPORT */}
          {activeNav === 'detail' && (
            <ApplicationDetailView
              application={selectedApplication}
              userRole={userRole}
              onBack={() => setActiveNav('applications')}
              onReuploadDocument={handleReuploadDocument}
              onOfficerAction={handleOfficerAction}
              onRunVerificationAnalysis={handleRunVerificationAnalysis}
              onOpenRagAssistant={handleOpenRagAssistant}
            />
          )}

          {/* VIEW 5: DEDICATED AICTE REGULATORY RAG INTELLIGENCE DESK */}
          {activeNav === 'rag_assistant' && (
            <RagDocumentIntelligenceView userRole={userRole} />
          )}

        </main>
      </div>

      {/* Global Floating AICTE Saathi RAG Assistant Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => handleOpenRagAssistant()}
          className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 hover:from-blue-900 hover:to-slate-800 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 border border-blue-400/30 cursor-pointer transform hover:-translate-y-0.5"
          title="Open AICTE Regulatory RAG Assistant"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-blue-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
          </div>
          <span className="text-xs font-bold font-display">Ask AICTE Saathi</span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded font-semibold">
            RAG
          </span>
        </button>
      </div>

      {/* Global AICTE Saathi RAG Assistant Modal Drawer */}
      <AicteRagAssistantModal
        isOpen={ragModalOpen}
        onClose={() => setRagModalOpen(false)}
        initialQuery={ragModalQuery}
        contextClause={ragModalClause}
      />
    </div>
  );
}
