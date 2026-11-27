import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  createSubmission,
  disablePassportShare,
  enablePassportShare,
  getPublicPassportByToken,
  getSubmissionAuthHash,
  getSubmissionById,
  listReviewerSubmissions,
  listSampleSummaries,
  seedSampleDataIfEmpty,
  upsertReview,
} from './server/db.ts';
import {
  generateAccessCode,
  hashAccessCode,
  isValidHttpUrl,
  signSessionToken,
  verifyAccessCode,
  verifyReviewerPasscode,
  verifySessionToken,
  type SessionPayload,
} from './server/security.ts';
import {
  RUBRIC_CRITERIA,
  type EvidenceLink,
  type EvidenceType,
  type ReviewDecision,
  type RubricScores,
} from './src/types.ts';

seedSampleDataIfEmpty();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '256kb' }));

interface AuthenticatedRequest extends Request {
  session?: SessionPayload;
}

function parseBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim();
}

function attachOptionalSession(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = parseBearerToken(req);
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      req.session = payload;
    }
  }
  next();
}

function requireReviewer(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = parseBearerToken(req);
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'reviewer') {
    res.status(401).json({ error: 'Reviewer session required.' });
    return;
  }
  req.session = payload;
  next();
}

app.use('/api', attachOptionalSession);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/api/samples', (_req: Request, res: Response) => {
  res.json({ samples: listSampleSummaries() });
});

app.post('/api/submissions', (req: Request, res: Response) => {
  const body = req.body as {
    applicantName?: unknown;
    explanation?: unknown;
    evidenceLinks?: unknown;
  };

  const applicantName = typeof body.applicantName === 'string' ? body.applicantName.trim() : '';
  const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : '';
  const rawLinks = Array.isArray(body.evidenceLinks) ? body.evidenceLinks : [];

  if (applicantName.length < 2 || applicantName.length > 120) {
    res.status(400).json({ error: 'Please enter the applicant name (2 to 120 characters).' });
    return;
  }

  if (explanation.length < 15 || explanation.length > 3000) {
    res.status(400).json({
      error: 'Please include a short explanation of how you built your portfolio (at least 15 characters).',
    });
    return;
  }

  if (rawLinks.length === 0 || rawLinks.length > 10) {
    res.status(400).json({ error: 'Please provide at least one evidence link (maximum 10).' });
    return;
  }

  const allowedTypes: EvidenceType[] = ['live', 'repo', 'screenshot'];
  const sanitizedLinks: EvidenceLink[] = [];

  for (let i = 0; i < rawLinks.length; i += 1) {
    const item = rawLinks[i] as { type?: unknown; url?: unknown; label?: unknown };
    const linkType = typeof item?.type === 'string' ? (item.type as EvidenceType) : 'live';
    const rawUrl = typeof item?.url === 'string' ? item.url.trim() : '';
    const rawLabel = typeof item?.label === 'string' ? item.label.trim().slice(0, 80) : '';

    if (!allowedTypes.includes(linkType)) {
      res.status(400).json({ error: 'Invalid evidence link type.' });
      return;
    }

    if (!isValidHttpUrl(rawUrl)) {
      res.status(400).json({
        error: `Evidence link #${i + 1} must be a valid http:// or https:// URL.`,
      });
      return;
    }

    sanitizedLinks.push({
      id: `ev-${Date.now()}-${i + 1}`,
      type: linkType,
      url: rawUrl,
      label: rawLabel || undefined,
    });
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = hashAccessCode(accessCode);

  const submission = createSubmission({
    applicantName,
    explanation,
    evidenceLinks: sanitizedLinks,
    accessCodeHash,
  });

  const applicantToken = signSessionToken({
    role: 'applicant',
    submissionId: submission.id,
  });

  res.status(201).json({
    submission,
    accessCode,
    applicantToken,
  });
});

app.post('/api/submissions/lookup', (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as { submissionId?: unknown; accessCode?: unknown };
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim().toUpperCase() : '';
  const accessCode = typeof body.accessCode === 'string' ? body.accessCode.trim() : '';

  if (!submissionId) {
    res.status(400).json({ error: 'Submission ID is required.' });
    return;
  }

  const authRecord = getSubmissionAuthHash(submissionId);
  if (!authRecord) {
    res.status(404).json({ error: 'No submission found with that ID.' });
    return;
  }

  const hasSessionAccess =
    req.session?.role === 'reviewer' ||
    (req.session?.role === 'applicant' && req.session.submissionId === submissionId);

  if (!authRecord.isSample && !hasSessionAccess) {
    if (!accessCode || !verifyAccessCode(accessCode, authRecord.accessCodeHash)) {
      res.status(401).json({
        error: 'Access code is required for private submissions. Check your Submission ID and Access Code.',
      });
      return;
    }
  }

  const submission = getSubmissionById(submissionId);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const applicantToken = signSessionToken({
    role: 'applicant',
    submissionId: submission.id,
  });

  res.json({ submission, applicantToken });
});

app.get('/api/submissions/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const submission = getSubmissionById(id);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const authorized =
    submission.isSample ||
    req.session?.role === 'reviewer' ||
    (req.session?.role === 'applicant' && req.session.submissionId === submission.id);

  if (!authorized) {
    res.status(401).json({ error: 'Authorization required to view this private submission.' });
    return;
  }

  res.json({ submission });
});

