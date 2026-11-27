import { execFileSync } from 'node:child_process';
import type { FixtureProcess } from './syntheticProcessTable.types';

function elapsedSeconds(elapsed: string): number {
	const [days, time] = elapsed.includes('-') ? elapsed.split('-') : ['0', elapsed];
	return (
		Number(days) * 86400 + time.split(':').reduce((total, part) => total * 60 + Number(part), 0)
	);
}

export function fixtureProcessTable(pid?: number): FixtureProcess[] {
	const scope = pid === undefined ? ['-A'] : ['-p', String(pid)];
	let output: string;
	try {
		output = execFileSync(
			'/bin/ps',
			['-ww', ...scope, '-o', 'uid=,pid=,ppid=,pgid=,lstart=,etime=,command='],
			{ encoding: 'utf8', env: { LC_ALL: 'C' }, maxBuffer: 16_000_000, timeout: 5000 }
		);
	} catch (error) {
		if (pid !== undefined && (error as { status?: number }).status === 1) return [];
		throw error;
	}
	const rows: FixtureProcess[] = [];
	for (const line of output.split('\n')) {
		const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.{24})\s+(\S+)\s+(.*)$/.exec(line);
		if (!match || Number(match[1]) !== process.getuid?.()) continue;
		rows.push({
			pid: Number(match[2]),
			parent: Number(match[3]),
			group: Number(match[4]),
			started: match[5],
			ageSeconds: elapsedSeconds(match[6]),
			command: match[7]
		});
	}
	return rows;
}

/** Recheck the identity and group immediately before signalling a fixture process. */
export function killFixtureProcess(
	row: FixtureProcess,
	group: boolean,
	stillOwned: (current: FixtureProcess) => boolean = () => true
): boolean {
	const [current] = fixtureProcessTable(row.pid);
	if (current?.started !== row.started || current.group !== row.group) return false;
	if (!stillOwned(current)) return false;
	try {
		process.kill(group ? -current.group : current.pid, 'SIGKILL');
		return true;
	} catch (error) {
		if ((error as { code?: string }).code === 'ESRCH') return false;
		throw error;
	}
}
