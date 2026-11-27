import { useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Eye,
  Link2,
  Link2Off,
  Lock,
  Printer,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  disableShareLink,
  enableShareLink,
  lookupSubmission,
} from '../api';
import {
  formatShortDate,
  RUBRIC_CRITERIA,
  type SampleSummary,
  type SubmissionRecord,
} from '../types';
import { StatusIndicator } from './StatusIndicator';

interface SkillsPassportSectionProps {
  activeSubmission: SubmissionRecord | null;
  sessionSubmissions: SubmissionRecord[];
  samples: SampleSummary[];
  applicantTokens: Record<string, string>;
  reviewerToken: string | null;
  onSelectSubmission: (submission: SubmissionRecord, token?: string) => void;
  onSubmissionUpdated: (submission: SubmissionRecord) => void;
  onPreviewPublicLink: (shareToken: string) => void;
  onGoToReview: (submissionId: string) => void;
}

export function SkillsPassportSection({
  activeSubmission,
  sessionSubmissions,
  samples,
  applicantTokens,
  reviewerToken,
  onSelectSubmission,
  onSubmissionUpdated,
  onPreviewPublicLink,
  onGoToReview,
}: SkillsPassportSectionProps) {
  const [lookupId, setLookupId] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [includeExplanation, setIncludeExplanation] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleLoadSample = async (sampleId: string) => {
    setLookupError(null);
    setShareError(null);
    setLookupLoading(true);
    try {
      const res = await lookupSubmission({
        submissionId: sampleId,
        token: reviewerToken || applicantTokens[sampleId],
      });
      onSelectSubmission(res.submission, res.applicantToken);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Unable to load sample passport.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setShareError(null);
    if (!lookupId.trim()) {
      setLookupError('Enter a Submission ID.');
      return;
    }

    setLookupLoading(true);
    try {
      const cleanId = lookupId.trim().toUpperCase();
      const res = await lookupSubmission({
        submissionId: cleanId,
        accessCode: lookupCode.trim() || undefined,
        token: reviewerToken || applicantTokens[cleanId],
      });
      onSelectSubmission(res.submission, res.applicantToken);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Could not find matching submission.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const authToken = activeSubmission
    ? applicantTokens[activeSubmission.id] || reviewerToken || undefined
    : undefined;

  const handleCreateShare = async () => {
    if (!activeSubmission) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const res = await enableShareLink(
        activeSubmission.id,
        includeExplanation,
        authToken
      );
      onSubmissionUpdated({
        ...activeSubmission,
        share: res.share,
      });
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : 'Could not create shareable link.'
      );
    } finally {
      setShareBusy(false);
    }
  };

  const handleDisableShare = async () => {
    if (!activeSubmission) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const res = await disableShareLink(activeSubmission.id, authToken);
      onSubmissionUpdated({
        ...activeSubmission,
        share: res.share,
      });
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : 'Could not disable shareable link.'
      );
    } finally {
      setShareBusy(false);
    }
  };

  const shareUrl =
    activeSubmission?.share?.enabled && activeSubmission.share.shareToken
      ? `${window.location.origin}/?passport=${encodeURIComponent(
          activeSubmission.share.shareToken
        )}`
      : null;

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section aria-labelledby="passport-heading" className="space-y-8">
      {/* Header (hidden on print) */}
      <div className="no-print border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
          <span>Digital Credential Record</span>
          <span aria-hidden="true">·</span>
          <span>PDF Printable</span>
          <span aria-hidden="true">·</span>
          <span>Revocable Share Link</span>
        </div>
        <h1
          id="passport-heading"
          className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl text-balance"
        >
          Skills Passport
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
          View your assessment result, score breakdown, and reviewer feedback. Print or save as a PDF anytime, or generate a shareable link once your review is verified.
        </p>
      </div>

      {/* Selector & Lookup Bar (hidden on print) */}
      <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-stone-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-sans text-sm font-semibold text-stone-900">
              Sample & Session Passports
            </h2>
            <span className="text-xs text-stone-500">
              Click any record to preview
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {sessionSubmissions.map((sub) => {
              const selected = activeSubmission?.id === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelectSubmission(sub, applicantTokens[sub.id])}
                  className={`min-h-[40px] rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    selected
                      ? 'border-blue-700 bg-blue-50 text-blue-900 font-semibold'
                      : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  <span>{sub.applicantName}</span>
                  <span className="ml-1.5 font-mono text-[11px] text-stone-500">
                    ({sub.id})
                  </span>
                </button>
              );
            })}

            {samples
              .filter((s) => !sessionSubmissions.some((sub) => sub.id === s.id))
              .map((sample) => {
                const selected = activeSubmission?.id === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleLoadSample(sample.id)}
                    className={`min-h-[40px] rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-blue-700 bg-blue-50 text-blue-900 font-semibold'
                        : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
                    }`}
                  >
                    <span>{sample.applicantName}</span>
                    <span className="ml-1.5 text-[11px] text-stone-500">
                      · {sample.status === 'verified' ? `${sample.totalScore}/100` : sample.status.replace('_', ' ')}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <form
          onSubmit={handleLookupSubmit}
          className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 space-y-3"
        >
          <h2 className="font-sans text-sm font-semibold text-stone-900">
            Look Up Private Passport
          </h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input
              type="text"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Submission ID (SUB-...)"
              aria-label="Submission ID"
              className="min-h-[40px] rounded-lg border border-stone-300 px-3 py-1.5 font-mono text-xs text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
            />
            <input
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="Access Code (KEY-...)"
              aria-label="Access Code"
              className="min-h-[40px] rounded-lg border border-stone-300 px-3 py-1.5 font-mono text-xs text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
            />
          </div>
          {lookupError && (
            <p role="alert" className="text-xs text-red-700">
              {lookupError}
            </p>
          )}
          <button
            type="submit"
            disabled={lookupLoading}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lookupLoading ? 'Loading...' : 'Retrieve Passport'}</span>
          </button>
        </form>
      </div>

      {/* Main Passport Document + Actions */}
      {!activeSubmission ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-600">
          Select a sample passport above or look up your Submission ID to view your Digital Skills Passport.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Official Printable Passport Document */}
          <article className="lg:col-span-8 print-passport rounded-xl border border-stone-300 bg-white p-6 sm:p-10">
            {/* Institutional Header */}
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-blue-900">
                  <ShieldCheck className="h-4 w-4 text-blue-800" aria-hidden="true" />
                  <span>AI Skill Passport · Credential Recognition</span>
                </div>
                <p className="text-xs text-stone-500">
                  PLP Africa / ILO PROSPECTS Track 1 Practical Assessment Record
                </p>
              </div>
              <div className="font-mono text-xs tabular-nums text-stone-600 sm:text-right">
                <div>Credential ID: {activeSubmission.id}</div>
                <div>
                  {activeSubmission.review
                    ? `Reviewed ${formatShortDate(activeSubmission.review.reviewedAt)}`
                    : `Submitted ${formatShortDate(activeSubmission.createdAt)}`}
                </div>
              </div>
            </div>

            {/* Applicant & Skill Identity */}
            <div className="mt-6 flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-medium text-stone-500">
                  Applicant Name
                </div>
                <h2 className="mt-0.5 font-display text-3xl font-semibold tracking-tight text-stone-900">
                  {activeSubmission.applicantName}
                </h2>
                <div className="mt-3 text-xs font-medium text-stone-500">
                  Assessed Practical Skill
                </div>
                <p className="mt-0.5 text-base font-semibold text-stone-900">
                  {activeSubmission.skillTitle}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2">
                <StatusIndicator status={activeSubmission.status} />
                {activeSubmission.review && (
                  <div className="mt-1 sm:text-right">
                    <div className="text-xs text-stone-500">Total Score</div>
                    <div className="font-mono text-3xl font-semibold tabular-nums text-stone-900">
                      {activeSubmission.review.totalScore}
                      <span className="text-lg font-normal text-stone-500">
                        {' '}
                        / 100
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Score Breakdown or Pending Notice */}
            {activeSubmission.review ? (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="font-sans text-sm font-semibold text-stone-900">
                    100-Point Rubric Breakdown
                  </h3>
                  <div className="mt-3 divide-y divide-stone-100 border-t border-b border-stone-200">
                    {RUBRIC_CRITERIA.map((criterion) => {
                      const earned = activeSubmission.review!.scores[criterion.key];
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
                    <h3 className="font-sans text-sm font-semibold text-stone-900">
                      Assessor Feedback
                    </h3>
                    <span className="text-xs text-stone-500">
                      Reviewed by {activeSubmission.review.reviewerName}
                    </span>
                  </div>
                  <p className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 text-sm leading-relaxed text-stone-700">
                    {activeSubmission.review.feedback}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-6 space-y-3">
                <h3 className="font-sans text-sm font-semibold text-stone-900">
                  Awaiting Manual Review
                </h3>
                <p className="text-sm leading-relaxed text-stone-600">
                  This submission is saved in the database and queued for rubric evaluation. Once scored by a reviewer, your breakdown, review date, and decision will appear here.
                </p>
                <button
                  type="button"
                  onClick={() => onGoToReview(activeSubmission.id)}
                  className="no-print min-h-[40px] rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 cursor-pointer"
                >
                  Review This Submission Now
                </button>
              </div>
            )}

            {/* Footer Privacy Attestation */}
            <div className="mt-8 flex flex-col gap-2 border-t border-stone-200 pt-4 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-stone-500 shrink-0" aria-hidden="true" />
                <span>
                  Submitted portfolio evidence links are private by default.
                </span>
              </div>
              <span className="font-mono">
                {activeSubmission.review
                  ? `Decision Date: ${formatShortDate(activeSubmission.review.reviewedAt)}`
                  : 'Status: Pending'}
              </span>
            </div>
          </article>

          {/* Actions Column (Print PDF & Shareable Link Management) */}
          <aside className="no-print lg:col-span-4 space-y-5">
            {/* Print / Save as PDF */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
              <h2 className="font-sans text-sm font-semibold text-stone-900">
                Export Credential
              </h2>
              <p className="text-xs leading-relaxed text-stone-600">
                Print an official copy or choose <strong>Save as PDF</strong> in your browser’s print dialog.
              </p>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 cursor-pointer"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Print / Save as PDF</span>
              </button>
            </div>

            {/* Shareable Link Controls */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div>
                <h2 className="font-sans text-sm font-semibold text-stone-900">
                  Shareable Employer Link
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Share verified skill proof with employers or training partners without exposing private evidence links.
                </p>
              </div>

              {activeSubmission.status !== 'verified' ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3.5 text-xs leading-relaxed text-stone-600">
                  Shareable links are available only after a <strong>Verified</strong> review decision.
                </div>
              ) : shareUrl ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-900">
                      Shareable link is active
                    </div>
                    <div className="break-all font-mono text-[11px] text-stone-700">
                      {shareUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyShareUrl}
                      className="inline-flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900 whitespace-nowrap cursor-pointer"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewPublicLink(activeSubmission.share!.shareToken)
                      }
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 whitespace-nowrap cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={handleDisableShare}
                    className="inline-flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {shareBusy ? 'Disabling...' : 'Disable Share Link'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSubmission.share && !activeSubmission.share.enabled && (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                      Your previous shareable link has been disabled. Create a new link whenever you are ready to share again.
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeExplanation}
                      onChange={(e) => setIncludeExplanation(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-blue-800"
                    />
                    <span>
                      Include my project explanation on the public passport (kept private by default)
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={handleCreateShare}
                    className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-50 cursor-pointer"
                  >
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {shareBusy ? 'Creating link...' : 'Create Shareable Link'}
                    </span>
                  </button>
                </div>
              )}

              {shareError && (
                <p role="alert" className="text-xs text-red-700">
                  {shareError}
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
