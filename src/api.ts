import type {
  EvidenceLink,
  PublicPassportData,
  ReviewDecision,
  RubricScores,
  SampleSummary,
  ShareRecord,
  SubmissionRecord,
} from './types';

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function fetchSamples(): Promise<SampleSummary[]> {
  const data = await requestJson<{ samples: SampleSummary[] }>('/api/samples');
  return data.samples;
}

export async function submitEvidence(payload: {
  applicantName: string;
  explanation: string;
  evidenceLinks: Array<Pick<EvidenceLink, 'type' | 'url' | 'label'>>;
}): Promise<{
  submission: SubmissionRecord;
  accessCode: string;
  applicantToken: string;
}> {
  return requestJson('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function lookupSubmission(payload: {
  submissionId: string;
  accessCode?: string;
  token?: string;
}): Promise<{ submission: SubmissionRecord; applicantToken: string }> {
  return requestJson('/api/submissions/lookup', {
    method: 'POST',
    headers: payload.token ? { Authorization: `Bearer ${payload.token}` } : {},
    body: JSON.stringify({
      submissionId: payload.submissionId,
      accessCode: payload.accessCode,
    }),
  });
}

export async function fetchReviewerStatus(): Promise<{ requiresPasscode: boolean }> {
  return requestJson('/api/reviewer/status');
}

export async function authenticateReviewer(passcode?: string): Promise<{
  reviewerToken: string;
  demoMode: boolean;
}> {
  return requestJson('/api/reviewer/auth', {
    method: 'POST',
    body: JSON.stringify({ passcode }),
  });
}

export async function fetchReviewerSubmissions(reviewerToken: string): Promise<SubmissionRecord[]> {
  const data = await requestJson<{ submissions: SubmissionRecord[] }>('/api/reviewer/submissions', {
    headers: {
      Authorization: `Bearer ${reviewerToken}`,
    },
  });
  return data.submissions;
}

export async function submitReview(
  reviewerToken: string,
  payload: {
    submissionId: string;
    reviewerName: string;
    scores: RubricScores;
    feedback: string;
    decision: ReviewDecision;
  }
): Promise<{ submission: SubmissionRecord }> {
  return requestJson('/api/reviewer/reviews', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${reviewerToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function enableShareLink(
  submissionId: string,
  includeExplanation: boolean,
  token?: string
): Promise<{ share: ShareRecord }> {
  return requestJson(`/api/submissions/${encodeURIComponent(submissionId)}/share`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ includeExplanation }),
  });
}

export async function disableShareLink(
  submissionId: string,
  token?: string
): Promise<{ share: ShareRecord | null }> {
  return requestJson(`/api/submissions/${encodeURIComponent(submissionId)}/share`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function fetchPublicPassport(shareToken: string): Promise<PublicPassportData> {
  const data = await requestJson<{ passport: PublicPassportData }>(
    `/api/passports/share/${encodeURIComponent(shareToken)}`
  );
  return data.passport;
}
