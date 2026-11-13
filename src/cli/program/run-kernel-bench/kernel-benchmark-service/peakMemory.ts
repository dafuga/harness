// @harness-uid u_trg35uiv2b
import type { PeakMemory } from '../../../../utils/development-tooling/peakMemory';
import { BoundedCommandAdapter } from '../../../../adapters/execution-runtimes/BoundedCommandAdapter';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';

const tool = '/usr/bin/time';

/** Peak resident memory of one process run, from the system `time` tool where it exists. */
export async function peakMemory(
	command: string,
	args: string[],
	input: string,
	timeoutMs = 60000
): Promise<PeakMemory> {
	if (!existsSync(tool)) return { unavailable: `${tool} is not installed on this machine.` };
	const flag = platform() === 'darwin' ? '-l' : '-v';
	const result = await new BoundedCommandAdapter().run(tool, [flag, command, ...args], {
		input,
		timeoutMs,
		maxBuffer: 1024 * 1024
	});
	const report = result.stderr ?? '';
	const bsd = /(\d+)\s+maximum resident set size/.exec(report);
	const gnu = /Maximum resident set size \(kbytes\):\s*(\d+)/.exec(report);
	if (result.code === 0 && bsd) return { bytes: Number(bsd[1]) };
	if (result.code === 0 && gnu) return { bytes: Number(gnu[1]) * 1024 };
	return { unavailable: `${tool} ${flag} did not report a peak resident set size.` };
}
