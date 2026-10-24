import React, { useState } from 'react';
import { Building2, UserCheck, ArrowLeft, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { AicteCrestIcon } from './AicteEmblem.jsx';
import { INSTITUTION_PROFILE, OFFICER_PROFILE } from '../data/seedApplications.js';

export default function LoginPage({
  initialRole = 'institution',
  institutionAccounts,
  onBackToLanding,
  onLoginSuccess,
  onRegisterSuccess,
}) {
  const [role, setRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registration, setRegistration] = useState({
    name: '',
    aictePid: '',
    email: '',
    nodalOfficer: '',
    password: '',
    confirmPassword: '',
  });

  const handleRoleSwitch = (nextRole) => {
    setRole(nextRole);
    setError('');
    setIdentifier('');
    setEmail('');
    setPassword('');
    setRegisterOpen(false);
  };

  const restoreDemoCredentials = () => {
    if (role === 'officer') {
      setIdentifier(OFFICER_PROFILE.officerId);
      setEmail(OFFICER_PROFILE.email);
    } else {
      setIdentifier(INSTITUTION_PROFILE.aictePid);
      setEmail(INSTITUTION_PROFILE.email);
    }
    setPassword('AICTE-Portal-2026#');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim() || !email.trim() || !password.trim()) {
      setError('Please enter your official AICTE identifier, registered email, and password.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid institute or AICTE bureau email address.');
      return;
    }

    if (role === 'officer') {
      if (
        identifier.trim() !== OFFICER_PROFILE.officerId ||
        email.trim().toLowerCase() !== OFFICER_PROFILE.email.toLowerCase() ||
        password !== 'AICTE-Portal-2026#'
      ) {
        setError('The officer ID, official email, or password is incorrect.');
        return;
      }
      onLoginSuccess(role);
      return;
    }

    const account = institutionAccounts.find(
      (candidate) =>
        candidate.aictePid.toLowerCase() === identifier.trim().toLowerCase() &&
        candidate.email.toLowerCase() === email.trim().toLowerCase() &&
        candidate.password === password
    );
    if (!account) {
      setError('The institute PID, institute email, or password is incorrect.');
      return;
    }
    onLoginSuccess(role, account);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    const { name, aictePid, email: instituteEmail, nodalOfficer, password: newPassword, confirmPassword } = registration;
    if (!name.trim() || !aictePid.trim() || !instituteEmail.trim() || !nodalOfficer.trim()) {
      setError('Complete all institute registration fields.');
      return;
    }
    if (!/^1-\d{7,12}$/.test(aictePid.trim())) {
      setError('Enter a valid AICTE PID, for example 1-4829104321.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(instituteEmail.trim())) {
      setError('Enter a valid institute email address.');
      return;
    }
    if (institutionAccounts.some((account) =>
      account.aictePid.toLowerCase() === aictePid.trim().toLowerCase() ||
      account.email.toLowerCase() === instituteEmail.trim().toLowerCase()
    )) {
      setError('An account with this PID or institute email already exists in this session.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The password and confirmation do not match.');
      return;
    }

    onRegisterSuccess({
      name: name.trim(),
      aictePid: aictePid.trim(),
      email: instituteEmail.trim(),
      nodalOfficer: nodalOfficer.trim(),
      region: 'Institute Portal',
      universityAffiliation: '',
      naacAccreditation: '',
      password: newPassword,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col justify-between">
      {/* Strict 3-Zone Header */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-12 py-4 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={onBackToLanding}
          className="text-lg font-bold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0 cursor-pointer"
        >
          AICTE Verification Portal
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => handleRoleSwitch('institution')}
            className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              role === 'institution' ? 'text-blue-950 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Institution Login
          </button>
          <button
            type="button"
            onClick={() => handleRoleSwitch('officer')}
            className={`hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              role === 'officer' ? 'text-blue-950 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Scrutiny Officer Login
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onBackToLanding}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Public Portal</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-12 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {/* Left Context Column */}
          <div className="lg:col-span-5 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-8 flex flex-col justify-between space-y-8">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <AicteCrestIcon className="w-10 h-10 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">All India Council for Technical Education</p>
                  <p className="text-[11px] text-slate-600">Role-Based Single Window Authentication</p>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-bold text-slate-950 font-display">
                  {role === 'institution'
                    ? 'Technical Institution Portal Access'
                    : 'AICTE Authorized Scrutiny Officer Access'}
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {role === 'institution'
                    ? 'Sign in with your AICTE Permanent ID (PID) to create approval applications (EoA, Intake Increase, New Course), manage your DocuPass Verification Vault, and respond to officer clarification requests.'
                    : 'Sign in with your AICTE Approval Bureau credentials to inspect submitted institutional applications, review OCR cross-field comparisons, and issue official scrutiny outcomes.'}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                <p className="font-semibold text-slate-900">Active Demo Session Credentials</p>
                {role === 'institution' ? (
                  <div className="space-y-1 text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">Institution:</span> {INSTITUTION_PROFILE.name}
                    </p>
                    <p className="font-mono">
                      <span className="font-sans font-medium text-slate-800">AICTE PID:</span>{' '}
                      {INSTITUTION_PROFILE.aictePid}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Nodal Officer:</span>{' '}
                      {INSTITUTION_PROFILE.nodalOfficer}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">Officer:</span> {OFFICER_PROFILE.name}
                    </p>
                    <p className="font-mono">
                      <span className="font-sans font-medium text-slate-800">Officer ID:</span>{' '}
                      {OFFICER_PROFILE.officerId}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Bureau:</span> Northern Regional Office (NRO)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-900 shrink-0" aria-hidden="true" />
              <span>Prototype demo only — no server authentication or persistent account storage</span>
            </div>
          </div>

          {/* Right Sign-In Form Column */}
          <div className="lg:col-span-7 p-8 space-y-6">
            {/* Role Switcher Tabs */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-600 block">Select Target Portal Role</span>
              <div
                role="tablist"
                aria-label="Portal Role Selection"
                className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'institution'}
                  onClick={() => handleRoleSwitch('institution')}
                  className={`py-2.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                    role === 'institution'
                      ? 'bg-blue-950 text-white'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                  <span>Technical Institution</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'officer'}
                  onClick={() => handleRoleSwitch('officer')}
                  className={`py-2.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                    role === 'officer'
                      ? 'bg-blue-950 text-white'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                  <span>AICTE Officer</span>
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="off">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  {role === 'institution'
                    ? 'AICTE Permanent ID (PID)'
                    : 'AICTE Scrutiny Officer ID'}
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={role === 'institution' ? '1-4829104321' : 'AICTE-NRO-SCR-084'}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  {role === 'institution'
                    ? 'Institute Email'
                    : 'Official AICTE Bureau Email'}
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={restoreDemoCredentials}
                  className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Restore Demo Credentials
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {role === 'institution'
                      ? 'Sign In to Institution Portal'
                      : 'Sign In to Officer Portal'}
                  </span>
                </button>
              </div>
            </form>

            {role === 'institution' && (
              <button
                type="button"
                onClick={() => {
                  setRegisterOpen(true);
                  setError('');
                }}
                className="w-full text-xs font-semibold text-blue-950 hover:underline cursor-pointer"
              >
                Register as a New Institute
              </button>
            )}
          </div>
        </div>
      </main>

      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-institute-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="register-institute-title" className="text-lg font-bold text-slate-950">
                  Register a New Institute
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Demo registration is held only in this browser session and is not an official account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegisterOpen(false)}
                aria-label="Close institute registration"
                className="text-sm font-semibold text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {error}
                </div>
              )}
              {[
                ['name', 'Institute Name', 'text'],
                ['aictePid', 'AICTE Permanent ID (PID)', 'text'],
                ['email', 'Institute Email', 'email'],
                ['nodalOfficer', 'Nodal Officer Name', 'text'],
                ['password', 'Password (at least 8 characters)', 'password'],
                ['confirmPassword', 'Confirm Password', 'password'],
              ].map(([field, label, type]) => (
                <label key={field} className="block text-xs font-semibold text-slate-800">
                  {label}
                  <input
                    type={type}
                    autoComplete="off"
                    value={registration[field]}
                    onChange={(event) =>
                      setRegistration((current) => ({ ...current, [field]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-950 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
                >
                  Create Demo Account
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-4 px-6 lg:px-12 text-center text-xs text-slate-500">
        All India Council for Technical Education · Single Window Application Verification Portal (MVP v1.0)
      </footer>
    </div>
  );
}
