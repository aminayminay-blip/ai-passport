import { useCallback, useEffect, useState } from 'react';
import { fetchSamples, lookupSubmission } from './api';
import { Header } from './components/Header';
import { PublicPassportView } from './components/PublicPassportView';
import { ReviewSubmissionSection } from './components/ReviewSubmissionSection';
import { SkillsPassportSection } from './components/SkillsPassportSection';
import { SubmitEvidenceSection } from './components/SubmitEvidenceSection';
import type { AppSection, SampleSummary, SubmissionRecord } from './types';

function readPassportQueryParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('passport');
  return token ? token.trim() : null;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('submit');
  const [publicShareToken, setPublicShareToken] = useState<string | null>(() =>
    readPassportQueryParam()
  );

  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [sessionSubmissions, setSessionSubmissions] = useState<SubmissionRecord[]>([]);
  const [activePassport, setActivePassport] = useState<SubmissionRecord | null>(null);
  const [applicantTokens, setApplicantTokens] = useState<Record<string, string>>({});
  const [reviewerToken, setReviewerToken] = useState<string | null>(null);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setPublicShareToken(readPassportQueryParam());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialSamples() {
      try {
        const list = await fetchSamples();
        if (!active) return;
        setSamples(list);
        const verifiedSample = list.find((s) => s.status === 'verified') || list[0];
        if (verifiedSample) {
          const res = await lookupSubmission({ submissionId: verifiedSample.id });
          if (!active) return;
          setActivePassport(res.submission);
          setApplicantTokens((prev) => ({
            ...prev,
            [res.submission.id]: res.applicantToken,
          }));
        }
      } catch {
        // Non-blocking initial sample load
      }
    }
    loadInitialSamples();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmitted = useCallback(
    (result: {
      submission: SubmissionRecord;
      accessCode: string;
      applicantToken: string;
    }) => {
      setSessionSubmissions((prev) => [
        result.submission,
        ...prev.filter((s) => s.id !== result.submission.id),
      ]);
      setApplicantTokens((prev) => ({
        ...prev,
        [result.submission.id]: result.applicantToken,
      }));
      setActivePassport(result.submission);
    },
    []
  );

  const handleReviewSaved = useCallback((updated: SubmissionRecord) => {
    setSessionSubmissions((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setActivePassport((prev) => (prev?.id === updated.id ? updated : prev));
    fetchSamples()
      .then((list) => setSamples(list))
      .catch(() => {});
  }, []);

  const handleSelectPassport = useCallback(
    (submission: SubmissionRecord, token?: string) => {
      setActivePassport(submission);
      if (token) {
        setApplicantTokens((prev) => ({
          ...prev,
          [submission.id]: token,
        }));
      }
    },
    []
  );

  const handleSubmissionUpdated = useCallback((updated: SubmissionRecord) => {
    setActivePassport((prev) => (prev?.id === updated.id ? updated : prev));
    setSessionSubmissions((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }, []);

  const handleOpenPublicPreview = useCallback((shareToken: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('passport', shareToken);
    window.history.pushState({}, '', url.toString());
    setPublicShareToken(shareToken);
  }, []);

  const handleExitPublicView = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('passport');
    window.history.pushState({}, '', url.toString());
    setPublicShareToken(null);
  }, []);

  const handleQuickPassport = useCallback(async () => {
    setActiveSection('passport');
    if (activePassport) return;
    const target = samples.find((s) => s.status === 'verified') || samples[0];
    if (target) {
      try {
        const res = await lookupSubmission({ submissionId: target.id });
        handleSelectPassport(res.submission, res.applicantToken);
      } catch {
        // Ignore
      }
    }
  }, [activePassport, samples, handleSelectPassport]);

  if (publicShareToken) {
    return (
      <PublicPassportView
        shareToken={publicShareToken}
        onExitPublicView={handleExitPublicView}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F9F8F5] text-stone-900">
      <Header
        activeSection={activeSection}
        onNavigate={(section) => setActiveSection(section)}
        onQuickPassport={handleQuickPassport}
      />

      {/* Institutional Program Strip */}
      <div className="no-print border-b border-stone-200 bg-stone-100/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2.5 text-xs text-stone-600 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-800">
              PLP Africa / ILO PROSPECTS Mini Hackathon
            </span>
            <span aria-hidden="true">·</span>
            <span>Track 1 — Credential Recognition</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-stone-500">
            <span>Practical skill verification without formal certificates</span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {activeSection === 'submit' && (
          <SubmitEvidenceSection
            onSubmitted={handleSubmitted}
            onGoToPassport={(submission) => {
              setActivePassport(submission);
              setActiveSection('passport');
            }}
            onGoToReview={(submissionId) => {
              setReviewTargetId(submissionId);
              setActiveSection('review');
            }}
          />
        )}

        {activeSection === 'review' && (
          <ReviewSubmissionSection
            reviewerToken={reviewerToken}
            onReviewerAuthenticated={setReviewerToken}
            preferredSubmissionId={reviewTargetId}
            onReviewSaved={handleReviewSaved}
            onViewPassport={(submission) => {
              setActivePassport(submission);
              setActiveSection('passport');
            }}
          />
        )}

        {activeSection === 'passport' && (
          <SkillsPassportSection
            activeSubmission={activePassport}
            sessionSubmissions={sessionSubmissions}
            samples={samples}
            applicantTokens={applicantTokens}
            reviewerToken={reviewerToken}
            onSelectSubmission={handleSelectPassport}
            onSubmissionUpdated={handleSubmissionUpdated}
            onPreviewPublicLink={handleOpenPublicPreview}
            onGoToReview={(submissionId) => {
              setReviewTargetId(submissionId);
              setActiveSection('review');
            }}
          />
        )}
      </main>

      <footer className="no-print border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            AI Skill Passport · Practical Credential Recognition Pilot
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('submit')}
              className="hover:text-stone-900 cursor-pointer"
            >
              Submit Evidence
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('review')}
              className="hover:text-stone-900 cursor-pointer"
            >
              Review Submission
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('passport')}
              className="hover:text-stone-900 cursor-pointer"
            >
              Skills Passport
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
