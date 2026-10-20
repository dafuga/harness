import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { recordCapture } from '../utils/record-capture/recordCapture';
import { median } from '../utils/benchSamples';
import { unitIdPattern } from '../core/unitTypes';
import type { reportedMeasurementSchema } from '../core/verifyTypes';

const profileInput = z.strictObject({
	unit: z.string().regex(unitIdPattern),
	workload: z.string().regex(unitIdPattern),
	callable: z.string().min(1).optional(),
	rounds: z.number().int().min(1).max(50).default(5),
	iterations: z.number().int().min(1).max(100_000).default(1000),
	warmups: z.number().int().min(0).max(100_000).default(3)
});
export type ProfileInput = z.input<typeof profileInput>;
type Measured = z.infer<typeof reportedMeasurementSchema>;

/** Measures the caller's representative operation; no replacement operation is used. */
export class PerformanceProfileService {
	async measure(input: ProfileInput, operation: () => unknown): Promise<Measured[]> {
		const { unit, workload, callable, rounds, iterations, warmups } = profileInput.parse(input);
		for (let index = 0; index < warmups; index++) await operation();
		const elapsed: number[] = [];
		for (let round = 0; round < rounds; round++) {
			const started = performance.now();
			for (let index = 0; index < iterations; index++) await operation();
			elapsed.push((performance.now() - started) / iterations);
		}
		const common = {
			unit,
			workload,
			callable,
			target: 'module' as const,
			samples: rounds * iterations
		};
		return [
			{
				...common,
				metric: 'latency-warm-ms',
				unitOfMeasure: 'ms',
				value: median(elapsed),
				method: `Median of ${rounds} batches of ${iterations} awaited representative calls after ${warmups} warmups; includes await overhead.`
			},
			{
				...common,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: process.resourceUsage().maxRSS * 1024,
				method:
					'Peak RSS of this whole process, including its runner and earlier work; not memory attributable to one callable.'
			}
		];
	}

	/** Sampling and capture use the same Harness evidence protocol as verification. */
	async capture(input: ProfileInput, operation: () => unknown): Promise<Measured[]> {
		const measurements = await this.measure(input, operation);
		const key = JSON.stringify([input.unit, input.callable ?? '', input.workload]);
		const name = `profile-${createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
		recordCapture(
			{
				evidence: name,
				kind: 'benchmark',
				state: 'representative',
				file: `${name}.json`,
				mediaType: 'application/json'
			},
			JSON.stringify({ measurements })
		);
		return measurements;
	}
}