app.post('/api/submissions/:id/share', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const submission = getSubmissionById(id);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const authorized =
    submission.isSample ||
    req.session?.role === 'reviewer' ||
    (req.session?.role === 'applicant' && req.session.submissionId === submission.id);

  if (!authorized) {
    res.status(401).json({ error: 'Authorization required to manage share links.' });
    return;
  }

  if (submission.status !== 'verified') {
    res.status(400).json({ error: 'Shareable links can only be created after a Verified review.' });
    return;
  }

  const body = req.body as { includeExplanation?: unknown };
  const includeExplanation = body?.includeExplanation === true;
  const share = enablePassportShare(id, includeExplanation);

  if (!share) {
    res.status(400).json({ error: 'Unable to create shareable link.' });
    return;
  }

  res.json({ share });
});

app.delete('/api/submissions/:id/share', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const submission = getSubmissionById(id);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const authorized =
    submission.isSample ||
    req.session?.role === 'reviewer' ||
    (req.session?.role === 'applicant' && req.session.submissionId === submission.id);

  if (!authorized) {
    res.status(401).json({ error: 'Authorization required to disable share links.' });
    return;
  }

  const share = disablePassportShare(id);
  res.json({ share });
});

app.get('/api/reviewer/status', (_req: Request, res: Response) => {
  const configured = Boolean(process.env.REVIEWER_PASSCODE?.trim());
  res.json({ requiresPasscode: configured });
});

app.post('/api/reviewer/auth', (req: Request, res: Response) => {
  const configuredPasscode = process.env.REVIEWER_PASSCODE?.trim();
  if (configuredPasscode) {
    const body = req.body as { passcode?: unknown };
    const passcode = typeof body.passcode === 'string' ? body.passcode : '';
    if (!passcode || !verifyReviewerPasscode(passcode, configuredPasscode)) {
      res.status(401).json({ error: 'Invalid reviewer passcode.' });
      return;
    }
  }

  const reviewerToken = signSessionToken({ role: 'reviewer' });
  res.json({ reviewerToken, demoMode: !configuredPasscode });
});

app.get('/api/reviewer/submissions', requireReviewer, (_req: Request, res: Response) => {
  const submissions = listReviewerSubmissions();
  res.json({ submissions });
});

app.post('/api/reviewer/reviews', requireReviewer, (req: Request, res: Response) => {
  const body = req.body as {
    submissionId?: unknown;
    reviewerName?: unknown;
    scores?: Partial<Record<keyof RubricScores, unknown>>;
    feedback?: unknown;
    decision?: unknown;
  };

  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim().toUpperCase() : '';
  const reviewerName =
    typeof body.reviewerName === 'string' && body.reviewerName.trim().length > 0
      ? body.reviewerName.trim().slice(0, 100)
      : 'PLP / PROSPECTS Assessor';
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
  const decision = typeof body.decision === 'string' ? (body.decision as ReviewDecision) : undefined;

  if (!submissionId) {
    res.status(400).json({ error: 'Submission ID is required.' });
    return;
  }

  const allowedDecisions: ReviewDecision[] = ['verified', 'additional_evidence', 'rejected'];
  if (!decision || !allowedDecisions.includes(decision)) {
    res.status(400).json({ error: 'Decision must be Verified, Additional Evidence Required, or Rejected.' });
    return;
  }

  if (feedback.length < 5 || feedback.length > 3000) {
    res.status(400).json({ error: 'Please provide written feedback (at least 5 characters).' });
    return;
  }

  const rawScores = body.scores || {};
  const validatedScores: Partial<RubricScores> = {};

  for (const criterion of RUBRIC_CRITERIA) {
    const rawVal = rawScores[criterion.key];
    const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
    if (!Number.isInteger(numVal) || numVal < 0 || numVal > criterion.maxPoints) {
      res.status(400).json({
        error: `${criterion.label} score must be a whole number between 0 and ${criterion.maxPoints}.`,
      });
      return;
    }
    validatedScores[criterion.key] = numVal;
  }

  const updated = upsertReview({
    submissionId,
    reviewerName,
    scores: validatedScores as RubricScores,
    feedback,
    decision,
  });

  if (!updated) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  res.json({ submission: updated });
});

app.get('/api/passports/share/:token', (req: Request, res: Response) => {
  const token = String(req.params.token || '').trim();
  if (!token) {
    res.status(404).json({ error: 'Shareable passport link not found.' });
    return;
  }

  const passport = getPublicPassportByToken(token);
  if (!passport) {
    res.status(404).json({
      error: 'This shareable passport link is disabled or does not exist.',
    });
    return;
  }

  res.json({ passport });
});

async function startServer(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Skill Passport server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
