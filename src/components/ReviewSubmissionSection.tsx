import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Globe,
  Image as ImageIcon,
  Lock,
  XCircle,
} from 'lucide-react';
import {
  authenticateReviewer,
  fetchReviewerStatus,
  fetchReviewerSubmissions,
  isSafeHttpUrl,
  submitReview,
} from '../api';
import {
  EVIDENCE_TYPE_LABELS,
  formatShortDate,
  RUBRIC_CRITERIA,
  sumRubricScores,
  type ReviewDecision,
  type RubricScores,
  type SubmissionRecord,
} from '../types';
import { StatusIndicator } from './StatusIndicator';

interface ReviewSubmissionSectionProps {
  reviewerToken: string | null;
  onReviewerAuthenticated: (token: string) => void;
  preferredSubmissionId?: string | null;
  onReviewSaved: (updated: SubmissionRecord) => void;
  onViewPassport: (submission: SubmissionRecord) => void;
}

const DEFAULT_SCORES: RubricScores = {
  html: 16,
  css: 16,
  responsive: 20,
  accessibility: 12,
  codeQuality: 8,
  explanation: 8,
};

export function ReviewSubmissionSection({
  reviewerToken,
  onReviewerAuthenticated,
  preferredSubmissionId,
  onReviewSaved,
  onViewPassport,
}: ReviewSubmissionSectionProps) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    preferredSubmissionId || null
  );

  // Rubric form state
  const [reviewerName, setReviewerName] = useState('PLP / PROSPECTS Assessor');
  const [scores, setScores] = useState<RubricScores>(DEFAULT_SCORES);
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<ReviewDecision>('verified');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<SubmissionRecord | null>(null);

  // Initialize reviewer session status
  useEffect(() => {
    let active = true;
    async function init() {
      setCheckingAuth(true);
      try {
        const status = await fetchReviewerStatus();
        if (!active) return;
        setRequiresPasscode(status.requiresPasscode);
        if (!status.requiresPasscode && !reviewerToken) {
          const auth = await authenticateReviewer();
          if (!active) return;
          onReviewerAuthenticated(auth.reviewerToken);
        }
      } catch (err) {
        if (!active) return;
        setAuthError(
          err instanceof Error ? err.message : 'Failed to initialize reviewer workspace.'
        );
      } finally {
        if (active) setCheckingAuth(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [reviewerToken, onReviewerAuthenticated]);

  // Fetch submissions once authenticated
  useEffect(() => {
    if (!reviewerToken) return;
    let active = true;
    async function load() {
      setLoadingList(true);
      try {
        const rows = await fetchReviewerSubmissions(reviewerToken!);
        if (!active) return;
        setSubmissions(rows);
        if (preferredSubmissionId && rows.some((r) => r.id === preferredSubmissionId)) {
          setSelectedId(preferredSubmissionId);
        } else if (rows.length > 0 && (!selectedId || !rows.some((r) => r.id === selectedId))) {
          const firstPending = rows.find((r) => r.status === 'pending');
          setSelectedId((firstPending || rows[0]).id);
        }
      } catch (err) {
        if (!active) return;
        setSaveError(
          err instanceof Error ? err.message : 'Unable to load submissions.'
        );
      } finally {
        if (active) setLoadingList(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [reviewerToken, preferredSubmissionId]);

  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.id === selectedId) || null,
    [submissions, selectedId]
  );

  // Populate form when selected submission changes
  useEffect(() => {
    setSaveError(null);
    setSavedNotice(null);
    if (!selectedSubmission) return;
    if (selectedSubmission.review) {
      setReviewerName(selectedSubmission.review.reviewerName);
      setScores(selectedSubmission.review.scores);
      setFeedback(selectedSubmission.review.feedback);
      setDecision(selectedSubmission.review.decision);
    } else {
      setScores(DEFAULT_SCORES);
      setFeedback('');
      setDecision('verified');
    }
  }, [selectedSubmission?.id]);

  const filteredSubmissions = useMemo(() => {
    if (filter === 'pending') {
      return submissions.filter((s) => s.status === 'pending');
    }
    if (filter === 'reviewed') {
      return submissions.filter((s) => s.status !== 'pending');
    }
    return submissions;
  }, [submissions, filter]);

  const totalScore = sumRubricScores(scores);

  const handlePasscodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const auth = await authenticateReviewer(passcodeInput);
      onReviewerAuthenticated(auth.reviewerToken);
      setPasscodeInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid passcode.');
    }
  };

  const handleScoreChange = (key: keyof RubricScores, max: number, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const clamped = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(max, parsed));
    setScores((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewerToken || !selectedSubmission) return;
    setSaveError(null);
    setSavedNotice(null);

    if (feedback.trim().length < 5) {
      setSaveError('Please enter written feedback for the applicant (at least 5 characters).');
      return;
    }

    setSaving(true);
    try {
      const result = await submitReview(reviewerToken, {
        submissionId: selectedSubmission.id,
        reviewerName: reviewerName.trim() || 'PLP / PROSPECTS Assessor',
        scores,
        feedback: feedback.trim(),
        decision,
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === result.submission.id ? result.submission : item
        )
      );
      setSavedNotice(result.submission);
      onReviewSaved(result.submission);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save review.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        Preparing reviewer workspace...
      </div>
    );
  }

  if (!reviewerToken && requiresPasscode) {
    return (
      <section aria-labelledby="reviewer-auth-heading" className="mx-auto max-w-md py-8">
        <form
          onSubmit={handlePasscodeSubmit}
          className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center gap-2.5 text-stone-900">
            <Lock className="h-5 w-5 text-blue-800" aria-hidden="true" />
            <h1 id="reviewer-auth-heading" className="font-display text-xl font-semibold">
              Reviewer Access
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-stone-600">
            Submitted evidence is private by default. Enter the reviewer passcode to inspect applicant links and complete rubric assessments.
          </p>
          <div>
            <label htmlFor="reviewer-passcode" className="block text-sm font-medium text-stone-800">
              Reviewer Passcode
            </label>
            <input
              id="reviewer-passcode"
              type="password"
              required
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              className="mt-1.5 w-full min-h-[44px] rounded-lg border border-stone-300 px-3.5 py-2 text-sm focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
            />
          </div>
          {authError && (
            <p role="alert" className="text-sm text-red-700">
              {authError}
            </p>
          )}
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 cursor-pointer"
          >
            Unlock Review Workspace
          </button>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="review-heading" className="space-y-8">
      <div className="border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
          <span>Manual Rubric Evaluation</span>
          <span aria-hidden="true">·</span>
          <span>100 Points Maximum</span>
          <span aria-hidden="true">·</span>
          <span>Sample Data Preloaded</span>
        </div>
        <h1
          id="review-heading"
          className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl text-balance"
        >
          Review Submission
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
          Inspect the applicant’s private evidence links and portfolio explanation, assign manual scores across all six rubric criteria, and record your written feedback and decision.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Submission Queue Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200">
              <h2 className="font-sans text-sm font-semibold text-stone-900">
                Submissions ({submissions.length})
              </h2>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-stone-100 p-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'reviewed', label: 'Reviewed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    filter === tab.id
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingList ? (
              <div className="py-8 text-center text-xs text-stone-500">
                Loading submissions...
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                No submissions match this filter.
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-stone-100">
                {filteredSubmissions.map((item) => {
                  const isSelected = item.id === selectedSubmission?.id;
                  return (
                    <li key={item.id} className="py-1.5 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full rounded-lg p-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 ring-1 ring-blue-200'
                            : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-stone-900 truncate">
                            {item.applicantName}
                          </span>
                          {item.review && (
                            <span className="font-mono text-xs font-semibold tabular-nums text-stone-700 shrink-0">
                              {item.review.totalScore}/100
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                          <span className="font-mono">{item.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatShortDate(item.createdAt)}</span>
                          {item.isSample && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Sample</span>
                            </>
                          )}
                        </div>
                        <div className="mt-2">
                          <StatusIndicator status={item.status} compact />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Selected Submission Inspector & Rubric Form */}
        <div className="lg:col-span-8">
          {!selectedSubmission ? (
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
              Select a submission from the list to inspect evidence and score the rubric.
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-7 space-y-7">
              {/* Applicant Overview */}
              <div className="flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="font-mono">{selectedSubmission.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Submitted {formatShortDate(selectedSubmission.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Private Evidence</span>
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-stone-900">
                    {selectedSubmission.applicantName}
                  </h2>
                  <p className="mt-0.5 text-xs text-stone-600">
                    {selectedSubmission.skillTitle}
                  </p>
                </div>
                <StatusIndicator status={selectedSubmission.status} />
              </div>

              {/* Private Evidence Links */}
              <div className="space-y-3">
                <h3 className="font-sans text-sm font-semibold text-stone-900">
                  Submitted Evidence Links
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {selectedSubmission.evidenceLinks.map((link) => {
                    const safe = isSafeHttpUrl(link.url);
                    const Icon =
                      link.type === 'live'
                        ? Globe
                        : link.type === 'repo'
                        ? FileCode2
                        : ImageIcon;

                    return safe ? (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
                            <Icon className="h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                            <span>{EVIDENCE_TYPE_LABELS[link.type]}</span>
                          </div>
                          {link.label && (
                            <p className="mt-1 text-xs text-stone-600 truncate">
                              {link.label}
                            </p>
                          )}
                          <p className="mt-0.5 font-mono text-[11px] text-stone-500 truncate">
                            {link.url}
                          </p>
                        </div>
                        <ExternalLink
                          className="h-4 w-4 text-stone-400 shrink-0"
                          aria-label="Opens in new tab"
                        />
                      </a>
                    ) : (
                      <div
                        key={link.id}
                        className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500"
                      >
                        Invalid URL withheld
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project Explanation */}
              <div className="space-y-2 border-b border-stone-200 pb-6">
                <h3 className="font-sans text-sm font-semibold text-stone-900">
                  Applicant’s Project Explanation
                </h3>
                <p className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 text-sm leading-relaxed text-stone-700">
                  {selectedSubmission.explanation}
                </p>
              </div>

              {/* 100-Point Manual Rubric Form */}
              <form onSubmit={handleSubmitReview} className="space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-stone-900">
                      100-Point Scoring Rubric
                    </h3>
                    <p className="text-xs text-stone-500">
                      Enter manual scores for each criterion based on your inspection.
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-right">
                    <div className="text-[11px] font-medium text-stone-500">
                      Total Score
                    </div>
                    <div className="font-mono text-xl font-semibold tabular-nums text-stone-900">
                      {totalScore} / 100
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-stone-50/40 px-4">
                  {RUBRIC_CRITERIA.map((criterion) => {
                    const value = scores[criterion.key];
                    return (
                      <div key={criterion.key} className="py-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label
                              htmlFor={`score-${criterion.key}`}
                              className="text-sm font-semibold text-stone-900"
                            >
                              {criterion.label}
                            </label>
                            <p className="text-xs text-stone-500">
                              {criterion.guidance}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              id={`score-${criterion.key}`}
                              type="number"
                              min={0}
                              max={criterion.maxPoints}
                              step={1}
                              value={value}
                              onChange={(e) =>
                                handleScoreChange(
                                  criterion.key,
                                  criterion.maxPoints,
                                  e.target.value
                                )
                              }
                              className="w-16 min-h-[40px] rounded-md border border-stone-300 bg-white px-2 py-1 text-right font-mono text-sm font-semibold tabular-nums text-stone-900 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                            />
                            <span className="font-mono text-xs tabular-nums text-stone-500">
                              / {criterion.maxPoints}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={criterion.maxPoints}
                            step={1}
                            value={value}
                            aria-label={`${criterion.label} slider`}
                            onChange={(e) =>
                              handleScoreChange(
                                criterion.key,
                                criterion.maxPoints,
                                e.target.value
                              )
                            }
                            className="h-2 w-full cursor-pointer accent-blue-800"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reviewer Name & Feedback */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="reviewer-name"
                      className="block text-sm font-semibold text-stone-900"
                    >
                      Reviewer Name / Affiliation
                    </label>
                    <input
                      id="reviewer-name"
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="e.g. Wanjiku Mwangi (PLP Mentor)"
                      className="mt-1.5 w-full min-h-[44px] rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="reviewer-feedback"
                      className="block text-sm font-semibold text-stone-900"
                    >
                      Written Feedback
                    </label>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Explain strengths and specific improvements. Appears on the applicant’s Skills Passport.
                    </p>
                    <textarea
                      id="reviewer-feedback"
                      required
                      rows={4}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Write constructive feedback based on the rubric..."
                      className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                    />
                  </div>
                </div>

                {/* Decision Selector */}
                <fieldset className="space-y-2.5">
                  <legend className="text-sm font-semibold text-stone-900">
                    Verification Decision
                  </legend>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {(
                      [
                        {
                          value: 'verified',
                          label: 'Verified',
                          hint: 'Issues verified Skills Passport',
                          icon: CheckCircle2,
                          activeClass:
                            'border-emerald-600 bg-emerald-50/70 text-emerald-900 ring-1 ring-emerald-600',
                          iconColor: 'text-emerald-700',
                        },
                        {
                          value: 'additional_evidence',
                          label: 'Additional Evidence Required',
                          hint: 'Applicant must resubmit updates',
                          icon: AlertCircle,
                          activeClass:
                            'border-amber-600 bg-amber-50/70 text-amber-900 ring-1 ring-amber-600',
                          iconColor: 'text-amber-700',
                        },
                        {
                          value: 'rejected',
                          label: 'Rejected',
                          hint: 'Does not meet assessment criteria',
                          icon: XCircle,
                          activeClass:
                            'border-red-600 bg-red-50/70 text-red-900 ring-1 ring-red-600',
                          iconColor: 'text-red-700',
                        },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const selected = decision === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDecision(option.value)}
                          aria-pressed={selected}
                          className={`flex min-h-[60px] flex-col items-start justify-center rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                            selected
                              ? option.activeClass
                              : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                selected ? option.iconColor : 'text-stone-500'
                              }`}
                              aria-hidden="true"
                            />
                            <span>{option.label}</span>
                          </div>
                          <span className="mt-1 text-[11px] text-stone-600">
                            {option.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {saveError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  >
                    {saveError}
                  </div>
                )}

                {savedNotice && (
                  <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-emerald-900">
                      <strong>Review saved.</strong> {savedNotice.applicantName}’s passport has been updated ({savedNotice.review?.totalScore}/100).
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewPassport(savedNotice)}
                      className="min-h-[40px] rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open Skills Passport
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto min-h-[44px] rounded-lg bg-blue-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-60 cursor-pointer"
                  >
                    {saving ? 'Saving review...' : 'Save Review & Update Passport'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
