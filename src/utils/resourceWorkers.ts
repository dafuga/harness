/** Test runners honor the managed command's reservation instead of all logical host CPUs. */
export function resourceWorkers(env: Record<string, string | undefined> = process.env): {
	maxWorkers?: number;
	minWorkers?: number;
} {
	const count = Number(env.HARNESS_RESOURCE_CPUS);
	return Number.isFinite(count) && count > 0
		? { maxWorkers: Math.max(1, Math.floor(count)), minWorkers: 1 }
		: {};
}
