import { useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  FileCode2,
  Globe,
  Image as ImageIcon,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { isSafeHttpUrl, submitEvidence } from '../api';
import {
  ASSESSMENT_TITLE,
  EVIDENCE_TYPE_LABELS,
  RUBRIC_CRITERIA,
  type EvidenceType,
  type SubmissionRecord,
} from '../types';

interface DraftEvidenceLink {
  localId: string;
  type: EvidenceType;
  url: string;
  label: string;
}

interface SubmitEvidenceSectionProps {
  onSubmitted: (result: {
    submission: SubmissionRecord;
    accessCode: string;
    applicantToken: string;
  }) => void;
  onGoToPassport: (submission: SubmissionRecord) => void;
  onGoToReview: (submissionId: string) => void;
}

function createEmptyLink(type: EvidenceType = 'live'): DraftEvidenceLink {
  return {
    localId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    url: '',
    label: '',
  };
}

export function SubmitEvidenceSection({
  onSubmitted,
  onGoToPassport,
  onGoToReview,
}: SubmitEvidenceSectionProps) {
  const [applicantName, setApplicantName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [links, setLinks] = useState<DraftEvidenceLink[]>([
    createEmptyLink('live'),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    submission: SubmissionRecord;
    accessCode: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleAddLink = () => {
    if (links.length >= 10) return;
    const nextType: EvidenceType =
      links.length === 1 ? 'repo' : links.length === 2 ? 'screenshot' : 'live';
    setLinks((prev) => [...prev, createEmptyLink(nextType)]);
  };

  const handleRemoveLink = (localId: string) => {
    if (links.length <= 1) return;
    setLinks((prev) => prev.filter((item) => item.localId !== localId));
  };

  const handleUpdateLink = (
    localId: string,
    field: 'type' | 'url' | 'label',
    value: string
  ) => {
    setLinks((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleFillSample = () => {
    setApplicantName('Samuel Niyonsenga');
    setExplanation(
      'Built a responsive personal portfolio website using semantic HTML5 landmarks, CSS Flexbox and Grid, and mobile-first breakpoints at 480px and 900px. Added descriptive alt text for project previews, visible keyboard focus rings, and a clean contact section.'
    );
    setLinks([
      {
        localId: 'sample-1',
        type: 'live',
        url: 'https://samuel-niyonsenga.example.org',
        label: 'Live portfolio site',
      },
      {
        localId: 'sample-2',
        type: 'repo',
        url: 'https://github.com/samuel-n/responsive-portfolio',
        label: 'GitHub repository',
      },
      {
        localId: 'sample-3',
        type: 'screenshot',
        url: 'https://placehold.co/1200x760/png?text=Portfolio+Responsive+Preview',
        label: 'Desktop and phone screenshots',
      },
    ]);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = applicantName.trim();
    const trimmedExplanation = explanation.trim();

    if (trimmedName.length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (trimmedExplanation.length < 15) {
      setError(
        'Please write a short explanation of how you built your portfolio (at least 15 characters).'
      );
      return;
    }

    const nonEmptyLinks = links.filter((l) => l.url.trim().length > 0);
    if (nonEmptyLinks.length === 0) {
      setError(
        'Please include at least one evidence link (live website, source code repository, or screenshots).'
      );
      return;
    }

    for (let i = 0; i < nonEmptyLinks.length; i += 1) {
      if (!isSafeHttpUrl(nonEmptyLinks[i].url.trim())) {
        setError(
          `Evidence link #${i + 1} must start with https:// or http:// and be a valid URL.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await submitEvidence({
        applicantName: trimmedName,
        explanation: trimmedExplanation,
        evidenceLinks: nonEmptyLinks.map((l) => ({
          type: l.type,
          url: l.url.trim(),
          label: l.label.trim() || undefined,
        })),
      });

      setReceipt({
        submission: result.submission,
        accessCode: result.accessCode,
      });
      onSubmitted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setReceipt(null);
    setApplicantName('');
    setExplanation('');
    setLinks([createEmptyLink('live')]);
    setError(null);
  };

  const handleCopyCredentials = async () => {
    if (!receipt) return;
    const text = `Submission ID: ${receipt.submission.id}\nAccess Code: ${receipt.accessCode}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <section aria-labelledby="submit-heading" className="space-y-8">
      <div className="border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
          <span>Assessment 01</span>
          <span aria-hidden="true">·</span>
          <span>100-Point Practical Rubric</span>
          <span aria-hidden="true">·</span>
          <span>Evidence Private by Default</span>
        </div>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="submit-heading"
              className="font-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl text-balance"
            >
              Submit Evidence
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
              Demonstrate your practical skill for{' '}
              <strong className="font-semibold text-stone-900">
                {ASSESSMENT_TITLE}
              </strong>{' '}
              using your live work, code repository, or screenshots—no formal certificate required.
            </p>
          </div>

          {!receipt && (
            <button
              type="button"
              onClick={handleFillSample}
              className="min-h-[40px] self-start rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Fill sample submission
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Main Submission Column */}
        <div className="lg:col-span-7">
          {receipt ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Evidence Saved Privately
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-stone-900">
                    Submission Received
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Submitted by <span className="font-medium text-stone-900">{receipt.submission.applicantName}</span> for {ASSESSMENT_TITLE}.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-stone-500">
                      Save your private credentials to look up your passport later
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-sm tabular-nums text-stone-900">
                      <span>
                        ID: <strong>{receipt.submission.id}</strong>
                      </span>
                      <span>
                        Access Code: <strong>{receipt.accessCode}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-stone-600" aria-hidden="true" />
                        <span>Copy credentials</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onGoToReview(receipt.submission.id)}
                  className="min-h-[44px] rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Review This Submission
                </button>
                <button
                  type="button"
                  onClick={() => onGoToPassport(receipt.submission)}
                  className="min-h-[44px] rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  View Skills Passport
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="min-h-[44px] px-3 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Submit another
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-stone-200 bg-white p-5 sm:p-7 space-y-6"
              noValidate
            >
              <div>
                <label
                  htmlFor="applicant-name"
                  className="block text-sm font-semibold text-stone-900"
                >
                  Applicant Name
                </label>
                <p className="mt-0.5 text-xs text-stone-500">
                  Your name as it should appear on your Digital Skills Passport.
                </p>
                <input
                  id="applicant-name"
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="e.g. Amina Hassan"
                  className="mt-2 w-full min-h-[44px] rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="portfolio-explanation"
                    className="block text-sm font-semibold text-stone-900"
                  >
                    How You Built Your Portfolio
                  </label>
                  <span className="font-mono text-xs tabular-nums text-stone-400">
                    {explanation.length} / 3000
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  Briefly explain your HTML structure, CSS styling, how you handled mobile vs. laptop screens, and any accessibility steps you took.
                </p>
                <textarea
                  id="portfolio-explanation"
                  required
                  rows={5}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Example: I structured my page with header, main, and footer landmarks, used CSS Grid with a single-column mobile fallback under 640px, and checked contrast and alt text..."
                  className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                />
              </div>

              <div className="space-y-3 border-t border-stone-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-sans text-sm font-semibold text-stone-900">
                      Evidence Links (At Least One Required)
                    </h2>
                    <p className="text-xs text-stone-500">
                      Add a live website URL, source code repository, or screenshot links.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    disabled={links.length >= 10}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Add link</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {links.map((link, idx) => (
                    <div
                      key={link.localId}
                      className="rounded-lg border border-stone-200 bg-stone-50/70 p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium text-stone-500 tabular-nums">
                          Evidence #{idx + 1}
                        </span>
                        {links.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLink(link.localId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-red-700 cursor-pointer"
                            aria-label={`Remove evidence link ${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-5">
                          <label
                            htmlFor={`link-type-${link.localId}`}
                            className="block text-xs font-medium text-stone-700"
                          >
                            Evidence type
                          </label>
                          <select
                            id={`link-type-${link.localId}`}
                            value={link.type}
                            onChange={(e) =>
                              handleUpdateLink(link.localId, 'type', e.target.value)
                            }
                            className="mt-1 w-full min-h-[44px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                          >
                            <option value="live">{EVIDENCE_TYPE_LABELS.live}</option>
                            <option value="repo">{EVIDENCE_TYPE_LABELS.repo}</option>
                            <option value="screenshot">{EVIDENCE_TYPE_LABELS.screenshot}</option>
                          </select>
                        </div>

                        <div className="sm:col-span-7">
                          <label
                            htmlFor={`link-url-${link.localId}`}
                            className="block text-xs font-medium text-stone-700"
                          >
                            URL (https://...)
                          </label>
                          <input
                            id={`link-url-${link.localId}`}
                            type="url"
                            required={idx === 0}
                            value={link.url}
                            onChange={(e) =>
                              handleUpdateLink(link.localId, 'url', e.target.value)
                            }
                            placeholder={
                              link.type === 'live'
                                ? 'https://your-portfolio.netlify.app'
                                : link.type === 'repo'
                                ? 'https://github.com/username/portfolio'
                                : 'https://imgur.com/your-screenshot'
                            }
                            className="mt-1 w-full min-h-[44px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`link-label-${link.localId}`}
                          className="block text-xs font-medium text-stone-700"
                        >
                          Optional note (e.g. Mobile viewport screenshot)
                        </label>
                        <input
                          id={`link-label-${link.localId}`}
                          type="text"
                          value={link.label}
                          onChange={(e) =>
                            handleUpdateLink(link.localId, 'label', e.target.value)
                          }
                          placeholder="Short description of this link"
                          className="mt-1 w-full min-h-[40px] rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-700 focus:outline-2 focus:outline-blue-700/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5 text-xs leading-relaxed text-stone-600">
                <Lock className="mt-0.5 h-4 w-4 text-stone-700 shrink-0" aria-hidden="true" />
                <div>
                  <strong className="font-semibold text-stone-900">
                    Submitted evidence is private by default.
                  </strong>{' '}
                  Only you and authorized assessors can open your submitted links and project explanation. Public shareable passport links display your verified score breakdown and decision only.
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto min-h-[44px] rounded-lg bg-blue-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Saving submission...' : 'Submit Portfolio Evidence'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Assessment Reference Column */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-stone-900">
              How Your Work Is Assessed
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Trained reviewers evaluate practical deliverables manually against a transparent 100-point rubric.
            </p>

            <dl className="mt-4 divide-y divide-stone-100 border-t border-stone-200">
              {RUBRIC_CRITERIA.map((criterion) => (
                <div key={criterion.key} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm font-semibold text-stone-900">
                      {criterion.label}
                    </dt>
                    <dd className="font-mono text-xs font-semibold tabular-nums text-blue-800 whitespace-nowrap shrink-0">
                      {criterion.maxPoints} pts
                    </dd>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    {criterion.guidance}
                  </p>
                </div>
              ))}
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-sm font-semibold text-stone-900">
              <span>Total Rubric Score</span>
              <span className="font-mono tabular-nums">100 points</span>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6 space-y-3">
            <h3 className="font-sans text-sm font-semibold text-stone-900">
              Accepted Evidence Formats
            </h3>
            <ul className="space-y-2.5 text-xs text-stone-600">
              <li className="flex items-start gap-2.5">
                <Globe className="mt-0.5 h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-stone-900">Live website:</strong> GitHub Pages, Netlify, Vercel, or any hosted URL.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <FileCode2 className="mt-0.5 h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-stone-900">Source code repository:</strong> GitHub, GitLab, CodePen, or Glitch link.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ImageIcon className="mt-0.5 h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-stone-900">Screenshots:</strong> Links to desktop and phone screen captures if hosting is unavailable.
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
