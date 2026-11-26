// @harness-uid u_brlpykl7az
import { execFileSync } from 'node:child_process';
import { readFileSync, statfsSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import type { TrackerHealthHost, TrackerHealthProcess } from '../TrackerHealthService.types';
import { trackerProcessRows } from './trackerProcessRows';

export function localTrackerHealthHost(): TrackerHealthHost {
	return {
		freeDiskBytes(path) {
			const stat = statfsSync(path);
			return stat.bavail * stat.bsize;
		},
		availableMemoryMb: linuxAvailableMemoryMb,
		load15: () => loadavg()[2],
		cores: cpus().length || 1,
		processes: listProcesses
	};
}

/** macOS reports little free memory by design, so only Linux is judged. */
function linuxAvailableMemoryMb(): number | null {
	if (process.platform !== 'linux') return null;
	const match = /MemAvailable:\s+(\d+)/.exec(readFileSync('/proc/meminfo', 'utf8'));
	return match ? Number(match[1]) / 1024 : null;
}

function listProcesses(): TrackerHealthProcess[] {
	const output = execFileSync('ps', ['-axww', '-o', 'pid=,etime=,command='], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024,
		timeout: 10_000
	});
	return trackerProcessRows(output);
}
