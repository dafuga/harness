import type { PeakMemory } from '../../../../utils/peakMemory';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';

const tool = '/usr/bin/time';

/** Peak resident memory of one process run, from the system `time` tool where it exists. */
export function peakMemory(command: string, args: string[], input: string): PeakMemory {
	if (!existsSync(tool)) return { unavailable: `${tool} is not installed on this machine.` };
	const flag = platform() === 'darwin' ? '-l' : '-v';
	const result = spawnSync(tool, [flag, command, ...args], { input, encoding: 'utf8' });
	const report = result.stderr ?? '';
	const bsd = /(\d+)\s+maximum resident set size/.exec(report);
	const gnu = /Maximum resident set size \(kbytes\):\s*(\d+)/.exec(report);
	if (result.status === 0 && bsd) return { bytes: Number(bsd[1]) };
	if (result.status === 0 && gnu) return { bytes: Number(gnu[1]) * 1024 };
	return { unavailable: `${tool} ${flag} did not report a peak resident set size.` };
}
