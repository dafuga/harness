import { execFile, spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename, sep } from 'node:path';
import { classifyProcess, platformServices } from '../../../src/utils/platformServices';
import { processDescendants, signalProcesses } from '../../../src/utils/processDescendants';
import type { TrackedProcess } from '../../../src/utils/processDescendants';
import { desktopRoot, tried } from './ios-products';

/**
 * Runs a build tool and settles what it leaves behind. xcodebuild starts Interface Builder
 * daemons (`ibtoold`) through `ibtool` and `actool`; they leave its process group and stay for
 * minutes. Such a daemon is shared: an idle one is taken up by any other build of the same
 * person, so having started one is no right to end it. Neither tool documents a way to run
 * without it.
 *
 * So a process that runs from the developer tools or from the system's own services is the
 * platform's and is never signalled here, whoever started it. Under a Harness verification,
 * where a command may not return while something it started still runs, it is waited for until
 * it retires by itself; only the deadline of the caller ends that wait. A vetted service that
 * has left the build is not waited for: the runner hands it to the system. Whatever else the
 * tool started and left is this build's own and is ended, each process by its id and the time
 * it started.
 *
 * Nothing is concluded and nothing is signalled when the processes cannot be observed, when a
 * process cannot be told apart, or while another build's `ibtool` or `actool` is running.
 */
const lookMs = 100;
/** How long what the tool started may take to end by itself once the tool has ended. */
const settleMs = 300;
const graceMs = 1000;
const sharedClients = ['ibtool', 'actool'];
/** Where Apple's developer tools and system services run from, beside the selected Xcode. */
const platformRoots = ['/Library/Developer/', '/System/Library/', '/usr/libexec/'];
const verifying = process.env.HARNESS_VERIFY === '1';
const stoppedEarly =
	'The build was stopped while processes it started still ran; none was signalled.';

interface Row {
	started: string;
	executable: string;
}
interface Settling {
	developer: string | null;
	/** When each of this build's own processes was first asked to end. */
	asked: Map<number, number>;
	/** The process group this build runs in. */
	group: number;
}
/** What is read once, before any process is started and waited for: reading it blocks. */
type Standing = Pick<Settling, 'developer' | 'group'>;
export interface FollowedResult {
	code: number;
	output: string;
	/** Why the build could not wait for what it started, when it could not. */
	left: string | null;
}

function pause(milliseconds: number): Promise<void> {
	return new Promise((done) => {
		setTimeout(done, milliseconds);
	});
}

/** The process table by id, or null when it could not be read: this process must be in it. */
function table(): Promise<Map<number, Row> | null> {
	const row = /^\s*(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+?)\s*$/;
	return new Promise((done) => {
		execFile('ps', ['-A', '-o', 'pid=,lstart=,comm='], { maxBuffer: 16_000_000 }, (error, out) => {
			const rows = new Map<number, Row>();
			for (const found of (error ? '' : out).split('\n').map((line) => row.exec(line)))
				if (found) rows.set(Number(found[1]), { started: found[2], executable: found[3] });
			done(rows.has(process.pid) ? rows : null);
		});
	});
}

/** The developer tools in use, as the whole Xcode they are part of; null when not to be told. */
function developerDirectory(): string | null {
	const selected = process.env.DEVELOPER_DIR ?? tried(['xcode-select', '-p']).output.trim();
	try {
		const real = realpathSync(selected);
		return (/^(.*\.app)\/Contents\/Developer$/.exec(real)?.[1] ?? real) + sep;
	} catch {
		return null;
	}
}

/** Whether a process is the platform's: it runs from one of its places, or cannot be told. */
function platformOwned(executable: string, developer: string | null): boolean {
	try {
		const path = realpathSync(executable);
		return !developer || [developer, ...platformRoots].some((place) => path.startsWith(place));
	} catch {
		return true;
	}
}

