/** Test runners honor the managed command's reservation instead of all logical host CPUs. */
export function resourceWorkers(
	env: Record<string, string | undefined> = process.env,
	maximumWorkers = Infinity
): {
	maxWorkers?: number;
	minWorkers?: number;
	env?: Record<string, string>;
} {
	const count = Number(env.HARNESS_RESOURCE_CPUS);
	if (!Number.isFinite(count) || count <= 0) return {};
	if (!(maximumWorkers >= 1)) throw new Error('Invalid test worker ceiling');
	const workers = Math.max(1, Math.floor(Math.min(count, maximumWorkers)));
	const worker = { ...env, HARNESS_RESOURCE_CPUS: String(Math.min(1, count)) };
	const context: Record<string, string> = {
		HARNESS_RESOURCE_CPUS: worker.HARNESS_RESOURCE_CPUS,
		...resourceThreads(worker)
	};
	const memory = Number(env.HARNESS_RESOURCE_MEMORY_MIB) / workers;
	if (Number.isFinite(memory) && memory > 0)
		context.HARNESS_RESOURCE_MEMORY_MIB = String(memory >= 1 ? Math.floor(memory) : memory);
	return { maxWorkers: workers, minWorkers: 1, env: context };
}

/** Preserve stricter caller limits while preventing native runtimes from using every CPU. */
export function resourceThreads(env: Record<string, string | undefined>): Record<string, string> {
	const count = Number(env.HARNESS_RESOURCE_CPUS);
	if (!Number.isFinite(count) || count <= 0) return {};
	const workers = Math.max(1, Math.floor(count));
	return Object.fromEntries(
		['CARGO_BUILD_JOBS', 'RAYON_NUM_THREADS', 'GOMAXPROCS', 'OMP_NUM_THREADS'].map((key) => {
			const existing = Number(env[key]);
			const limit =
				Number.isFinite(existing) && existing >= 1
					? Math.min(workers, Math.floor(existing))
					: workers;
			return [key, String(limit)];
		})
	);
}
