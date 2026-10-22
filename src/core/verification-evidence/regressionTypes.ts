import { z } from 'zod';
import { captureSchema, measurementSchema } from './verificationTypes';

const commit = z.string().regex(/^[a-f0-9]{40}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1);
export const regressionPhaseSchema = z.enum(['red', 'green', 'capture']);
const focusedCaptureSchema = z.strictObject({
	unit: text,
	capture: captureSchema.extend({ path: z.string().regex(/^focused\/[\w.-]+$/) }),
	viewport: z
		.strictObject({ width: z.number().int().positive(), height: z.number().int().positive() })
		.optional()
});
export const regressionRecordSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: hash,
	loop: text,
	phase: regressionPhaseSchema,
	status: z.enum(['failed', 'passed']),
	source: z.strictObject({ commit, tree: commit, parent: commit }),
	units: z.array(text),
	tests: z.array(text).min(1),
	/** Tests, fixtures, runner configuration and lockfiles frozen at the failing commit. */
	inputs: z.array(z.strictObject({ path: text, hash: commit })).min(1),
	command: text,
	assertion: text,
	profile: text,
	startedAt: text,
	finishedAt: text,
	exitCode: z.number().int().nonnegative(),
	log: z.strictObject({
		path: z.literal('output.log'),
		sha256: hash,
		bytes: z.number().int().nonnegative()
	}),
	/** Observations from the focused run, never full verification or budget approval. */
	measurements: z.array(measurementSchema).optional(),
	captures: z.array(focusedCaptureSchema).optional(),
	red: z.strictObject({ commit, record: hash }).optional()
});

/** A focused regression result never grants full verification or a budget baseline. */
export type RegressionRecord = z.infer<typeof regressionRecordSchema>;
export type RegressionPhase = z.infer<typeof regressionPhaseSchema>;
const pointSchema = z.strictObject({
	commit,
	sourceTree: commit.optional(),
	id: hash.optional(),
	status: z.enum(['failed', 'passed']),
	command: text,
	assertion: text,
	output: z.string().max(2_000_000),
	finishedAt: text,
	measurements: z.array(measurementSchema).optional(),
	captures: z
		.array(
			focusedCaptureSchema.extend({
				capture: captureSchema.extend({ media: z.string().nullable(), gap: text.optional() })
			})
		)
		.optional()
});
export const regressionViewSchema = z.strictObject({
	loop: text,
	units: z.array(text),
	red: pointSchema.nullable(),
	green: pointSchema.optional(),
	gap: text.optional()
});
export type RegressionPoint = z.infer<typeof pointSchema>;
export type RegressionView = z.infer<typeof regressionViewSchema>;
