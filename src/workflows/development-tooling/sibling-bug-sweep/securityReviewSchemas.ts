// @harness-uid u_wwerrde2nk
import { z } from 'zod';
import {
	bugClassId,
	bugClassSchema,
	candidateVerdictSchema,
	searchPatternSchema
} from '../../../core/development-tooling/bug-class/bugClassSchemas';

export const maxSecurityCandidates = 512;
export const securityClassesPath = 'specification/security/bug-classes.json';
export const attackSurfacePath = 'specification/security/attack-surface.md';

export const securityClassesSchema = z
	.strictObject({
		schemaVersion: z.literal(1),
		classes: z.array(bugClassSchema).min(1).max(64)
	})
	.refine(({ classes }) => new Set(classes.map(({ id }) => id)).size === classes.length, {
		message: 'Security bug class IDs must be unique.'
	});

const securitySite = z.strictObject({
	id: z.string().regex(/^[0-9a-f]{20}$/),
	path: z.string().min(1).max(4096),
	line: z.number().int().positive(),
	lastLine: z.number().int().positive(),
	score: z.number().int(),
	matches: z.array(searchPatternSchema).min(1).max(30)
});
const budget = z.strictObject({
	maxDurationMs: z.number().int().positive(),
	maxCostMicrousd: z.number().int().nonnegative(),
	reservedMicrousd: z.number().int().nonnegative()
});
const identity = {
	schemaVersion: z.literal(1),
	revision: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
	classId: bugClassId,
	budget
};

export const securityScanSchema = z.strictObject({
	...identity,
	kind: z.literal('security-scan'),
	limit: z.number().int().min(1).max(maxSecurityCandidates),
	scannedFiles: z.number().int().nonnegative(),
	skipped: z.array(z.string()),
	totalCandidates: z.number().int().nonnegative(),
	candidates: z.array(securitySite).max(maxSecurityCandidates)
});

export const securityDecisionSchema = candidateVerdictSchema.extend({
	id: securitySite.shape.id
});
export const securityDecisionsSchema = z.strictObject({
	revision: identity.revision,
	classId: bugClassId,
	decisions: z.array(securityDecisionSchema).max(maxSecurityCandidates)
});
export const securityReviewSchema = z.strictObject({
	...identity,
	kind: z.literal('security-revalidation'),
	limit: securityScanSchema.shape.limit,
	reviewer: z.enum(['manual', 'external']),
	findings: z
		.array(
			securitySite.extend({
				verdict: z.enum(['confirmed', 'dismissed', 'unconfirmed', 'not-reviewed']),
				evidence: securityDecisionSchema.shape.evidence,
				impact: securityDecisionSchema.shape.impact
			})
		)
		.max(maxSecurityCandidates),
	stopReason: z.enum(['cost-cap', 'time-cap', 'reviewer-error']).optional()
});
