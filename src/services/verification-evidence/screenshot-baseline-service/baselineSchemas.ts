import { z } from 'zod';
import { unitIdPattern } from '../../../core/development-tooling/unitTypes';

const identity = z.string().regex(unitIdPattern);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reviewedText = z.string().trim().min(1).max(500);

/** An explicit review names one existing case, capture and person who inspected it. */
export const screenshotReviewInputSchema = z.strictObject({
	commit,
	record: hash,
	unit: identity,
	case: identity,
	scenario: identity,
	evidence: identity,
	viewport: identity,
	reviewer: reviewedText,
	reason: reviewedText
});

/** A baseline lookup must agree with the authored screenshot slot. */
export const screenshotBaselineRequestSchema = z.strictObject({
	id: hash,
	unit: identity,
	case: identity,
	viewport: identity,
	file: z.string().trim().min(1)
});

/** The review stores provenance, not an observed replacement for an authored expectation. */
export const screenshotReviewBodySchema = screenshotReviewInputSchema.extend({
	schemaVersion: z.literal(1),
	reviewedAt: z.string().datetime(),
	tree: commit,
	recordStatus: z.enum(['passed', 'failed']),
	profile: z.string().min(1),
	state: identity,
	file: z.string().trim().min(1),
	testFile: z.string().trim().min(1),
	testTitle: z.string().trim().min(1),
	caseStatus: z.enum(['passed', 'failed']),
	captureRetry: z.number().int().nonnegative().optional(),
	captureStatus: z.enum(['passed', 'failed']),
	capturePath: z.string().trim().min(1),
	sha256: hash,
	bytes: z.number().int().positive(),
	buildId: hash
});
export const screenshotReviewSchema = screenshotReviewBodySchema.extend({ id: hash });
