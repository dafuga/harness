import { execFile, spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename, sep } from 'node:path';
import { classifyProcess, platformServices } from '../../../src/utils/platformServices';
import { processDescendants, signalProcesses } from '../../../src/utils/processDescendants';
import type { TrackedProcess } from '../../../src/utils/processDescendants';
import { buildObservation, finishObservation } from './ios-build-observation';
import { observeIosServices } from './ios-service-observers';
import { desktopRoot, tried } from './ios-products';

/**
 * Shared Apple services are never owned or signalled. Under verification, observe reused
 * services too and await helper retirement; only a vetted delegated daemon may remain.
 * Private cleanup retains pid/start checks and pauses while foreign build clients run.
 */
const lookMs = 100;
/** How long what the tool started may take to end by itself once the tool has ended. */
const settleMs = 300;
const graceMs = 1000;
/** Extra observers are bounded; owned descendants retain the original caller deadline. */
const retirementMs = 30_000;
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
		execFile(
			'ps',
			['-A', '-o', 'pid=,lstart=,comm='],
			{ maxBuffer: 16_000_000, timeout: 5000 },
			(error, out) => {
				const rows = new Map<number, Row>();
				for (const found of (error ? '' : out).split('\n').map((line) => row.exec(line)))
					if (found)
						rows.set(Number(found[1]), {
							started: found[2],
							executable: found[3]
						});
				done(rows.has(process.pid) ? rows : null);
			}
		);
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
	stopped: () => boolean,
	services: () => Promise<boolean>
) {
	const state = { ...standing, asked: new Map<number, number>() };
	const began = Date.now();
	await pause(settleMs);
	while (!stopped()) {
		const rows = await table();
		const ownSettled = rows && (await nothingLeft(rows, known, state));
		if (ownSettled && (await services())) return null;
		if ((!rows || ownSettled) && Date.now() - began >= retirementMs)
			return 'Build helpers did not retire within 30 seconds; shared or unknown processes were not signalled.';
		await pause(lookMs);
	}
	return stoppedEarly;
}

/** Settles success and failure alike; interruption stops the tool, never shared helpers. */
export async function followed(command: string[]): Promise<FollowedResult> {
	const group = Number(tried(['ps', '-o', 'pgid=', '-p', String(process.pid)]).output);
	const standing = { developer: developerDirectory(), group };
	const services = verifying
		? await observeIosServices(await table(), group)
		: buildObservation(async () => true);
	const child = spawn(command[0], command.slice(1), {
		cwd: desktopRoot,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const descendants = processDescendants(child.pid ?? -1);
	const known = new Map<number, TrackedProcess>();
	const output: Buffer[] = [];
	let stopped = false;
	const observation = buildObservation(async (signal) => {
		const found = await descendants.survivors();
		if (signal.aborted) return false;
		for (const item of found) known.set(item.pid, item);
		await services.look();
		return true;
	});
	const stop = () => {
		stopped = true;
		child.kill('SIGTERM');
	};
	const looking = setInterval(() => void observation.look(), lookMs);
	child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => output.push(chunk));
	process.once('SIGTERM', stop).once('SIGINT', stop);
	return new Promise((resolve) => {
		let ended = false;
		const finish = async (code: number) => {
			if (ended) return;
			ended = true;
			descendants.closed();
			const left = await finishObservation(
				() =>
					settled(
						known,
						standing,
						() => stopped,
						() => services.look()
					),
				[observation, services]
			);
			clearInterval(looking);
			process.off('SIGTERM', stop).off('SIGINT', stop);
			const text = Buffer.concat(output).toString();
			resolve({ code: left ? code || 1 : code, output: text, left });
		};
		child.once('error', () => void finish(1));
		child.once('close', (code) => void finish(code ?? 1));
	});
}
