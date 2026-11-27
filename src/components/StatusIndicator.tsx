import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { DECISION_LABELS, type SubmissionStatus } from '../types';

interface StatusIndicatorProps {
  status: SubmissionStatus;
  compact?: boolean;
}

export function StatusIndicator({ status, compact = false }: StatusIndicatorProps) {
  const label = DECISION_LABELS[status];

  if (status === 'verified') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 font-medium text-emerald-800 whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === 'additional_evidence') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 font-medium text-amber-800 whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 font-medium text-red-800 whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <XCircle className="h-3.5 w-3.5 text-red-700 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-100 font-medium text-stone-700 whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Clock className="h-3.5 w-3.5 text-stone-600 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
