import { execFile } from "node:child_process";

/** One process as the system names it: reused ids differ in their start time. */
export interface TrackedProcess {
	pid: number;
	started: string;
}

export interface ProcessRow extends TrackedProcess {
	parent: number;
	group: number;
}

/** A process of the command that still exists. */
export interface FollowedProcess extends ProcessRow {
	/** The parent it had when it was first seen, by id and start time; null when none was seen. */
	origin: TrackedProcess | null;
	/** False when only the number of its group points at the command: that shows nothing. */
	proven: boolean;
}

export type ProcessTable = () => Promise<ProcessRow[] | null>;

export type Row = ProcessRow;

/** How long one read of the processes may take before it is ended and counts as unreadable. */
const readMs = 5000;

/**
 * Process ids, parents, groups and start times only: nothing else about any process is read.
 * Null when they could not be read; a table without this very process was not read.
 */
export function processTable(): Promise<Row[] | null> {
	return new Promise((resolve) => {
		const options = { maxBuffer: 16_000_000, timeout: readMs, killSignal: 'SIGKILL' as const };
		execFile('ps', ['-A', '-o', 'pid=,ppid=,pgid=,lstart='], options, (error, out) => {
			const rows = error ? [] : out.split('\n').flatMap(parsed);
			resolve(rows.some((row) => row.pid === process.pid) ? rows : null);
		});
	});
}

function parsed(line: string): Row[] {
	const found = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
	if (!found) return [];
	const [pid, parent, group] = [Number(found[1]), Number(found[2]), Number(found[3])];
	return [{ pid, parent, group, started: found[4] }];
}

/** What follows one command. */
export interface Descendants {
	/** Looks once; overlapping looks are skipped. */
	look(): Promise<void>;
	/** Processes followed by their parents that still exist, the command itself excluded. */
	survivors(): Promise<TrackedProcess[]>;
	/**
	 * The command, what it started and the members of its group, as far as they still exist,
	 * and strangers in its group marked as not proven. Null when the processes could not be
	 * read: nothing is known then, not that none is left.
	 */
	alive(): Promise<FollowedProcess[] | null>;
	/**
	 * The command has ended and was reaped: from now on its id may be another process. It looks
	 * once more for what the command's own have started; nothing is owned for its group alone.
	 */
	closed(): void;
}

export { processDescendants, signalProcesses } from './run-isolated/processDescendants';
