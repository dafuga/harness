// @harness-uid u_b4uzqkb2i6
import { BoundedCommandAdapter } from '../../../adapters/execution-runtimes/BoundedCommandAdapter';
import { BoundedCommandFailure } from '../../../adapters/execution-runtimes/bounded-command-adapter/commandFailure';
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { redactSecrets } from '../../../utils/agents-providers/redactSecrets';

const logTailLength = 6000;

/** Run the committed argv against the worktree, using the host's bounded process runner. */
export async function runTaskCheck(
	check: NonNullable<ModuleTask['check']>,
	cwd: string,
	signal: AbortSignal
) {
	const [program, ...args] = check.argv;
	const startedAt = performance.now();
	try {
		const { code, stdout, stderr } = await new BoundedCommandAdapter().run(program, args, {
			cwd,
			signal,
			timeoutMs: check.timeoutMs ?? 180_000,
			maxBuffer: 1024 * 1024,
			env: { HARNESS_RESOURCES_HOME: process.env.HARNESS_RESOURCES_HOME }
		});
		return {
			receipt: {
				status: code === 0 ? ('passed' as const) : ('failed' as const),
				exitCode: code,
				durationMs: Math.round(performance.now() - startedAt)
			},
			output: code === 0 ? '' : checkOutputTail(stdout, stderr)
		};
	} catch (error) {
		const failure = error instanceof BoundedCommandFailure ? error : undefined;
		return {
			receipt: {
				status: checkFailureStatus(signal, failure),
				exitCode: null,
				durationMs: Math.round(performance.now() - startedAt)
			},
			output: failure ? checkOutputTail(failure.stdout, failure.stderr) : ''
		};
	}
}

function checkFailureStatus(signal: AbortSignal, failure: BoundedCommandFailure | undefined) {
	if (signal.aborted) return 'cancelled' as const;
	return failure?.message.startsWith('Command timed out after ')
		? ('timeout' as const)
		: ('command-error' as const);
}

function checkOutputTail(stdout: Buffer, stderr: string): string {
	const clean = redactSecrets(stdout.toString('utf8') + '\n' + stderr);
	// Tests can write terminal control codes. Keep tabs and newlines for diagnostics.
	return (
		clean
			// eslint-disable-next-line no-control-regex
			.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
			.trim()
			.slice(-logTailLength)
	);
}
