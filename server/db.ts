import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ASSESSMENT_TITLE,
  type EvidenceLink,
  type PublicPassportData,
  type ReviewDecision,
  type ReviewRecord,
  type RubricScores,
  type SampleSummary,
  type ShareRecord,
  type SubmissionRecord,
  type SubmissionStatus,
  sumRubricScores,
} from '../src/types.ts';
import { generateShareToken, hashAccessCode } from './security.ts';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'skill-passport.db');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    applicant_name TEXT NOT NULL,
    skill_title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    evidence_links TEXT NOT NULL,
    evidence_private INTEGER NOT NULL DEFAULT 1,
    access_code_hash TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL,
    score_html INTEGER NOT NULL,
    score_css INTEGER NOT NULL,
    score_responsive INTEGER NOT NULL,
    score_accessibility INTEGER NOT NULL,
    score_code_quality INTEGER NOT NULL,
    score_explanation INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    decision TEXT NOT NULL,
    reviewed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS passport_shares (
    submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    include_explanation INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    disabled_at TEXT
  );
`);

interface SubmissionRow {
  id: string;
  applicant_name: string;
  skill_title: string;
  explanation: string;
  evidence_links: string;
  evidence_private: number;
  access_code_hash: string;
  is_sample: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ReviewRow {
  id: string;
  submission_id: string;
  reviewer_name: string;
  score_html: number;
  score_css: number;
  score_responsive: number;
  score_accessibility: number;
  score_code_quality: number;
  score_explanation: number;
  total_score: number;
  feedback: string;
  decision: string;
  reviewed_at: string;
}

interface ShareRow {
  submission_id: string;
  share_token: string;
  enabled: number;
  include_explanation: number;
  created_at: string;
  disabled_at: string | null;
}

function mapReviewRow(row: ReviewRow | undefined): ReviewRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    submissionId: row.submission_id,
    reviewerName: row.reviewer_name,
    scores: {
      html: row.score_html,
      css: row.score_css,
      responsive: row.score_responsive,
      accessibility: row.score_accessibility,
      codeQuality: row.score_code_quality,
      explanation: row.score_explanation,
    },
    totalScore: row.total_score,
    feedback: row.feedback,
    decision: row.decision as ReviewDecision,
    reviewedAt: row.reviewed_at,
  };
}

function mapShareRow(row: ShareRow | undefined): ShareRecord | null {
  if (!row) return null;
  return {
    shareToken: row.share_token,
    enabled: row.enabled === 1,
    includeExplanation: row.include_explanation === 1,
    createdAt: row.created_at,
    disabledAt: row.disabled_at,
  };
}

function hydrateSubmission(row: SubmissionRow): SubmissionRecord {
  const reviewRow = db
    .prepare('SELECT * FROM reviews WHERE submission_id = ?')
    .get(row.id) as unknown as ReviewRow | undefined;
  const shareRow = db
    .prepare('SELECT * FROM passport_shares WHERE submission_id = ?')
    .get(row.id) as unknown as ShareRow | undefined;

  let parsedLinks: EvidenceLink[] = [];
  try {
    parsedLinks = JSON.parse(row.evidence_links) as EvidenceLink[];
  } catch {
    parsedLinks = [];
  }

  return {
    id: row.id,
    applicantName: row.applicant_name,
    skillTitle: row.skill_title,
    explanation: row.explanation,
    evidenceLinks: parsedLinks,
    evidencePrivate: row.evidence_private === 1,
    isSample: row.is_sample === 1,
    status: row.status as SubmissionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    review: mapReviewRow(reviewRow),
    share: mapShareRow(shareRow),
  };
}

export function seedSampleDataIfEmpty(): void {
  const countRow = db.prepare('SELECT COUNT(*) as total FROM submissions').get() as { total: number };
  if (countRow.total > 0) return;

  const insertSubmission = db.prepare(`
    INSERT INTO submissions (
      id, applicant_name, skill_title, explanation, evidence_links,
      evidence_private, access_code_hash, is_sample, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (
      id, submission_id, reviewer_name, score_html, score_css, score_responsive,
      score_accessibility, score_code_quality, score_explanation, total_score,
      feedback, decision, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertShare = db.prepare(`
    INSERT INTO passport_shares (
      submission_id, share_token, enabled, include_explanation, created_at, disabled_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Sample 1: Verified with shareable passport ready
  const sample1Id = 'SUB-2026-101';
  const sample1Links: EvidenceLink[] = [
    {
      id: 'ev-101-1',
      type: 'live',
      url: 'https://amina-hassan-portfolio.example.org',
      label: 'Deployed Portfolio Website',
    },
    {
      id: 'ev-101-2',
      type: 'repo',
      url: 'https://github.com/amina-hassan/responsive-portfolio',
      label: 'GitHub Source Repository',
    },
    {
      id: 'ev-101-3',
      type: 'screenshot',
      url: 'https://placehold.co/1200x800/png?text=Mobile+%26+Desktop+Portfolio+View',
      label: 'Mobile and Desktop Screenshots',
    },
  ];
  const sample1Scores: RubricScores = {
    html: 18,
    css: 18,
    responsive: 22,
    accessibility: 13,
    codeQuality: 9,
    explanation: 9,
  };
  insertSubmission.run(
    sample1Id,
    'Amina Hassan',
    ASSESSMENT_TITLE,
    'I built a two-section personal portfolio using semantic HTML5 landmarks (<header>, <main>, <article>, <footer>) and CSS Grid with a mobile-first single column below 640px. I tested keyboard tab navigation, added descriptive alt attributes for my project cards, and kept CSS custom properties organized at the top of my stylesheet.',
    JSON.stringify(sample1Links),
    1,
    hashAccessCode('DEMO-101'),
    1,
    'verified',
    '2026-11-24T09:15:00.000Z',
    '2026-11-25T14:20:00.000Z'
  );
  insertReview.run(
    'REV-2026-101',
    sample1Id,
    'Wanjiku Mwangi (PLP Mentor)',
    sample1Scores.html,
    sample1Scores.css,
    sample1Scores.responsive,
    sample1Scores.accessibility,
    sample1Scores.codeQuality,
    sample1Scores.explanation,
    sumRubricScores(sample1Scores),
    'Well-structured semantic HTML landmarks and clean CSS Grid breakpoints across mobile (360px) and laptop viewports. Keyboard focus outlines are clearly visible and color contrast meets accessibility standards. Ready for credential verification.',
    'verified',
    '2026-11-25T14:20:00.000Z'
  );
  insertShare.run(
    sample1Id,
    'demo-amina-hassan-2026',
    1,
    0,
    '2026-11-25T14:25:00.000Z',
    null
  );

  // Sample 2: Pending review (ready for judges to score)
  const sample2Id = 'SUB-2026-102';
  const sample2Links: EvidenceLink[] = [
    {
      id: 'ev-102-1',
      type: 'live',
      url: 'https://jcmugisha-web.example.org',
      label: 'Live Portfolio Demo',
    },
    {
      id: 'ev-102-2',
      type: 'repo',
      url: 'https://github.com/jcmugisha/portfolio-website',
      label: 'Portfolio GitHub Repo',
    },
  ];
  insertSubmission.run(
    sample2Id,
    'Jean-Claude Mugisha',
    ASSESSMENT_TITLE,
    'Created a responsive portfolio showcasing three community web projects I built while learning HTML and CSS offline. Used Flexbox for the project cards, rem units for scalable typography, and a clean collapsible menu for smaller phone screens.',
    JSON.stringify(sample2Links),
    1,
    hashAccessCode('DEMO-102'),
    1,
    'pending',
    '2026-11-26T11:30:00.000Z',
    '2026-11-26T11:30:00.000Z'
  );

  // Sample 3: Additional Evidence Required
  const sample3Id = 'SUB-2026-103';
  const sample3Links: EvidenceLink[] = [
    {
      id: 'ev-103-1',
      type: 'repo',
      url: 'https://github.com/fatuma-ali/my-portfolio-site',
      label: 'Source Code Repository',
    },
  ];
  const sample3Scores: RubricScores = {
    html: 14,
    css: 13,
    responsive: 14,
    accessibility: 8,
    codeQuality: 6,
    explanation: 6,
  };
  insertSubmission.run(
    sample3Id,
    'Fatuma Ali',
    ASSESSMENT_TITLE,
    'Designed a personal CV and portfolio page with CSS variables and a three-column skills section. Included my work history and contact section at the bottom.',
    JSON.stringify(sample3Links),
    1,
    hashAccessCode('DEMO-103'),
    1,
    'additional_evidence',
    '2026-11-22T08:05:00.000Z',
    '2026-11-23T16:40:00.000Z'
  );
  insertReview.run(
    'REV-2026-103',
    sample3Id,
    'Daniel Ochieng (ILO Assessor)',
    sample3Scores.html,
    sample3Scores.css,
    sample3Scores.responsive,
    sample3Scores.accessibility,
    sample3Scores.codeQuality,
    sample3Scores.explanation,
    sumRubricScores(sample3Scores),
    'Good visual design foundation in your repository. However, the three-column grid causes horizontal scrolling below 420px, and no live link or mobile screenshot was attached. Please add a responsive breakpoint and attach a mobile screenshot or live URL.',
    'additional_evidence',
    '2026-11-23T16:40:00.000Z'
  );
}

export function createSubmission(input: {
  applicantName: string;
  explanation: string;
  evidenceLinks: EvidenceLink[];
  accessCodeHash: string;
}): SubmissionRecord {
  const now = new Date().toISOString();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const id = `SUB-2026-${suffix}`;

  db.prepare(`
    INSERT INTO submissions (
      id, applicant_name, skill_title, explanation, evidence_links,
      evidence_private, access_code_hash, is_sample, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, 0, 'pending', ?, ?)
  `).run(
    id,
    input.applicantName,
    ASSESSMENT_TITLE,
    input.explanation,
    JSON.stringify(input.evidenceLinks),
    input.accessCodeHash,
    now,
    now
  );

  return getSubmissionById(id)!;
}

export function getSubmissionById(id: string): SubmissionRecord | null {
  const row = db
    .prepare('SELECT * FROM submissions WHERE id = ?')
    .get(id) as unknown as SubmissionRow | undefined;
  if (!row) return null;
  return hydrateSubmission(row);
}

export function getSubmissionAuthHash(id: string): { accessCodeHash: string; isSample: boolean } | null {
  const row = db
    .prepare('SELECT access_code_hash, is_sample FROM submissions WHERE id = ?')
    .get(id) as unknown as { access_code_hash: string; is_sample: number } | undefined;
  if (!row) return null;
  return {
    accessCodeHash: row.access_code_hash,
    isSample: row.is_sample === 1,
  };
}

export function listSampleSummaries(): SampleSummary[] {
  const rows = db
    .prepare('SELECT * FROM submissions WHERE is_sample = 1 ORDER BY created_at DESC')
    .all() as unknown as SubmissionRow[];

  return rows.map((row) => {
    const hydrated = hydrateSubmission(row);
    let sampleNote = 'Sample submission';
    if (hydrated.status === 'verified') {
      sampleNote = 'Verified sample — ready to print PDF or manage share link';
    } else if (hydrated.status === 'pending') {
      sampleNote = 'Pending sample — ready for manual 100-point rubric review';
    } else if (hydrated.status === 'additional_evidence') {
      sampleNote = 'Needs follow-up — example of actionable reviewer feedback';
    }
    return {
      id: hydrated.id,
      applicantName: hydrated.applicantName,
      skillTitle: hydrated.skillTitle,
      status: hydrated.status,
      totalScore: hydrated.review ? hydrated.review.totalScore : null,
      createdAt: hydrated.createdAt,
      sampleNote,
    };
  });
}

export function listReviewerSubmissions(): SubmissionRecord[] {
  const rows = db
    .prepare('SELECT * FROM submissions ORDER BY CASE WHEN status = \'pending\' THEN 0 ELSE 1 END, updated_at DESC')
    .all() as unknown as SubmissionRow[];
  return rows.map(hydrateSubmission);
}

export function upsertReview(input: {
  submissionId: string;
  reviewerName: string;
  scores: RubricScores;
  feedback: string;
  decision: ReviewDecision;
}): SubmissionRecord | null {
  const existing = getSubmissionById(input.submissionId);
  if (!existing) return null;

  const totalScore = sumRubricScores(input.scores);
  const now = new Date().toISOString();
  const reviewId = existing.review?.id || `REV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  db.prepare(`
    INSERT INTO reviews (
      id, submission_id, reviewer_name, score_html, score_css, score_responsive,
      score_accessibility, score_code_quality, score_explanation, total_score,
      feedback, decision, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(submission_id) DO UPDATE SET
      reviewer_name = excluded.reviewer_name,
      score_html = excluded.score_html,
      score_css = excluded.score_css,
      score_responsive = excluded.score_responsive,
      score_accessibility = excluded.score_accessibility,
      score_code_quality = excluded.score_code_quality,
      score_explanation = excluded.score_explanation,
      total_score = excluded.total_score,
      feedback = excluded.feedback,
      decision = excluded.decision,
      reviewed_at = excluded.reviewed_at
  `).run(
    reviewId,
    input.submissionId,
    input.reviewerName,
    input.scores.html,
    input.scores.css,
    input.scores.responsive,
    input.scores.accessibility,
    input.scores.codeQuality,
    input.scores.explanation,
    totalScore,
    input.feedback,
    input.decision,
    now
  );

  db.prepare('UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?').run(
    input.decision,
    now,
    input.submissionId
  );

  // If decision is no longer verified, automatically disable any active share link
  if (input.decision !== 'verified') {
    db.prepare(
      'UPDATE passport_shares SET enabled = 0, disabled_at = ? WHERE submission_id = ? AND enabled = 1'
    ).run(now, input.submissionId);
  }

  return getSubmissionById(input.submissionId);
}

export function enablePassportShare(
  submissionId: string,
  includeExplanation: boolean
): ShareRecord | null {
  const submission = getSubmissionById(submissionId);
  if (!submission || submission.status !== 'verified') {
    return null;
  }

  const now = new Date().toISOString();
  const existingShare = db
    .prepare('SELECT * FROM passport_shares WHERE submission_id = ?')
    .get(submissionId) as unknown as ShareRow | undefined;

  const shareToken =
    existingShare && existingShare.enabled === 1
      ? existingShare.share_token
      : generateShareToken();

  db.prepare(`
    INSERT INTO passport_shares (
      submission_id, share_token, enabled, include_explanation, created_at, disabled_at
    ) VALUES (?, ?, 1, ?, ?, NULL)
    ON CONFLICT(submission_id) DO UPDATE SET
      share_token = excluded.share_token,
      enabled = 1,
      include_explanation = excluded.include_explanation,
      created_at = excluded.created_at,
      disabled_at = NULL
  `).run(submissionId, shareToken, includeExplanation ? 1 : 0, now);

  const updated = db
    .prepare('SELECT * FROM passport_shares WHERE submission_id = ?')
    .get(submissionId) as unknown as ShareRow;
  return mapShareRow(updated);
}

export function disablePassportShare(submissionId: string): ShareRecord | null {
  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT * FROM passport_shares WHERE submission_id = ?')
    .get(submissionId) as unknown as ShareRow | undefined;
  if (!existing) return null;

  db.prepare(
    'UPDATE passport_shares SET enabled = 0, disabled_at = ? WHERE submission_id = ?'
  ).run(now, submissionId);

  const updated = db
    .prepare('SELECT * FROM passport_shares WHERE submission_id = ?')
    .get(submissionId) as unknown as ShareRow;
  return mapShareRow(updated);
}

export function getPublicPassportByToken(shareToken: string): PublicPassportData | null {
  const shareRow = db
    .prepare('SELECT * FROM passport_shares WHERE share_token = ? AND enabled = 1')
    .get(shareToken) as unknown as ShareRow | undefined;

  if (!shareRow) return null;

  const submission = getSubmissionById(shareRow.submission_id);
  if (!submission || submission.status !== 'verified' || !submission.review) {
    return null;
  }

  // Submitted evidence links are strictly withheld from public passport views!
  const result: PublicPassportData = {
    submissionId: submission.id,
    applicantName: submission.applicantName,
    skillTitle: submission.skillTitle,
    decision: submission.review.decision,
    totalScore: submission.review.totalScore,
    scores: submission.review.scores,
    feedback: submission.review.feedback,
    reviewerName: submission.review.reviewerName,
    reviewedAt: submission.review.reviewedAt,
    evidencePrivate: true,
  };

  if (shareRow.include_explanation === 1) {
    result.explanation = submission.explanation;
  }

  return result;
}
