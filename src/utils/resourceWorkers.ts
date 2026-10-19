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

/** Preserve stricter caller limits while preventing native runtimes from using every CPU. */
export function resourceThreads(env: Record<string, string | undefined>): Record<string, string> {
	const workers = resourceWorkers(env).maxWorkers;
	if (!workers) return {};
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
