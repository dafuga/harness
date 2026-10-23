import type { VerifyConfig } from './verifyTypes.types';
import { z } from 'zod';
import { comparisonSchema } from '../development-tooling/comparisonTypes';
import { runtimeKinds, unitIdPattern } from '../development-tooling/unitTypes';

export const verifyConfigFile = 'harness.verify.json';
/** Scratch store for verification drafts until they are persisted as Git evidence. */
export const verificationsDirectory = '.cache/harness/verifications';
export const snapshotsDirectory = '.cache/harness/snapshots';
export const captureIndex = 'captures.ndjson';

const text = z.string().min(1);
const identifier = z.string().regex(unitIdPattern);

/** How this repository's checks run inside a verification snapshot. */
export const verifyConfigSchema = z.strictObject({
	schemaVersion: z.literal(1),
	/** New task contracts require profiling even when no performance budget is declared. */
	performanceRequired: z.literal(1).optional(),
	/**
	 * The version of the writing limits this revision is held to: its reasons must be as short
	 * as that version says, 20 words an attempt under 1 and 15 under 2. A revision that declares
	 * none is held to none.
	 */
	writing: z.union([z.literal(1), z.literal(2)]).optional(),
	/** Commands run in the snapshot before any check, for example a locked install. */
	setup: z.array(
		z.strictObject({ command: text, timeoutMs: z.number().int().positive().optional() })
	),
	/** Paths shared from the checkout instead of rebuilt, for example node_modules. */
	link: z.array(text),
	/**
	 * Paths setup commands and checks may create inside the snapshot: build output, caches and
	 * reports. A trailing slash names a directory. Everything else must stay exactly as
	 * committed, and a declaration may not cover a tracked file.
	 */
	outputs: z.array(text).default([]),
	/**
	 * Compiled output that setup produces and a server then serves. Its identity is computed in
	 * the snapshot, and evidence that names the build must have been served by exactly it.
	 */
	builds: z.array(z.strictObject({ id: identifier, directory: text })).default([]),
	/**
	 * Tools the checks depend on. Each command runs in the snapshot after setup and the first
	 * line it prints is recorded, so a record says which versions produced it.
	 */
	tools: z.array(z.strictObject({ id: identifier, command: text })).default([]),
	/** Command templates per runner; `{target}` is replaced by the test file. */
	runners: z.record(z.string(), text),
	/**
	 * Test files that need a command of their own, for example another configuration of the
	 * same runner. `path` is the tracked file; the command runs in its workspace.
	 */
	checks: z
		.array(
			z.strictObject({
				path: text,
				command: text,
				timeoutMs: z.number().int().positive().optional()
			})
		)
		.default([]),
	timeouts: z.strictObject({ test: z.number().int().positive() })
});

export const defaultVerifyConfig: VerifyConfig = {
	schemaVersion: 1,
	setup: [],
	link: [],
	outputs: [],
	builds: [],
	tools: [],
	checks: [],
	runners: {
		vitest: 'bun x vitest run {target}',
		playwright: 'bun x playwright test {target}'
	},
	timeouts: { test: 600_000 }
};

/** One line a check writes to `captures.ndjson` in `HARNESS_EVIDENCE_DIR`. */
export const captureLineSchema = z.strictObject({
	evidence: identifier,
	kind: z.enum(['screenshot', 'audio', 'output', 'assertions', 'trace', 'benchmark']),
	state: identifier,
	viewport: identifier.optional(),
	/** File name inside the evidence directory. */
	file: z.string().regex(/^[\w.-]+$/, 'must be a plain file name'),
	mediaType: text,
	provenance: z.enum(['fixture', 'actual-capture']).optional(),
	transcript: z.string().optional(),
	durationSeconds: z.number().positive().optional(),
	server: z.strictObject({ buildId: text, revision: text }).optional(),
	note: z.string().optional()
});

/** One measurement a benchmark capture reports; the run adds its profile and revision. */
export const reportedMeasurementSchema = z.object({
	unit: text,
	/** Selected exported callable when a module contains several helpers. */
	callable: text.optional(),
	metric: text,
	unitOfMeasure: text,
	value: z.number().nullable(),
	unavailable: z.string().optional(),
	method: text,
	workload: z.string().nullable(),
	target: z.enum(runtimeKinds).optional(),
	samples: z.number().int().positive().optional(),
	/** Explicit and validated: a budget never compares a measurement that only has a label. */
	comparison: comparisonSchema.optional()
});

/** The file a benchmark capture names: its measurements, plus whatever else the check adds. */
export const benchmarkCaptureSchema = z.object({
	measurements: z.array(reportedMeasurementSchema)
});

/** A request to send repeatedly through a unit's declared execution target. */
export const workloadSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: identifier,
	request: z.strictObject({ operation: text, input: z.unknown().optional() }),
	rounds: z.number().int().min(1).max(50),
	iterations: z.number().int().min(1).max(100_000)
});

export type { VerifyConfig, CaptureLine, Workload } from './verifyTypes.types';
