import { randomUUID } from 'node:crypto';
import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';

/** Observe a normal behavior case, including its fixtures and assertions, without replaying it. */
export async function measureWorkload<T>(
	unit: string,
	workload: string,
	run: () => T | Promise<T>
): Promise<T> {
	if (!evidenceRequested()) return run();
	const start = performance.now();
	const result = await run();
	const duration = performance.now() - start;
	const context = { unit, workload, target: 'test-worker', samples: 1 };
	const measurements = [
		{
			...context,
			metric: 'behavior-case-duration-ms',
			unitOfMeasure: 'ms',
			value: duration,
			method: `Wall time of the normal behavior case in ${process.version}, including shared code, fixtures and assertions; no isolated-unit attribution or warmup.`
		},
		{
			...context,
			metric: 'worker-rss-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().rss,
			method:
				'Whole Vitest worker resident set after the behavior case, including shared runtime and fixtures; not isolated unit memory or peak RSS.'
		}
	];
	recordCapture(
		{
			evidence: 'behavior-benchmarks',
			kind: 'benchmark',
			state: workload,
			file: 'behavior-' + randomUUID() + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
	return result;
}
