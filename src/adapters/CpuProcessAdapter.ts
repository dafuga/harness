import { performance } from 'node:perf_hooks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus, platform } from 'node:os';
import { cpuProcesses } from '../utils/cpuProcesses';
import type { CpuReading } from '../utils/cpuMetrics';
const execute = promisify(execFile);
export class CpuProcessAdapter {
	async sample(): Promise<CpuReading> {
		if (!['darwin', 'linux'].includes(platform()))
			throw new Error('Unsupported CPU process platform.');
		const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,time=,args='], {
			maxBuffer: 4 * 1024 * 1024,
			timeout: 3000,
			env: { ...process.env, LC_ALL: 'C' }
		});
		const processors = cpus();
		if (!processors.length) throw new Error('CPU counters unavailable.');
		const cpu = processors.reduce(
			(result, p) => ({
				idle: result.idle + p.times.idle,
				total: result.total + Object.values(p.times).reduce((sum, n) => sum + n, 0),
				cores: result.cores + 1
			}),
			{ idle: 0, total: 0, cores: 0 }
		);
		return { at: performance.now(), cpu, processes: cpuProcesses(stdout) };
	}
}
