import type { Runner, ProcessInput } from './measureProcess.types';
export type { Runner, ProcessInput } from './measureProcess.types';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { evidenceRequested, recordCapture } from '../../../src/utils/record-capture/recordCapture';
import type { CommandResult } from '../cli';

/** One actual child invocation; OS usage belongs to that child, not the test runner. */
export async function measureProcess(input: ProcessInput, run: Runner): Promise<CommandResult> {
	const { units } = input;
	if (!evidenceRequested() || !units.length)
		return run(input.command, input.cwd, input.expectSuccess, input.env);
	if (!existsSync('/usr/bin/time'))
		throw new Error('No process usage collector is available for the required workload.');
	const directory = await mkdtemp(join(tmpdir(), 'harness-cli-usage-'));
	const usage = join(directory, 'usage.txt');
	try {
		const start = performance.now();
		const result = await run(
			['/usr/bin/time', process.platform === 'darwin' ? '-l' : '-v', '-o', usage, ...input.command],
			input.cwd,
			input.expectSuccess,
			input.env
		);
		const duration = performance.now() - start;
		if (result.exitCode === 0) recordUsage(input, duration, await readFile(usage, 'utf8'));
		return result;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function recordUsage(input: ProcessInput, duration: number, usage: string): void {
	const resident =
		process.platform === 'darwin'
			? /^\s*(\d+)\s+maximum resident set size/m.exec(usage)
			: /Maximum resident set size \(kbytes\):\s*(\d+)/.exec(usage);
	if (!resident) throw new Error('The child workload did not report peak RSS.');
	const memory = Number(resident[1]) * (process.platform === 'darwin' ? 1 : 1024);
	const measurements = input.units.flatMap((unit) => {
		const context = {
			unit,
			workload: input.workload,
			target: input.target,
			samples: 1,
			...(input.partial ? { partial: input.partial } : {})
		};
		return [
			{
				...context,
				metric: input.target === 'process' ? 'latency-cli-ms' : 'latency-process-ms',
				unitOfMeasure: 'ms',
				value: duration,
				method:
					'Wall time of one cold child-process workload including startup and shared code; no isolated-unit attribution or warmup.'
			},
			{
				...context,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: memory,
				method:
					'OS-reported peak RSS for the actual child process workload, including runtime and OS child accounting; excludes the parent test runner. Not isolated unit memory or a summed process-tree peak.'
			}
		];
	});
	recordCapture(
		{
			evidence: 'process-benchmarks',
			kind: 'benchmark',
			state: 'child-workload',
			file: 'process-' + randomUUID() + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
