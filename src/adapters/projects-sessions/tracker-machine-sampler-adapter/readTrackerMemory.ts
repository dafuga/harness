// @harness-uid u_mkuyvfniu4
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { freemem, totalmem } from 'node:os';
import {
	parseTrackerMeminfo,
	parseTrackerMemoryPressure,
	parseTrackerPressureFree,
	parseTrackerSwapUsage,
	parseTrackerVmStat
} from './trackerMemoryParsers';
import type { TrackerResourceSample } from '../../../utils/projects-sessions/trackerMachine.types';

const mib = 1024 * 1024;

/** This computer's memory and swap, as the sample reports them. */
export async function readTrackerMemory(): Promise<Pick<TrackerResourceSample, 'ram' | 'swap'>> {
	if (process.platform === 'darwin') return macMemory();
	if (process.platform !== 'linux')
		return shape({ total: totalmem(), available: freemem(), swapTotal: 0, swapUsed: 0 });
	return shape(parseTrackerMeminfo(readFileSync('/proc/meminfo', 'utf8')));
}

async function macMemory() {
	const [pages, swap, level, free] = await Promise.all([
		read('/usr/bin/vm_stat', []),
		read('/usr/sbin/sysctl', ['-n', 'vm.swapusage']),
		read('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']),
		read('/usr/bin/memory_pressure', ['-Q'])
	]);
	const available = parseTrackerVmStat(pages) || freemem();
	const reading = shape({ total: totalmem(), available, ...parseTrackerSwapUsage(swap) });
	const pressure = parseTrackerMemoryPressure(level);
	const percent = parseTrackerPressureFree(free);
	return {
		...reading,
		ram: {
			...reading.ram,
			...(pressure && { pressure }),
			...(percent !== undefined && { pressure_free_pct: percent })
		}
	};
}

function shape(memory: ReturnType<typeof parseTrackerMeminfo>) {
	const { total, available, swapTotal, swapUsed } = memory;
	return {
		ram: {
			total_mb: Math.round(total / mib),
			used_mb: Math.round((total - available) / mib),
			available_mb: Math.round(available / mib),
			available_pct: total ? Math.round((1000 * available) / total) / 10 : 0
		},
		swap: { total_mb: Math.round(swapTotal / mib), used_mb: Math.round(swapUsed / mib) }
	};
}

function read(command: string, args: string[]): Promise<string> {
	return new Promise((resolve) => {
		execFile(command, args, { timeout: 10_000 }, (error, stdout) => resolve(error ? '' : stdout));
	});
}
