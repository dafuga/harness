import { setTimeout } from 'node:timers/promises';
import type { ResourceSnapshot } from '../../../../../core/execution-runtimes/resourceTypes';
import { hostMemory } from './hostMemory';
import { hostCpuCounters, resourceCpu } from './resourceCpu';
/** Samples system-wide counters; never substitutes load average or lifetime process CPU. */
export class HostResourcesAdapter {
	private before: ReturnType<typeof hostCpuCounters> | undefined;
	private pending: Promise<ResourceSnapshot> | undefined;
	sample(): Promise<ResourceSnapshot> {
		this.pending ??= this.measure().finally(() => {
			this.pending = undefined;
		});
		return this.pending;
	}
	private async measure(): Promise<ResourceSnapshot> {
		try {
			if (!this.before) {
				this.before = hostCpuCounters();
				await setTimeout(250);
			}
			const previous = this.before,
				current = hostCpuCounters();
			this.before = current;
			const cpu = resourceCpu(previous, current),
				memory = await hostMemory();
			memory.memoryTotalBytes = Math.min(
				memory.memoryTotalBytes,
				current.limits.memoryTotalBytes ?? Infinity
			);
			memory.memoryAvailableBytes = Math.min(
				memory.memoryAvailableBytes,
				current.limits.memoryAvailableBytes ?? Infinity
			);
			return { status: 'available', sampledAt: Date.now(), ...cpu, ...memory };
		} catch (error) {
			return {
				status: 'unavailable',
				sampledAt: Date.now(),
				logicalCores: 0,
				usableCores: 0,
				cpuUsedPercent: null,
				cpuAvailableCores: 0,
				memoryTotalBytes: 0,
				memoryAvailableBytes: 0,
				memoryPressure: 'unknown',
				reason: error instanceof Error ? error.message : 'Resource probe failed'
			};
		}
	}
}
