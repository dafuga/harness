import { z } from 'zod';

const text = z.string().trim().min(1);
const count = z.number().int().nonnegative();

/** Harness's own benchmark protocol: warm-up calls, then rounds of timed whole invocations. */
export const roundsProtocol = 'harness-rounds/1';
/** Calls made before the first timed round; part of the protocol, so part of the context. */
export const warmupCalls = 3;
export const measurementBoundaries = ['public-invocation', 'fixture'] as const;

/** The unit each budgeted metric is measured in. Another unit is never converted or compared. */
export const metricUnits: Record<string, string> = {
	'latency-cold-ms': 'ms',
	'latency-warm-ms': 'ms',
	'latency-floor-ms': 'ms',
	'throughput-ops': 'ops/s',
	'memory-bytes': 'bytes'
};

/**
 * What must be identical before two measurements may be compared: the complete request, what
 * the timing encloses and how samples were taken. A workload name identifies none of these.
 */
export const comparisonSchema = z.strictObject({
	/** sha256 of the canonical request the workload sends: its operation and complete input. */
	request: z.string().regex(/^[0-9a-f]{64}$/, 'must be a sha256 hex digest'),
	/** `public-invocation` times the whole call; `fixture` is a value a test fixture declares. */
	boundary: z.enum(measurementBoundaries),
	protocol: text,
	sampling: z.strictObject({ warmup: count, rounds: count.min(1), iterations: count.min(1) })
});

export type { Comparison } from './comparisonTypes.types';
