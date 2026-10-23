import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';
import { randomUUID } from 'node:crypto';
import {
	mib,
	resourceConfigSchema,
	resourceRequestSchema,
	type ResourceJob,
	type ResourceSnapshot
} from '../../src/core/execution-runtimes/resourceTypes';
export const config = resourceConfigSchema.parse({ pollMs: 250 });
export function snapshot(changes: Partial<ResourceSnapshot> = {}): ResourceSnapshot {
	return {
		status: 'available',
		sampledAt: Date.now(),
		logicalCores: 10,
		usableCores: 10,
		cpuUsedPercent: 0,
		cpuAvailableCores: 10,
		memoryTotalBytes: 16 * 1024 * mib,
		memoryAvailableBytes: 16 * 1024 * mib,
		memoryPressure: 'normal',
		...changes
	};
}
export function job(changes: Partial<ResourceJob> = {}): ResourceJob {
	return {
		...resourceRequestSchema.parse({}),
		id: randomUUID(),
		sequence: 1,
		ownerPid: process.pid,
		ownerStarted: 'fixture owner',
		state: 'queued',
		createdAt: Date.now(),
		heartbeatAt: Date.now(),
		notice: null,
		...changes
	};
}

/** One real fixture lifecycle; figures include the shared test process and earlier allocations. */
export function observeResources(units: string[], workload: string) {
	const started = performance.now();
	return () => {
		if (!evidenceRequested()) return;
		const nativeBytes = Boolean(process.versions.bun) && process.platform === 'darwin';
		const rss = process.resourceUsage().maxRSS * (nativeBytes ? 1 : 1024);
		const measurements = units.flatMap((unit) => [
			{
				unit,
				workload,
				target: 'module',
				samples: 1,
				metric: 'latency-fixture-ms',
				unitOfMeasure: 'ms',
				value: performance.now() - started,
				method:
					'Wall time of the actual standardized fixture lifecycle, including setup, assertions and cleanup; not isolated callable latency.'
			},
			{
				unit,
				workload,
				target: 'module',
				samples: 1,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: rss,
				method:
					'OS peak RSS of the whole test process, including shared runtime and earlier work; not isolated unit memory or child-process memory.'
			}
		]);
		recordCapture(
			{
				evidence: 'resource-fixture',
				kind: 'benchmark',
				state: 'fixture-lifecycle',
				file: 'resource-' + randomUUID() + '.json',
				mediaType: 'application/json'
			},
			JSON.stringify({ measurements })
		);
	};
}
