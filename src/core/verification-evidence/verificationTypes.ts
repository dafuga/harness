// @harness-uid u_d27vkdvynl
import { z } from 'zod';
import { budgetFindingSchema } from './budgetTypes';
export { budgetFindingSchema } from './budgetTypes';
import { browserDiagnosticSchema } from '../development-tooling/browserDiagnostics';
import { comparisonSchema } from '../development-tooling/comparisonTypes';
import { explanationSchema } from '../development-tooling/explanationTypes';
import { scenarioResultSchema } from './verificationCaptures';
export { captureRegionSchema, captureSchema, scenarioResultSchema } from './verificationCaptures';
import { runtimeKinds, unitIdPattern } from '../development-tooling/unitTypes';

const identifier = z.string().regex(unitIdPattern);
const text = z.string().min(1);
const commit = z.string().regex(/^[0-9a-f]{40}$/, 'must be a full commit or tree hash');
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'must be a sha256 hex digest');
const outcome = z.enum(['passed', 'failed']);

export const profileSchema = z.strictObject({
	id: text,
	platform: text,
	arch: text,
	cpu: text,
	cores: z.number().int().positive(),
	memoryBytes: z.number().int().positive(),
	runtime: text
});

const artifactSchema = z.strictObject({
	path: text,
	sha256,
	bytes: z.number().int().nonnegative()
});

export const retainedArtifactPath = 'artifacts/export';

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

const verificationRecordObject = z.strictObject({
	schemaVersion: z.literal(1),
	/** Source-rederived component contracts; absent legacy formats come from the source registry. */
	componentSchemaVersion: z.literal(2).optional(),
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
	/** Lite receipts carry their own outcome while the whole-commit status remains failed. */
	lite: z
		.strictObject({
			status: outcome,
			pendingChecks: z.array(text),
			pendingSetup: z.array(text),
			pendingTools: z.array(identifier),
			pendingEvidence: z.array(
				z.strictObject({
					scenario: identifier,
					evidence: identifier,
					state: identifier,
					viewport: identifier.optional()
				})
			)
		})
		.optional(),
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
			runner: z.enum(['vitest', 'playwright', 'command', 'godot']),
			target: text,
			status: outcome,
			durationMs: z.number().nonnegative(),
			browserErrors: z.array(browserDiagnosticSchema).optional(),
			log: artifactSchema
		})
	),
	scenarios: z.array(scenarioResultSchema),
	retainedArtifact: z
		.strictObject({
			sourcePath: text,
			path: z.literal(retainedArtifactPath),
			sha256,
			bytes: z.number().int().positive()
		})
		.optional(),
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
	/** Declared builds that an entity-scoped run deliberately did not build, by id. */
	skippedBuilds: z.array(identifier).optional(),
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

export const verificationRecordSchema = verificationRecordObject.refine(
	(record) => !record.lite || record.status === 'failed',
	{
		path: ['status'],
		message: 'Lite verification cannot prove a full commit.'
	}
);

export type * from './verificationTypes.types';
