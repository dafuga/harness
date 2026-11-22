// @harness-uid u_3wlbqeyf7m
import { performance } from 'node:perf_hooks';
import { BoundedCommandAdapter } from '../../../../adapters/execution-runtimes/BoundedCommandAdapter';
import { cpus, platform } from 'node:os';
import { cpuProcesses } from './cpuProcesses';
import { CpuCountersUnavailableError } from './CpuCountersUnavailableError';
import { UnsupportedCpuProcessPlatformError } from './UnsupportedCpuProcessPlatformError';
import type { CpuReading } from '../../../../utils/development-tooling/cpuMetrics';

export class CpuProcessAdapter {
	async sample(): Promise<CpuReading> {
		if (!['darwin', 'linux'].includes(platform()))
			throw new UnsupportedCpuProcessPlatformError('Unsupported CPU process platform.');
		const stdout = await new BoundedCommandAdapter().checked(
			'ps',
			['-axo', 'pid=,ppid=,time=,args='],
			{
				maxBuffer: 4 * 1024 * 1024,
				timeoutMs: 3000,
				env: { LC_ALL: 'C' }
			}
		);
		const processors = cpus();
		if (!processors.length) throw new CpuCountersUnavailableError('CPU counters unavailable.');
		const cpu = processors.reduce(
			(result, p) => ({
				idle: result.idle + p.times.idle,
				total: result.total + Object.values(p.times).reduce((sum, n) => sum + n, 0),
				cores: result.cores + 1
			}),
			{ idle: 0, total: 0, cores: 0 }
		);
		return { at: performance.now(), cpu, processes: cpuProcesses(stdout.toString('utf8')) };
	}
}
