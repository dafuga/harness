import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { types } from 'node:util';
import { z } from 'zod';
import { unitIdPattern } from '../../core/development-tooling/unitTypes';
import { median } from '../../utils/development-tooling/benchSamples';
import { recordCapture } from '../../utils/reports-media/record-capture/recordCapture';
import type {
	Measured,
	Observation,
	ObservationInput,
	ProfileInput
} from './PerformanceProfileService.types';
export type {
	Measured,
	Observation,
	ObservationInput,
	ProfileInput
} from './PerformanceProfileService.types';

export const profileInput = z.strictObject({
	unit: z.string().regex(unitIdPattern),
	workload: z.string().regex(unitIdPattern),
	callable: z.string().min(1).optional(),
	rounds: z.number().int().min(1).max(50).default(5),
	iterations: z.number().int().min(1).max(100_000).default(1000),
	warmups: z.number().int().min(0).max(100_000).default(3)
});
export const observationInput = profileInput.pick({ unit: true, workload: true, callable: true });

/** Measures the caller's representative operation; no replacement operation is used. */
export class PerformanceProfileService {
	private readonly observations = new Map<string, Observation>();

	/** Pinned Bun returns Darwin's native bytes; Node and other supported hosts report KiB. */
	static peakProcessRssBytes(): number {
		const peak = process.resourceUsage().maxRSS;
		const nativeBytes = Boolean(process.versions.bun) && process.platform === 'darwin';
		return nativeBytes ? peak : peak * 1024;
	}

	/** Module exports cannot move into a callback; only an explicitly completed scope is sampled. */
	beginScope(input: ObservationInput): () => void {
		const subject = observationInput.parse(input);
		const started = performance.now();
		let completed = false;
		return () => {
			if (completed) return;
			completed = true;
			completeObservation(this.observations, subject, performance.now() - started, 'scope');
		};
	}

	/** Time one synchronous return without replaying effects or inspecting returned values. */
	observe<T>(input: ObservationInput, operation: () => T): T {
		const subject = observationInput.parse(input);
		const started = performance.now();
		const result = operation();
		// A promise retains its identity and rejection handling; use observeAsync to time settlement.
		if (!types.isPromise(result))
			completeObservation(this.observations, subject, performance.now() - started, 'return');
		return result;
	}

	/** Explicit awaiting keeps failed operations failed and includes their complete async work. */
	async observeAsync<T>(input: ObservationInput, operation: () => T): Promise<Awaited<T>> {
		const subject = observationInput.parse(input);
		const started = performance.now();
		const result = await operation();
		completeObservation(this.observations, subject, performance.now() - started, 'await');
		return result;
	}

	/** Flush aggregate observations, keeping test values and parameters out of the evidence. */
	flush(): Measured[] {
		const measurements = [...this.observations.values()].flatMap(writeObservation);
		this.observations.clear();
		return measurements;
	}

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
				value: PerformanceProfileService.peakProcessRssBytes(),
				method:
					'Peak RSS of this whole process, normalized to bytes for this runtime, including its runner and earlier work; not memory attributable to one callable.'
			}
		];
	}

	/** Sampling and capture use the same Harness evidence protocol as verification. */
	async capture(input: ProfileInput, operation: () => unknown): Promise<Measured[]> {
		const measurements = await this.measure(input, operation);
		const key = JSON.stringify([input.unit, input.callable ?? '', input.workload]);
		const name = uniqueCaptureName('profile', key);
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

function completeObservation(
	observations: Map<string, Observation>,
	input: ObservationInput,
	elapsed: number,
	completion: Observation['completion']
): void {
	const key = JSON.stringify([input.unit, input.callable ?? '', input.workload, completion]);
	const previous = observations.get(key);
	const peakRss = PerformanceProfileService.peakProcessRssBytes();
	observations.set(key, {
		input,
		completion,
		elapsed: (previous?.elapsed ?? 0) + elapsed,
		samples: (previous?.samples ?? 0) + 1,
		peakRss: Math.max(previous?.peakRss ?? 0, peakRss)
	});
}

function writeObservation(observation: Observation): Measured[] {
	const { input, completion, elapsed, samples, peakRss } = observation;
	const labels = {
		return: 'synchronous returns',
		await: 'awaited operations',
		scope: 'completed source scopes'
	};
	const common = { ...input, target: 'module' as const, samples };
	const measurements: Measured[] = [
		{
			...common,
			metric: 'latency-observed-ms',
			unitOfMeasure: 'ms',
			value: elapsed / samples,
			method: `Arithmetic mean of ${samples} successful ${labels[completion]}; includes clock and observer overhead, with no replay or warmup.`
		},
		{
			...common,
			metric: 'process-peak-rss-bytes',
			unitOfMeasure: 'bytes',
			value: peakRss,
			method:
				'Peak RSS of this whole process, normalized to bytes for this runtime, including runner, profiler and earlier work; not memory attributable to one callable.'
		}
	];
	const key = JSON.stringify([input.unit, input.callable ?? '', input.workload, completion]);
	const name = uniqueCaptureName('observation', key);
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

/** A workload identifies comparable work; each captured chunk needs its own immutable path. */
function uniqueCaptureName(prefix: string, workloadKey: string): string {
	const group = createHash('sha256').update(workloadKey).digest('hex').slice(0, 24);
	return `${prefix}-${group}-${randomUUID()}`;
}
