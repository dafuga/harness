/** Resource context is propagated separately from a subprocess's application configuration. */
export function resourceEnvironment(
	env: Record<string, string | undefined> = process.env
): Record<string, string | undefined> {
	const keys = [
		'HARNESS_RESOURCES_HOME',
		'HARNESS_RESOURCE_LEASE',
		'HARNESS_RESOURCE_CPUS',
		'HARNESS_RESOURCE_MEMORY_MIB',
		'HARNESS_RESOURCE_PRIORITY',
		'CARGO_BUILD_JOBS',
		'RAYON_NUM_THREADS',
		'GOMAXPROCS',
		'OMP_NUM_THREADS'
	];
	return Object.fromEntries(
		keys.filter((key) => env[key] !== undefined).map((key) => [key, env[key]])
	);
}
