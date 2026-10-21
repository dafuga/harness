import { z } from 'zod';
import { runtimeKinds } from './unitTypes';
import { measurementSchema, profileSchema } from '../verification-evidence/verificationTypes';

export const measurementsDirectory = 'specification/measurements/impact-kernel';
export const representativeWorkload = 'graph-1k';

const text = z.string().min(1);
const commit = z.string().regex(/^[0-9a-f]{40}$/);
const runtime = z.enum(runtimeKinds);

export const calibrationNote =
	'Observational measurements from a local benchmark run. They are not verification evidence ' +
	'and cannot establish or satisfy a budget baseline.';

/**
 * A benchmark file is calibration, never proof. The literals make that impossible to edit away:
 * verified measurements exist only inside verification records.
 */
export const calibrationSchema = z.strictObject({
	kind: z.literal('calibration'),
	verified: z.literal(false),
	note: text
});

/**
 * A benchmark measurement names a tested revision only when the tree was clean at that commit;
 * measurements from an uncommitted tree are attributable to no revision.
 */
export const benchMeasurementSchema = measurementSchema.extend({
	testedRevision: commit.nullable()
});

export const kernelBenchmarkSchema = z.object({
	schemaVersion: z.literal(1),
	contract: text,
	recordedAt: text,
	profile: profileSchema,
	/** The commit the working tree was based on, and whether it had uncommitted changes. */
	source: z.strictObject({ commit: commit.nullable(), dirty: z.boolean() }),
	provenance: calibrationSchema,
	workloads: z.array(
		z.strictObject({
			id: text,
			nodes: z.number().int().nonnegative(),
			edges: z.number().int().nonnegative(),
			changed: z.number().int().nonnegative(),
			requestBytes: z.number().int().positive(),
			responseBytes: z.number().int().positive()
		})
	),
	measurements: z.array(benchMeasurementSchema),
	default: z.strictObject({
		runtime,
		basis: z.enum(['measured', 'unmeasured']),
		workload: text,
		profile: text,
		rule: text,
		candidates: z.array(z.strictObject({ runtime, coldMs: z.number() })),
		excluded: z.array(z.strictObject({ runtime, reason: text }))
	})
});

export type BenchMeasurement = z.infer<typeof benchMeasurementSchema>;
export type KernelBenchmark = z.infer<typeof kernelBenchmarkSchema>;
