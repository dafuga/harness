import { execFile } from 'node:child_process';

/** One process as the system names it: reused ids differ in their start time. */
export interface TrackedProcess {
	pid: number;
	started: string;
}

interface Row extends TrackedProcess {
	parent: number;
}

/** Process ids, parents and start times only: nothing else about any process is read. */
function table(): Promise<Row[]> {
	return new Promise((resolve) => {
		execFile('ps', ['-A', '-o', 'pid=,ppid=,lstart='], { maxBuffer: 16_000_000 }, (error, out) => {
			const rows = error ? [] : out.split('\n').flatMap(parsed);
			resolve(rows);
		});
	});
}

function parsed(line: string): Row[] {
	const found = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
	return found ? [{ pid: Number(found[1]), parent: Number(found[2]), started: found[3] }] : [];
}

const exists = (known: TrackedProcess, rows: Row[]) =>
	rows.some((row) => row.pid === known.pid && row.started === known.started);

/**
 * Follows what one command starts. Each look adds the processes whose parent is the command or
 * something already followed, so a process that later leaves the command's group, session or
 * parent is still known. A process is only known if a look saw it while its parent was alive.
 */
export function processDescendants(root: number): {
	/** Looks once; overlapping looks are skipped. */
	look(): Promise<void>;
	/** Followed processes that still exist, the command itself excluded. */
	survivors(): Promise<TrackedProcess[]>;
} {
	const followed = new Map<number, string>();
	let looking = false;
	const follow = (rows: Row[]) => {
		let grew = true;
		while (grew) {
			grew = false;
			for (const row of rows) {
				const known = row.parent === root || followed.get(row.parent) !== undefined;
				if (!known || row.pid === root || followed.get(row.pid) === row.started) continue;
				followed.set(row.pid, row.started);
				grew = true;
			}
		}
	};
	return {
		async look() {
			if (looking) return;
			looking = true;
			follow(await table());
			looking = false;
		},
		async survivors() {
			const rows = await table();
			follow(rows);
			return [...followed]
				.map(([pid, started]) => ({ pid, started }))
				.filter((known) => exists(known, rows));
		}
	};
}

/** Signals exactly these processes: one whose id now belongs to another process is left alone. */
export async function signalProcesses(
	known: TrackedProcess[],
	signal: 'SIGTERM' | 'SIGKILL'
): Promise<void> {
	const rows = known.length > 0 ? await table() : [];
	for (const item of known.filter((entry) => exists(entry, rows))) {
		try {
			process.kill(item.pid, signal);
		} catch {
			// It ended between the look and the signal.
		}
	}
}
