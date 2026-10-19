import { execFile } from 'node:child_process';

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
type Row = ProcessRow;
interface Owned {
	started: string;
	origin: TrackedProcess | null;
	byParent: boolean;
}
/** What is known of one command. Everything is held by id and start time together. */
interface Following {
	root: number;
	rootStarted: string | null;
	/** The command has not been reaped: its id can be no other process. */
	open: boolean;
	owned: Map<number, Owned>;
}

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
const table = async (): Promise<Row[]> => (await processTable()) ?? [];

function parsed(line: string): Row[] {
	const found = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
	if (!found) return [];
	const [pid, parent, group] = [Number(found[1]), Number(found[2]), Number(found[3])];
	return [{ pid, parent, group, started: found[4] }];
}

const exists = (known: TrackedProcess, rows: Row[]) =>
	rows.some((row) => row.pid === known.pid && row.started === known.started);
const identity = ({ pid, started }: TrackedProcess): TrackedProcess => ({ pid, started });
const isRoot = (state: Following, row: Row) =>
	row.pid === state.root && row.started === state.rootStarted;
const isOwn = (state: Following, row: Row) =>
	isRoot(state, row) || state.owned.get(row.pid)?.started === row.started;

/** Follows parent links inside one table. A parent counts only as the very process it is. */
function followParents(state: Following, rows: Row[], byPid: Map<number, Row>): void {
	for (let grew = true; grew; ) {
		grew = false;
		for (const row of rows) {
			const parent = byPid.get(row.parent);
			if (isOwn(state, row) || !parent || !isOwn(state, parent)) continue;
			state.owned.set(row.pid, { started: row.started, origin: identity(parent), byParent: true });
			grew = true;
		}
	}
}

/**
 * Members of the command's group that are not yet known. The number of a group shows nothing
 * by itself: they are the command's only when one of its own is in that group in the same
 * table. Under another leader the number is another group. Otherwise they are strangers,
 * returned but not owned. That holds for the first table after the command was reaped as for
 * any other: it is read later than that moment, and the number may be anyone's by then.
 */
function followGroup(state: Following, rows: Row[]): Row[] {
	const byPid = new Map(rows.map((row) => [row.pid, row]));
	const leader = byPid.get(state.root);
	const members = rows.filter((row) => row.group === state.root && !isOwn(state, row));
	if (leader && !isRoot(state, leader)) return [];
	const anchored = rows.some((row) => row.group === state.root && isOwn(state, row));
	if (!anchored) return members;
	for (const row of members) {
		const parent = byPid.get(row.parent);
		const origin = parent ? identity(parent) : null;
		state.owned.set(row.pid, { started: row.started, origin, byParent: false });
	}
	return [];
}

/** Takes one table in and returns the strangers in the command's group. */
function observed(state: Following, rows: Row[]): Row[] {
	const byPid = new Map(rows.map((row) => [row.pid, row]));
	const first = byPid.get(state.root);
	if (first && state.open && state.rootStarted === null) state.rootStarted = first.started;
	followParents(state, rows, byPid);
	return followGroup(state, rows);
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

/**
 * Follows what one command starts. Each look adds the processes whose parent, in that same
 * look, is the command or something already followed, so a process that later leaves the
 * command's group, session or parent is still known. Parents, the command and its group are
 * known by id and start time together; an id that another process took over owns nothing.
 */
export function processDescendants(root: number, read: ProcessTable = processTable): Descendants {
	const state: Following = { root, rootStarted: null, open: true, owned: new Map() };
	let looking = false;
	const rowsNow = async () => read().catch(() => null);
	const look = async () => {
		if (looking) return;
		looking = true;
		observed(state, (await rowsNow()) ?? []);
		looking = false;
	};
	return {
		look,
		async survivors() {
			const rows = (await rowsNow()) ?? [];
			observed(state, rows);
			return [...state.owned]
				.filter(([, own]) => own.byParent)
				.map(([pid, own]) => ({ pid, started: own.started }))
				.filter((known) => exists(known, rows));
		},
		async alive() {
			const rows = await rowsNow();
			if (!rows) return null;
			const strangers = observed(state, rows).map((row) => ({
				...row,
				origin: null,
				proven: false
			}));
			const origin = (row: Row) => state.owned.get(row.pid)?.origin ?? null;
			const own = rows.filter((row) => isOwn(state, row));
			return [...own.map((row) => ({ ...row, origin: origin(row), proven: true })), ...strangers];
		},
		closed() {
			state.open = false;
			void look();
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