/** Another build's client of the shared tools is running: one that this build did not start. */
function anotherBuild(rows: Map<number, Row>, known: Map<number, TrackedProcess>): boolean {
	return [...rows].some(
		([pid, row]) => sharedClients.includes(basename(row.executable)) && !known.has(pid)
	);
}

/**
 * Ends what is this build's own: asked to end first, and forced only after the grace time. Each
 * signal goes to one process by its id and start time, and none while another build is running.
 */
async function endOwn(own: TrackedProcess[], asked: Map<number, number>): Promise<void> {
	const fresh = own.filter((item) => !asked.has(item.pid));
	const late = own.filter((item) => Date.now() - (asked.get(item.pid) ?? Infinity) >= graceMs);
	for (const item of fresh) asked.set(item.pid, Date.now());
	await signalProcesses(fresh, 'SIGTERM');
	await signalProcesses(late, 'SIGKILL');
}

/** What the runner of a verification will not take over: all but a vetted, released service. */
async function notHandedOver(alive: TrackedProcess[], group: number): Promise<TrackedProcess[]> {
	const context = { authority: platformServices, group };
	const verdicts = await Promise.all(alive.map((item) => classifyProcess(item, context)));
	return alive.filter((_item, index) => verdicts[index].standing !== 'delegated');
}

/** One look at what is left; true when there is nothing to wait for any more. */
async function nothingLeft(
	rows: Map<number, Row>,
	known: Map<number, TrackedProcess>,
	state: Settling
) {
	const alive = [...known.values()].filter((item) => rows.get(item.pid)?.started === item.started);
	const own = alive.filter(
		(item) => !platformOwned(rows.get(item.pid)!.executable, state.developer)
	);
	const waited = verifying ? await notHandedOver(alive, state.group) : own;
	if (waited.length === 0) return true;
	if (own.length > 0 && !anotherBuild(rows, known)) await endOwn(own, state.asked);
	return false;
}

/**
 * Waits until nothing the tool started is left, ending only what is this build's own. Outside
 * a verification the platform's processes are left to retire in their own time. A table that
 * cannot be read settles nothing: it is read again until it can be, or until told to stop.
 */
async function settled(
	known: Map<number, TrackedProcess>,
	standing: Standing,
	stopped: () => boolean
) {
	const state = { ...standing, asked: new Map<number, number>() };
	await pause(settleMs);
	while (!stopped()) {
		const rows = await table();
		if (rows && (await nothingLeft(rows, known, state))) return null;
		await pause(lookMs);
	}
	return stoppedEarly;
}

/**
 * The tool's exit code and output, once it has ended and what it started has been settled. A
 * tool that fails or cannot be started is settled in the same way. When this process is told to
 * stop, the tool is stopped and nothing else is signalled.
 */
export function followed(command: string[]): Promise<FollowedResult> {
	const group = Number(tried(['ps', '-o', 'pgid=', '-p', String(process.pid)]).output);
	const standing = { developer: developerDirectory(), group };
	const child = spawn(command[0], command.slice(1), {
		cwd: desktopRoot,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const descendants = processDescendants(child.pid ?? -1);
	const known = new Map<number, TrackedProcess>();
	const output: Buffer[] = [];
	let stopped = false;
	const look = async () => {
		for (const item of await descendants.survivors()) known.set(item.pid, item);
	};
	const stop = () => {
		stopped = true;
		child.kill('SIGTERM');
	};
	const looking = setInterval(() => void look(), lookMs);
	child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => output.push(chunk));
	process.once('SIGTERM', stop).once('SIGINT', stop);
	return new Promise((resolve) => {
		let ended = false;
		const finish = async (code: number) => {
			if (ended) return;
			ended = true;
			descendants.closed();
			await look();
			const left = await settled(known, standing, () => stopped);
			clearInterval(looking);
			process.off('SIGTERM', stop).off('SIGINT', stop);
			resolve({ code: left ? code || 1 : code, output: Buffer.concat(output).toString(), left });
		};
		child.once('error', () => void finish(1));
		child.once('close', (code) => void finish(code ?? 1));
	});
}
