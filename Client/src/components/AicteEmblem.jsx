import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ServerCrash,
  Eye,
  MinusCircle,
  CalendarOff,
  ShieldAlert,
} from 'lucide-react';

export function AicteCrestIcon({ className = 'w-9 h-9' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" fill="#0F2547" stroke="#D97706" strokeWidth="2" />
      <circle cx="24" cy="24" r="17.5" stroke="#93C5FD" strokeWidth="1" strokeDasharray="2 2" />
      <path
        d="M24 8L26.2 12.6L31.2 13.3L27.6 16.8L28.5 21.8L24 19.4L19.5 21.8L20.4 16.8L16.8 13.3L21.8 12.6L24 8Z"
        fill="#F59E0B"
      />
      <path
        d="M14 27C14 24.5 18.5 23 24 23C29.5 23 34 24.5 34 27V34C34 34 29.5 32.5 24 32.5C18.5 32.5 14 34 14 34V27Z"
        fill="#FFFFFF"
      />
      <path d="M24 23V32.5" stroke="#0F2547" strokeWidth="1.5" />
      <path d="M16 37H32" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Semantic status display pairing icon + explicit text label (no hue-only signaling, no pill sandwich).
 */
export function StatusText({ status }) {
  const normalized = String(status || '').toLowerCase();

  if (
    normalized.includes('passed') ||
    normalized.includes('approved') ||
    normalized.includes('verified')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    normalized.includes('issue') ||
    normalized.includes('clarification') ||
    normalized.includes('re-upload') ||
    normalized.includes('mismatch')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized.includes('source unavailable')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
        <ServerCrash className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized.includes('manual review') || normalized.includes('scrutiny') || normalized.includes('resubmitted')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 whitespace-nowrap">
        <Eye className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized.includes('not applicable')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
        <MinusCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized.includes('expired')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-800 whitespace-nowrap">
        <CalendarOff className="w-3.5 h-3.5 shrink-0 text-orange-600" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    normalized.includes('revoked') ||
    normalized.includes('rejected') ||
    normalized.includes('not verified')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-600" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <span>{status || 'Pending'}</span>
    </span>
  );
}
