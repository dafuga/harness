import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { freemem, platform, totalmem } from 'node:os';
import { promisify } from 'node:util';
import type { Memory } from './hostMemory.types';
export type { Memory } from './hostMemory.types';
const execute = promisify(execFile);
export function macMemory(text: string, pressure: string, total: number): Memory {
	const page = Number(/page size of (\d+) bytes/.exec(text)?.[1]);
	const count = (name: string) =>
		Number(new RegExp(`^Pages ${name}:\\s+(\\d+)\\.`, 'm').exec(text)?.[1]);
	const available = (count('free') + count('inactive') + count('speculative')) * page;
	if (!page || !Number.isFinite(available)) throw new Error('Cannot read macOS memory counters');
	const level = pressure.trim();
	return {
		memoryTotalBytes: total,
		memoryAvailableBytes: Math.min(total, available),
		memoryPressure: pressureLevel(level)
	};
}
export function linuxMemory(text: string): Memory {
	const value = (name: string) =>
		Number(new RegExp(`^${name}:\\s+(\\d+) kB`, 'm').exec(text)?.[1]) * 1024;
	const total = value('MemTotal'),
		available = value('MemAvailable');
	if (!Number.isFinite(total) || !Number.isFinite(available) || total <= 0)
		throw new Error('Cannot read Linux available memory');
	return {
		memoryTotalBytes: total,
		memoryAvailableBytes: available,
		memoryPressure: available / total < 0.05 ? 'critical' : 'normal'
	};
}
export async function hostMemory(): Promise<Memory> {
	if (platform() === 'darwin') {
		const options = { timeout: 3000, maxBuffer: 128000, env: { ...process.env, LC_ALL: 'C' } };
		const [vm, pressure] = await Promise.all([
			execute('vm_stat', [], options),
			execute('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], options)
		]);
		return macMemory(vm.stdout, pressure.stdout, totalmem());
	}
	if (platform() === 'linux') return linuxMemory(await readFile('/proc/meminfo', 'utf8'));
	if (platform() === 'win32')
		return {
			memoryTotalBytes: totalmem(),
			memoryAvailableBytes: freemem(),
			memoryPressure: 'normal'
		};
	throw new Error('Unsupported resource platform');
}

function pressureLevel(level: string): Memory['memoryPressure'] {
	const levels: Record<string, Memory['memoryPressure']> = {
		'1': 'normal',
		'2': 'warning',
		'4': 'critical'
	};
	return levels[level] ?? 'unknown';
}
