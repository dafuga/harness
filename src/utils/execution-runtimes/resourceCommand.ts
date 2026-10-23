import { join } from 'node:path';
import type { ResourceContext } from '../../core/execution-runtimes/resourceTypes';
import { runIsolated } from '../reports-media/run-isolated/runIsolated';
import { resourceHome } from './resourceConfig';
/** The existing ownership-aware runner preserves streams and tears down only its own processes. */
export async function resourceCommand(
	args: string[],
	context: ResourceContext,
	signal?: AbortSignal,
	timeoutMs = 21600000
): Promise<number> {
	validateTimeout(timeoutMs);
	if (!args.length) throw new Error('A managed command is required after --');
	const result = await runIsolated({
		command: args[0],
		args: args.slice(1),
		cwd: process.cwd(),
		signal,
		stdio: 'inherit',
		onSpawn: context.track,
		env: context.env,
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

function validateTimeout(timeout: number): void {
	if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647)
		throw new Error('Invalid managed command timeout');
}
