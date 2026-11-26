// @harness-uid u_hna6b35jba
import { availableParallelism, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { hostResourceLimits } from './hostResourceLimits';
import type { Counters } from './resourceCpu.types';
import { CpuIntervalError } from './resourceCpu.types';
import type { HostLimits } from './hostResourceLimits.types';
export type { Counters } from './resourceCpu.types';
export function hostCpuCounters(): {
	at: number;
	limits: HostLimits;
	cores: number;
	affinity: number;
	idle: number;
	total: number;
} {
	const all = cpus();
	return {
		at: performance.now(),
		limits: hostResourceLimits(),
		cores: all.length,
		affinity: availableParallelism(),
		idle: all.reduce((n, c) => n + c.times.idle, 0),
		total: all.reduce((n, c) => n + Object.values(c.times).reduce((a, b) => a + b, 0), 0)
	};
}
/** Quota counters supplement host counters, which can hide container saturation. */
export function resourceCpu(previous: Counters, current: Counters) {
	const elapsed = current.total - previous.total,
		idle = current.idle - previous.idle;
	if (
		!current.cores ||
		current.cores !== previous.cores ||
		elapsed <= 0 ||
		idle < 0 ||
		idle > elapsed
	)
		throw new CpuIntervalError('Invalid CPU interval');
	const usable = Math.min(current.cores, current.affinity, current.limits.cores ?? Infinity);
	const available = Math.max(
		0,
		Math.min((usable * idle) / elapsed, quotaAvailable(previous, current, usable))
	);
	return {
		logicalCores: current.cores,
		usableCores: usable,
		cpuUsedPercent: (1 - idle / elapsed) * 100,
		cpuAvailableCores: available
	};
}
function quotaAvailable(previous: Counters, current: Counters, usable: number): number {
	const used = current.limits.cpuUsedUs,
		before = previous.limits.cpuUsedUs;
	if (used === undefined) return usable;
	if (before === undefined || used < before || current.limits.cores !== previous.limits.cores)
		throw new CpuIntervalError('CPU quota changed; waiting for a fresh interval');
	const available = usable - (used - before) / (current.at - previous.at) / 1000;
	if (!Number.isFinite(available)) throw new CpuIntervalError('Invalid CPU quota counters');
	return available;
}
