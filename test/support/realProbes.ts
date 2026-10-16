import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';

/**
 * TEST ONLY. The reads of one process, made here on their own so that a test can stand between
 * them and the code under test: delay one, or change what a later one says.
 */
const ran = (file: string, args: string[]) =>
	new Promise<{ ok: boolean; out: string }>((done) =>
		execFile(file, args, (error, out) => done({ ok: !error, out }))
	);

export const realProbes = {
	ran,
	async facts(pid: number) {
		const { out } = await ran('ps', ['-p', String(pid), '-o', 'ppid=,pgid=,tty=,lstart=,comm=']);
		const row = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+?)\s*$/;
		const found = row.exec(out.split('\n')[0] ?? '');
		if (!found) return null;
		const [parent, group] = [Number(found[1]), Number(found[2])];
		return { parent, group, terminal: found[3], started: found[4], name: found[5] };
	},
	async executable(pid: number) {
		const { out } = await ran('lsof', ['-a', '-p', String(pid), '-d', 'txt', '-Fn']);
		const first = out.split('\n').find((line) => line.startsWith('n/'));
		try {
			return first ? realpathSync(first.slice(1)) : null;
		} catch {
			return null;
		}
	}
};
export const epoch = 'Thu Jan  1 00:00:00 1970';
