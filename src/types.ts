export type EvidenceType = 'live' | 'repo' | 'screenshot';

export type ReviewDecision = 'verified' | 'additional_evidence' | 'rejected';

export type SubmissionStatus = 'pending' | ReviewDecision;

export type AppSection = 'submit' | 'review' | 'passport';

export interface EvidenceLink {
  id: string;
  type: EvidenceType;
  url: string;
  label?: string;
}

export interface RubricScores {
  html: number;
  css: number;
  responsive: number;
  accessibility: number;
  codeQuality: number;
  explanation: number;
}

export interface ReviewRecord {
  id: string;
  submissionId: string;
  reviewerName: string;
  scores: RubricScores;
  totalScore: number;
  feedback: string;
  decision: ReviewDecision;
  reviewedAt: string;
}

export interface ShareRecord {
  shareToken: string;
  enabled: boolean;
  includeExplanation: boolean;
  createdAt: string;
  disabledAt?: string | null;
}

export interface SubmissionRecord {
  id: string;
  applicantName: string;
  skillTitle: string;
  explanation: string;
  evidenceLinks: EvidenceLink[];
  evidencePrivate: boolean;
  isSample: boolean;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  review: ReviewRecord | null;
  share: ShareRecord | null;
}

export interface SampleSummary {
  id: string;
  applicantName: string;
  skillTitle: string;
  status: SubmissionStatus;
  totalScore: number | null;
  createdAt: string;
  sampleNote: string;
}

export interface PublicPassportData {
  submissionId: string;
  applicantName: string;
  skillTitle: string;
  decision: ReviewDecision;
  totalScore: number;
  scores: RubricScores;
  feedback: string;
  reviewerName: string;
  reviewedAt: string;
  evidencePrivate: boolean;
  explanation?: string;
}

export interface RubricCriterion {
  key: keyof RubricScores;
  label: string;
  maxPoints: number;
  guidance: string;
}

export const ASSESSMENT_TITLE = 'Build a Responsive Personal Portfolio Website';

export const RUBRIC_CRITERIA: RubricCriterion[] = [
  {
    key: 'html',
    label: 'HTML structure',
    maxPoints: 20,
    guidance: 'Semantic landmarks (<header>, <main>, <nav>, <section>, <footer>), clean heading hierarchy, valid markup.',
  },
  {
    key: 'css',
    label: 'CSS styling',
    maxPoints: 20,
    guidance: 'Cohesive palette, readable typography, consistent spacing, intentional visual hierarchy.',
  },
  {
    key: 'responsive',
    label: 'Responsive design',
    maxPoints: 25,
    guidance: 'Fluid layout from mobile (360px) to laptop (1280px+) with no horizontal overflow or clipped text.',
  },
  {
    key: 'accessibility',
    label: 'Accessibility and usability',
    maxPoints: 15,
    guidance: 'Sufficient color contrast, alt text, keyboard focus states, clear navigation and readable labels.',
  },
  {
    key: 'codeQuality',
    label: 'Code quality',
    maxPoints: 10,
    guidance: 'Organized files, maintainable CSS/HTML, meaningful class names, free of dead placeholders.',
  },
  {
    key: 'explanation',
    label: 'Project explanation',
    maxPoints: 10,
    guidance: 'Clear summary of build choices, responsive breakpoints, challenges solved, and tools used.',
  },
];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  live: 'Live website',
  repo: 'Source code repository',
  screenshot: 'Screenshots',
};

export const DECISION_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending Review',
  verified: 'Verified',
  additional_evidence: 'Additional Evidence Required',
  rejected: 'Rejected',
};

export function sumRubricScores(scores: RubricScores): number {
  return (
    scores.html +
    scores.css +
    scores.responsive +
    scores.accessibility +
    scores.codeQuality +
    scores.explanation
  );
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
