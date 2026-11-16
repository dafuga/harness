// @harness-uid u_6orewnn4cn
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { DriverProcess } from '../DriverQueueAdapter.types';
/** Reads complete atomic snapshots; absent files use the explicit caller fallback. */
export function driverJson<T>(path: string, fallback: T): T {
	return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}
/** Inspect only known slot commands; never print process commands or environments. */
export function driverProcesses(root?: string): DriverProcess[] {
	const output = execFileSync('ps', ['-axo', 'command='], {
		encoding: 'utf8',
		maxBuffer: 8 * 1024 * 1024
	});
	return output
		.split('\n')
		.filter((line) => /(?:^|\/)code_task.py\s/.test(line) && (!root || line.includes(root)))
		.flatMap((line) => {
			const args = line.trim().split(/\s+/);
			const flag = (name: string) => {
				const i = args.indexOf(name);
				return i < 0 ? '' : (args[i + 1] ?? '');
			};
			const model = flag('--model'),
				tasksFile = flag('--tasks-file'),
				wave = flag('--wave'),
				slot = flag('--slot');
			return model && tasksFile && wave && slot ? [{ model, tasksFile, wave, slot }] : [];
		});
}
export function livePid(pid?: number): boolean {
	if (!Number.isInteger(pid) || !pid || pid < 1) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
/** @pure Task prefixes preserve the same duration category in queue and backfill. */
export function driverJobType(name: string): string {
	if (/reverify|re-verify/.test(name)) return 'reverify';
	if (/contract|p1-/.test(name)) return 'contract';
	if (/stub|p2a/.test(name)) return 'stub';
	if (/smell|p2b|code-phase/.test(name)) return 'smell';
	if (/video/.test(name)) return 'video';
	if (/w3|component/.test(name)) return 'component';
	return 'code';
}
