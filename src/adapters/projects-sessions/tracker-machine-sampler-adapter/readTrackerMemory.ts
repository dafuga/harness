// @harness-uid u_mkuyvfniu4
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

import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';

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
		readTrackerMetricsCommand('/usr/bin/vm_stat', []),
		readTrackerMetricsCommand('/usr/sbin/sysctl', ['-n', 'vm.swapusage']),
		readTrackerMetricsCommand('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']),
		readTrackerMetricsCommand('/usr/bin/memory_pressure', ['-Q'])
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

/** A failed or unavailable metric command leaves its reading empty. */
export async function readTrackerMetricsCommand(command: string, args: string[]): Promise<string> {
	const { PATH, TMUX_TMPDIR } = process.env;
	const environment = { ...(PATH && { PATH }), ...(TMUX_TMPDIR && { TMUX_TMPDIR }) };
	try {
		const { code, stdout } = await runTrackerHostCommand(
			command,
			args,
			AbortSignal.timeout(10_000),
			{
				environment,
				maxBuffer: 16 * mib
			}
		);
		return code === 0 ? stdout : '';
	} catch {
		return '';
	}
}
