// @harness-uid u_ppagdjm4wo
import type { BenchmarkProcessInput, BenchmarkProcessResult } from './benchmarkProcess.types';
export type { BenchmarkProcessInput, BenchmarkProcessResult } from './benchmarkProcess.types';
import { BoundedCommandAdapter } from '../../../adapters/execution-runtimes/BoundedCommandAdapter';
export function benchmarkEnvironment(): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = { HARNESS_ANALYTICS_DISABLED: '1' };
	for (const key of [
		'PATH',
		'HOME',
		'USER',
		'LOGNAME',
		'SHELL',
		'TMPDIR',
		'TEMP',
		'LANG',
		'TZ',
		'SYSTEMROOT'
	])
		if (process.env[key]) env[key] = process.env[key];
	return env;
}
export async function benchmarkProcess(
	input: BenchmarkProcessInput
): Promise<BenchmarkProcessResult> {
	const result = await new BoundedCommandAdapter().run(input.command[0], input.command.slice(1), {
		cwd: input.cwd,
		env: benchmarkEnvironment(),
		input: input.input,
		signal: input.signal,
		timeoutMs: input.timeoutMs,
		maxBuffer: 8_000_000
	});
	return { exitCode: result.code, stdout: result.stdout.toString('utf8'), stderr: result.stderr };
}
