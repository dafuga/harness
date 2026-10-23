import { existsSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { HostLimits } from './hostResourceLimits.types';
export type { HostLimits } from './hostResourceLimits.types';
/** Respect hierarchical cgroup-v2 limits as well as affinity; host counters alone hide quota saturation. */
export function hostResourceLimits(
	root = '/sys/fs/cgroup',
	membership = '/proc/self/cgroup',
	system = platform()
): HostLimits {
	if (system !== 'linux') return {};
	return linuxLimits(root, membership);
}
function linuxLimits(root: string, membership: string): HostLimits {
	if (!existsSync(root + '/cgroup.controllers'))
		throw new Error('Resource admission requires cgroup v2 on Linux');
	const relative = /^0::(.*)$/m.exec(readFileSync(membership, 'utf8'))?.[1];
	if (!relative) throw new Error('Cannot establish cgroup membership');
	if (relative.split('/').includes('..')) throw new Error('Invalid cgroup path');
	const candidate = resolve(root, '.' + relative);
	// A cgroup namespace may expose its own root instead of the host-relative path.
	let path = existsSync(candidate) ? candidate : root;
	const result: HostLimits = {};
	while (path.startsWith(root)) {
		readLimits(path, result);
		if (path === root) break;
		path = dirname(path);
	}
	return result;
}
function readLimits(path: string, result: HostLimits): void {
	const cpu = readOptional(path + '/cpu.max')
		?.trim()
		.split(/\s+/);
	if (cpu && cpu[0] !== 'max') {
		const cores = Number(cpu[0]) / Number(cpu[1]);
		if (!Number.isFinite(cores) || cores <= 0) throw new Error('Invalid CPU quota');
		if (result.cores === undefined || cores <= result.cores) {
			result.cores = cores;
			result.cpuUsedUs = Number(
				/^usage_usec (\d+)$/m.exec(readFileSync(path + '/cpu.stat', 'utf8'))?.[1]
			);
		}
	}
	readMemoryLimits(path, result);
}
function readMemoryLimits(path: string, result: HostLimits): void {
	const memory = readOptional(path + '/memory.max')?.trim();
	if (memory && memory !== 'max') {
		const total = Number(memory),
			current = Number(readFileSync(path + '/memory.current', 'utf8').trim());
		if (!Number.isFinite(total) || !Number.isFinite(current) || total <= 0 || current < 0)
			throw new Error('Invalid memory quota');
		result.memoryTotalBytes = Math.min(result.memoryTotalBytes ?? Infinity, total);
		result.memoryAvailableBytes = Math.min(
			result.memoryAvailableBytes ?? Infinity,
			Math.max(0, total - current)
		);
	}
}

function readOptional(path: string): string | undefined {
	try {
		return readFileSync(path, 'utf8');
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return undefined;
		throw error;
	}
}
