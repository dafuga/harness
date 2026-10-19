import { join } from 'node:path';
import { runIsolated } from './runIsolated';
import { resourceHome } from './resourceConfig';
import type { ResourceContext } from '../core/resourceTypes';
/** The existing ownership-aware runner preserves streams and tears down only its own processes. */
export async function resourceCommand(
	args: string[],
	context: ResourceContext,
	signal?: AbortSignal,
	timeoutMs = 21600000
): Promise<number> {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647)
		throw new Error('Invalid managed command timeout');
	if (!args.length) throw new Error('A managed command is required after --');
	const count = String(Math.max(1, Math.floor(Number(context.env.HARNESS_RESOURCE_CPUS))));
	const result = await runIsolated({
		command: args[0],
		args: args.slice(1),
		cwd: process.cwd(),
		signal,
		stdio: 'inherit',
		onSpawn: context.track,
		env: {
			...context.env,
			CARGO_BUILD_JOBS: count,
			RAYON_NUM_THREADS: count,
			GOMAXPROCS: count,
			OMP_NUM_THREADS: count
		},
		timeoutMs,
		maxLogBytes: 1000000,
		log: join(resourceHome(context.env), 'logs', context.id + '.log')
	});
	signal?.throwIfAborted();
	if (result.status !== 'passed')
		console.error(
			`[harness resources] Managed command ${result.status}; exit ${result.exitCode ?? 'unknown'}, remaining processes ${result.survivors.length}, cleanup unknown ${result.unknown === true}`
		);
	if (result.status === 'passed') return 0;
	return result.exitCode === 0 ? 1 : (result.exitCode ?? 1);
}
