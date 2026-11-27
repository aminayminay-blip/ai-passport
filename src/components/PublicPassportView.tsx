import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, Printer, ShieldCheck } from 'lucide-react';
import { fetchPublicPassport } from '../api';
import {
  formatShortDate,
  RUBRIC_CRITERIA,
  type PublicPassportData,
} from '../types';
import { StatusIndicator } from './StatusIndicator';

interface PublicPassportViewProps {
  shareToken: string;
  onExitPublicView: () => void;
}

export function PublicPassportView({
  shareToken,
  onExitPublicView,
}: PublicPassportViewProps) {
  const [passport, setPassport] = useState<PublicPassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPublicPassport(shareToken);
        if (!active) return;
        setPassport(data);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'This shareable passport link is disabled or does not exist.'
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [shareToken]);

  return (
    <div className="min-h-screen bg-[#F9F8F5] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onExitPublicView}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to AI Skill Passport</span>
          </button>

          {passport && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Print / Save as PDF</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-600">
            Verifying shared credential...
          </div>
        ) : error || !passport ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 sm:p-10 text-center space-y-3">
            <h1 className="font-display text-xl font-semibold text-stone-900">
              Credential Link Unavailable
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-stone-600">
              {error ||
                'This shareable passport link has been disabled by the applicant or is invalid.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onExitPublicView}
                className="min-h-[44px] rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 cursor-pointer"
              >
                Open AI Skill Passport
              </button>
            </div>
          </div>
        ) : (
          <article className="print-passport rounded-xl border border-stone-300 bg-white p-6 sm:p-10">
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-blue-900">
                  <ShieldCheck className="h-4 w-4 text-blue-800" aria-hidden="true" />
                  <span>Verified AI Skill Passport</span>
                </div>
                <p className="text-xs text-stone-500">
                  PLP Africa / ILO PROSPECTS Track 1 — Credential Recognition
                </p>
              </div>
              <div className="font-mono text-xs tabular-nums text-stone-600 sm:text-right">
                <div>Credential ID: {passport.submissionId}</div>
                <div>Verified {formatShortDate(passport.reviewedAt)}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-medium text-stone-500">
                  Credential Holder
                </div>
                <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tight text-stone-900">
                  {passport.applicantName}
                </h1>
                <div className="mt-3 text-xs font-medium text-stone-500">
                  Assessed Practical Skill
                </div>
                <p className="mt-0.5 text-base font-semibold text-stone-900">
                  {passport.skillTitle}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2">
                <StatusIndicator status={passport.decision} />
                <div className="mt-1 sm:text-right">
                  <div className="text-xs text-stone-500">Verified Score</div>
                  <div className="font-mono text-3xl font-semibold tabular-nums text-stone-900">
                    {passport.totalScore}
                    <span className="text-lg font-normal text-stone-500">
                      {' '}
                      / 100
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <h2 className="font-sans text-sm font-semibold text-stone-900">
                  Score Breakdown
                </h2>
                <div className="mt-3 divide-y divide-stone-100 border-t border-b border-stone-200">
                  {RUBRIC_CRITERIA.map((criterion) => {
                    const earned = passport.scores[criterion.key];
                    const pct = Math.round((earned / criterion.maxPoints) * 100);
                    return (
                      <div key={criterion.key} className="py-3">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-medium text-stone-800">
                            {criterion.label}
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-stone-900">
                            {earned} / {criterion.maxPoints}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-blue-800"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-sans text-sm font-semibold text-stone-900">
                    Reviewer Summary
                  </h2>
                  <span className="text-xs text-stone-500">
                    Assessed by {passport.reviewerName}
                  </span>
                </div>
                <p className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 text-sm leading-relaxed text-stone-700">
                  {passport.feedback}
                </p>
              </div>

              {passport.explanation && (
                <div className="space-y-2">
                  <h2 className="font-sans text-sm font-semibold text-stone-900">
                    Applicant Project Summary
                  </h2>
                  <p className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 text-sm leading-relaxed text-stone-700">
                    {passport.explanation}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-2 border-t border-stone-200 pt-4 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-stone-500 shrink-0" aria-hidden="true" />
                <span>
                  Submitted evidence links remain private and are omitted from public passport links.
                </span>
              </div>
              <span className="font-mono">
                Issued {formatShortDate(passport.reviewedAt)}
              </span>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
