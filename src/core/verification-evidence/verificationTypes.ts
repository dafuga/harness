import { z } from 'zod';
import { browserDiagnosticSchema } from '../development-tooling/browserDiagnostics';
import { comparisonSchema } from '../development-tooling/comparisonTypes';
import { explanationSchema } from '../development-tooling/explanationTypes';
import { runtimeKinds, unitIdPattern } from '../development-tooling/unitTypes';

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
	status: z.enum(['passed', 'failed', 'referenced']),
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

export const profileSchema = z.strictObject({
	id: text,
	platform: text,
	arch: text,
	cpu: text,
	cores: z.number().int().positive(),
	memoryBytes: z.number().int().positive(),
	runtime: text
});

export const budgetFindingSchema = z.strictObject({
	unit: identifier,
	metric: text,
	status: z.enum([
		'passed',
		'exceeded',
		'missing-baseline',
		'missing-measurement',
		'incomplete',
		'incompatible',
		/** It cannot be measured, and its reviewed baseline says so too: stated, not judged. */
		'unavailable'
	]),
	/** Null whenever the measurement was not compared with a baseline. */
	baseline: z.number().nullable(),
	measured: z.number().nullable(),
	/** The execution target whose emitted size this is; other findings name none. */
	target: z.enum(runtimeKinds).optional(),
	detail: z.string().optional(),
	/** Why an incomplete or incompatible measurement could not be compared. */
	differences: z.array(text).optional()
});

const artifactSchema = z.strictObject({
	path: text,
	sha256,
	bytes: z.number().int().nonnegative()
});

/** The exact version of one unit that a record observed. */
export const componentVersionSchema = z.strictObject({
	unit: identifier,
	change: z.enum(['unchanged', 'modified', 'added', 'removed']),
	/** Execution target that was exercised. */
	target: z.enum(runtimeKinds),
	manifest: sha256,
	source: sha256,
	contract: sha256,
	runtime: sha256,
	files: z.array(z.strictObject({ path: text, hash: commit }))
});

/** One measured metric, or an explicit statement that it could not be measured. */
export const measurementSchema = z.strictObject({
	unit: identifier,
	/** Selected exported callable when a module contains several helpers. */
	callable: text.optional(),
	metric: text,
	unitOfMeasure: text,
	value: z.number().nullable(),
	/** Required exactly when `value` is null. */
	unavailable: z.string().optional(),
	/** What the value leaves out, when only part of the unit could be measured. */
	partial: z.string().optional(),
	method: text,
	workload: identifier.nullable(),
	/** Hardware and runtime profile; null for metrics that do not depend on one. */
	profile: text.nullable(),
	target: z.enum(runtimeKinds).optional(),
	samples: z.number().int().positive().optional(),
	/** The exact request, boundary and sampling; required before a budget may compare it. */
	comparison: comparisonSchema.optional(),
	testedRevision: commit,
	artifacts: z.array(artifactSchema)
});

export const verificationRecordSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: text,
	repository: text,
	source: z.strictObject({
		commit,
		tree: commit,
		/** The revision everything was judged against: one a passing record proves, or none. */
		base: commit.nullable(),
		/** The passing record that proved the base, so the dependency can be followed exactly. */
		baseRecord: text.optional(),
		/** The base that was asked for, when it had no passing record and could not be used. */
		requestedBase: commit.optional()
	}),
	profile: profileSchema,
	/** The verifier and every declared tool, as each answered in the snapshot. */
	tools: z.array(z.strictObject({ id: text, version: text })).optional(),
	startedAt: text,
	finishedAt: text,
	status: outcome,
	components: z.array(componentVersionSchema),
	measurements: z.array(measurementSchema),
	impact: z.strictObject({
		runtime: text,
		expanded: z.boolean(),
		changed: z.array(z.strictObject({ path: text, status: text, classification: text })),
		units: z.strictObject({
			direct: z.array(identifier),
			indirect: z.array(identifier),
			added: z.array(identifier),
			removed: z.array(identifier)
		}),
		uncertain: z.array(z.strictObject({ node: text, reason: text, detail: z.string() }))
	}),
	tests: z.array(
		z.strictObject({
			id: text,
			kind: z.enum(['unit', 'integration', 'e2e']),
			runner: z.enum(['vitest', 'playwright', 'command']),
			target: text,
			status: outcome,
			durationMs: z.number().nonnegative(),
			browserErrors: z.array(browserDiagnosticSchema).optional(),
			log: artifactSchema
		})
	),
	scenarios: z.array(scenarioResultSchema),
	/** Identity of each declared build as compiled in the snapshot of this exact tree. */
	builds: z
		.array(
			z.strictObject({
				id: identifier,
				directory: text,
				buildId: sha256,
				files: z.number().int().positive()
			})
		)
		.optional(),
	budgets: z.strictObject({ status: outcome, findings: z.array(budgetFindingSchema) }),
	reasons: z.strictObject({
		status: outcome,
		/** The explanations that satisfied this verification. */
		entries: z.array(explanationSchema).optional(),
		missing: z.array(
			z.strictObject({
				unit: identifier,
				symbol: z.string().optional(),
				file: z.string().optional(),
				change: z.enum(['added', 'modified', 'removed']).optional(),
				state: z.enum(['missing', 'stale']).optional()
			})
		)
	}),
	/** Outcome of each gate; a baseline may come only from a record whose other gates passed. */
	gates: z.record(z.string(), outcome).optional(),
	failures: z.array(text)
});

export type {
	Capture,
	ScenarioResult,
	VerificationProfile,
	BudgetFinding,
	RecordedComponent,
	Measurement,
	VerificationRecord
} from './verificationTypes.types';
