// @harness-uid u_d27vkdvynl
import { z } from 'zod';
import { unitIdPattern } from '../development-tooling/unitTypes';

const identifier = z.string().regex(unitIdPattern);
const text = z.string().min(1);
const commit = z.string().regex(/^[0-9a-f]{40}$/, 'must be a full commit or tree hash');
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'must be a sha256 hex digest');
const outcome = z.enum(['passed', 'failed']);

/** CSS-pixel bounds of an element screenshot within the rendered document. */
export const captureRegionSchema = z.strictObject({
	x: z.number().int().nonnegative(),
	y: z.number().int().nonnegative(),
	width: z.number().int().positive(),
	height: z.number().int().positive()
});

export const captureSchema = z.strictObject({
	evidence: identifier,
	kind: z.enum(['screenshot', 'audio', 'output', 'assertions', 'trace', 'benchmark']),
	state: identifier,
	viewport: identifier.optional(),
	clip: captureRegionSchema.optional(),
	status: outcome,
	path: text,
	sha256,
	bytes: z.number().int().nonnegative(),
	mediaType: text,
	capturedAt: text,
	provenance: z.enum(['fixture', 'actual-capture']).optional(),
	transcript: z.string().optional(),
	durationSeconds: z.number().positive().optional(),
	server: z.strictObject({ buildId: text, revision: commit }).optional(),
	note: z.string().optional()
});

export const scenarioResultSchema = z.strictObject({
	id: identifier,
	status: z.enum(['passed', 'failed', 'referenced', 'pending']),
	/** Revision whose code produced the captures; differs from the source only when referenced. */
	testedRevision: commit,
	referencedRecord: text.optional(),
	states: z.array(
		z.strictObject({
			id: identifier,
			coverage: z.enum(['required', 'missing', 'inapplicable']),
			reason: z.string().optional(),
			captures: z.array(captureSchema)
		})
	)
});
