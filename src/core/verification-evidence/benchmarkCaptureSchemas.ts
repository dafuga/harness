// @harness-uid u_wwu3xgisul
import { z } from 'zod';
import { comparisonSchema } from '../development-tooling/comparisonTypes';
import { runtimeKinds, unitIdPattern } from '../development-tooling/unitTypes';

const text = z.string().min(1);
const identifier = z.string().regex(unitIdPattern);

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
