import { recordCapture } from '../../../src/utils/record-capture/recordCapture';

/** One normal in-memory registry reconciliation; memory includes the entire Vitest process. */
export function recordIndexWorkload(elapsedMs: number): void {
	const context = {
		unit: 'service.unit-index',
		workload: 'companion-unit-ownership',
		target: 'module',
		samples: 1
	};
	const measurements = [
		{
			...context,
			metric: 'latency-cold-ms',
			unitOfMeasure: 'ms',
			value: elapsedMs,
			method:
				'Wall time to scan and reconcile the standard three-file implementation and companion fixture.'
		},
		{
			...context,
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().rss,
			method:
				'Whole Vitest process RSS after in-memory source scanning and registry reconciliation; includes runner overhead.'
		}
	];
	recordCapture(
		{
			evidence: 'benchmark',
			kind: 'benchmark',
			state: 'index',
			file: 'companion-unit-ownership.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
