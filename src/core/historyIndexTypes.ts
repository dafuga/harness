import { z } from 'zod';
import { comparisonSchema } from './comparisonTypes';
import { explanationSchema } from './explanationTypes';
import { runtimeKinds } from './unitTypes';
import { profileSchema } from './verificationTypes';

const text = z.string().min(1);
const commit = z.string().regex(/^[0-9a-f]{40}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const version = z.literal(1);

/** One attached record as the index lists it under its commit. */
export const indexedRecordSchema = z.strictObject({
	id: text,
	status: z.enum(['passed', 'failed']),
	profile: text,
	finishedAt: text,
	base: commit.nullable(),
	/** False when the record, a file of it or something it inherits could not be validated. */
	valid: z.boolean(),
	problems: z.array(text)
});

/** One source commit. A commit without evidence is listed too, with the gap stated. */
export const indexedRevisionSchema = z.strictObject({
	commit,
	tree: commit,
	parents: z.array(commit),
	subject: z.string(),
	author: z.string(),
	authoredAt: text,
	committedAt: text,
	branches: z.array(text),
	/** True when no branch reaches the commit any more and only its archive ref keeps it. */
	retained: z.boolean(),
	coverage: z.enum(['verified', 'failed', 'invalid', 'unverified']),
	gaps: z.array(text),
	records: z.array(indexedRecordSchema),
	reasons: z.number().int().nonnegative(),
	legacy: z.array(text),
	/**
	 * The units the commit changed itself against its first parent, whether or not it was
	 * verified. Null when that could not be read; absent in an index built before it was kept.
	 */
	changes: z
		.strictObject({
			base: commit.nullable(),
			direct: z.array(text),
			added: z.array(text),
			removed: z.array(text)
		})
		.nullable()
		.optional(),
	/** Path of the revision's detail file, relative to the index. */
	detail: text
});

const growthPoint = z.strictObject({
	commit,
	record: text,
	'source-bytes': z.number().optional(),
	complexity: z.number().optional(),
	dependencies: z.number().optional(),
	/** The size of what the unit emits, by execution target, as built in the verified snapshot. */
	emitted: z.record(z.string(), z.number()).optional(),
	/** Per metric: why it has no value here, or what its value leaves out. */
	notes: z.record(z.string(), text).optional()
});

const limits = z.record(z.string(), z.number());
/** One reviewed line of the budget ledger, at the commit whose record it cites. */
const budgetReview = z.strictObject({
	type: z.enum(['baseline', 'approval']),
	commit,
	record: text,
	reviewer: text,
	reason: text,
	at: text,
	before: limits.optional(),
	after: limits,
	unmeasured: z.record(z.string(), text).optional()
});

/**
 * Measurements of one unit, workload, metric and target. Values taken on another machine
 * profile, or under another request, unit, method or sampling, are a separate series and are
 * never joined into one line.
 */
export const benchmarkSeriesSchema = z.strictObject({
	unit: text,
	workload: text,
	metric: text,
	target: z.enum(runtimeKinds).nullable(),
	incompatible: z.boolean(),
	series: z.array(
		z.strictObject({
			profile: text,
			unitOfMeasure: text,
			method: text,
			comparison: comparisonSchema.nullable(),
			points: z.array(z.strictObject({ commit, record: text, value: z.number() }))
		})
	)
});

/** One file of a legacy report, kept with where it came from. */
export const legacyMediaSchema = z.strictObject({
	id: text,
	title: z.string(),
	file: text,
	status: text,
	mediaType: z.string().optional(),
	capturedAt: z.string().optional(),
	viewport: z.string().optional(),
	provenance: z.literal('legacy-report'),
	sha256: sha256.nullable(),
	bytes: z.number().int().nonnegative().nullable(),
	/** Path in the output, or null with `gap` when the bytes are not available. */
	media: z.string().nullable(),
	gap: z.string().optional()
});

/** A report from before Git-backed records, exactly as it was recorded. */
export const legacyEntrySchema = z.strictObject({
	id: text,
	title: z.string(),
	mode: z.string(),
	environment: z.string(),
	/** The original outcome; a run that was still running stays `running`. */
	status: text,
	state: z.string(),
	startedAt: text,
	updatedAt: text,
	/** The revision as recorded, whether or not it resolves. */
	revision: z.string().nullable(),
	/** The commit of this repository the revision resolves to, or null when it is unlinked. */
	linked: commit.nullable(),
	gap: z.string().optional(),
	summary: z.string(),
	checks: z.array(z.strictObject({ id: text, title: z.string(), status: text })),
	media: z.array(legacyMediaSchema)
});

export const historyIndexSchema = z.strictObject({
	schemaVersion: version,
	refs: z.strictObject({ evidence: commit.nullable(), notes: commit.nullable() }),
	branches: z.array(z.strictObject({ name: text, head: commit })),
	revisions: z.array(indexedRevisionSchema),
	units: z.array(
		z.strictObject({
			id: text,
			growth: z.array(growthPoint),
			reviews: z.array(budgetReview).optional()
		})
	),
	benchmarks: z.array(benchmarkSeriesSchema),
	profiles: z.array(profileSchema),
	legacy: z.array(legacyEntrySchema),
	/** True when older commits were left out because of the revision limit. */
	truncated: z.boolean(),
	problems: z.array(text)
});

/** The explanations shown with a revision are the stored reasons, unchanged. */
export const indexedExplanationSchema = explanationSchema;

export type IndexedRecord = z.infer<typeof indexedRecordSchema>;
export type IndexedRevision = z.infer<typeof indexedRevisionSchema>;
export type BenchmarkSeries = z.infer<typeof benchmarkSeriesSchema>;
export type LegacyEntry = z.infer<typeof legacyEntrySchema>;
export type LegacyMedia = z.infer<typeof legacyMediaSchema>;
export type HistoryIndex = z.infer<typeof historyIndexSchema>;
