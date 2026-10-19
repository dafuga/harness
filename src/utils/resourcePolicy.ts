import {
	mib,
	resourcePriorities,
	type ResourceConfig,
	type ResourceJob,
	type ResourceRequest,
	type ResourceSnapshot
} from '../core/resourceTypes';
export function resourcePressure(
	sample: ResourceSnapshot,
	config: ResourceConfig,
	now = Date.now()
): string | null {
	if (
		sample.status !== 'available' ||
		now - sample.sampledAt > config.staleSampleMs ||
		sample.sampledAt > now + 1000
	)
		return 'Resource telemetry is unavailable or stale';
	if (invalidTelemetry(sample)) return 'Invalid resource telemetry';
	if (sample.memoryPressure !== 'normal') return `Memory pressure is ${sample.memoryPressure}`;
	if (sample.cpuAvailableCores < (sample.usableCores * config.cpuReservePercent) / 100)
		return 'CPU reserve is exhausted';
	if (sample.memoryAvailableBytes < memoryReserve(sample, config))
		return 'Memory reserve is exhausted';
	return null;
}
export function memoryReserve(sample: ResourceSnapshot, config: ResourceConfig): number {
	return Math.max(
		(sample.memoryTotalBytes * config.memoryReservePercent) / 100,
		config.minMemoryReserveMiB * mib
	);
}
export function impossibleRequest(
	request: ResourceRequest,
	sample: ResourceSnapshot,
	config: ResourceConfig
): boolean {
	if (sample.status !== 'available') return false;
	return (
		request.cpus > sample.usableCores * (1 - config.cpuReservePercent / 100) ||
		request.memoryMiB * mib > sample.memoryTotalBytes - memoryReserve(sample, config)
	);
}
/** Reservations deliberately remain additional to observed load: a newly admitted task may not be busy yet. */
export function resourcePolicy(
	jobs: ResourceJob[],
	sample: ResourceSnapshot,
	config: ResourceConfig,
	now = Date.now()
) {
	const pressure = resourcePressure(sample, config, now);
	const ids = new Set(jobs.map((job) => job.id));
	const roots = jobs.filter(
		(job) => !job.parentId || (job.state === 'running' && !ids.has(job.parentId))
	);
	const granted: string[] = [];
	if (pressure) return { granted, reason: pressure };
	granted.push(
		...grantPool(
			roots,
			sample.cpuAvailableCores - (sample.usableCores * config.cpuReservePercent) / 100,
			sample.memoryAvailableBytes - memoryReserve(sample, config)
		)
	);
	for (const parent of jobs) {
		if (parent.state !== 'running' && !granted.includes(parent.id)) continue;
		granted.push(
			...grantPool(
				jobs.filter((j) => j.parentId === parent.id),
				parent.cpus,
				parent.memoryMiB * mib
			)
		);
	}
	return { granted, reason: granted.length ? null : 'Waiting for CPU and memory reservations' };
}
function grantPool(jobs: ResourceJob[], cpu: number, memory: number): string[] {
	const running = jobs.filter((j) => j.state === 'running');
	cpu -= running.reduce((n, j) => n + j.cpus, 0);
	memory -= running.reduce((n, j) => n + j.memoryMiB * mib, 0);
	const queued = jobs
		.filter((j) => j.state === 'queued')
		.sort(
			(a, b) =>
				resourcePriorities.indexOf(a.priority) - resourcePriorities.indexOf(b.priority) ||
				a.sequence - b.sequence
		);
	const granted: string[] = [];
	for (const job of queued) {
		if (job.cpus > cpu || job.memoryMiB * mib > memory) break;
		granted.push(job.id);
		cpu -= job.cpus;
		memory -= job.memoryMiB * mib;
	}
	return granted;
}

function invalidTelemetry(sample: ResourceSnapshot): boolean {
	const values = [
		sample.sampledAt,
		sample.logicalCores,
		sample.usableCores,
		sample.cpuAvailableCores,
		sample.memoryTotalBytes,
		sample.memoryAvailableBytes,
		sample.cpuUsedPercent
	];
	return (
		values.some((n) => n === null || !Number.isFinite(n)) ||
		invalidCpu(sample) ||
		invalidMemory(sample)
	);
}
function invalidCpu(sample: ResourceSnapshot): boolean {
	return (
		sample.logicalCores <= 0 ||
		sample.usableCores <= 0 ||
		sample.usableCores > sample.logicalCores ||
		sample.cpuAvailableCores < 0 ||
		sample.cpuAvailableCores > sample.usableCores ||
		sample.cpuUsedPercent! < 0 ||
		sample.cpuUsedPercent! > 100
	);
}
function invalidMemory(sample: ResourceSnapshot): boolean {
	return (
		sample.memoryTotalBytes <= 0 ||
		sample.memoryAvailableBytes < 0 ||
		sample.memoryAvailableBytes > sample.memoryTotalBytes
	);
}
