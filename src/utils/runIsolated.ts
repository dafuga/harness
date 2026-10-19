import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { cleanupDeadline } from './cleanupDeadline';
import { groupTeardown, signalGroup } from './groupTeardown';
import { platformServices, type ServiceAuthority, type ServiceContext } from './platformServices';
import { processDescendants, type ProcessTable, type TrackedProcess } from './processDescendants';
import type { ProcessProbes } from './processProbes';
import { haltProcesses, settleProcesses } from './settleProcesses';

export interface IsolatedRun {
	command: string;
	args: string[];
	cwd: string;
	env: Record<string, string | undefined>;
	/**
	 * Hard limit. When it passes the command and what it started are stopped: on macOS one judged
	 * process at a time, elsewhere by a signal to the command's process group.
	 */
	timeoutMs: number;
	log: string;
	maxLogBytes: number;
	/** For tests of the protection itself: who vouches, how processes are read, the cleanup bound. */
	platform?: {
		authority?: () => ServiceAuthority | null;
		table?: ProcessTable;
		probes?: ProcessProbes;
		cleanupMs?: number;
	};
}

export interface IsolatedResult {
	status: 'passed' | 'failed' | 'timeout';
	exitCode: number | null;
	timedOut: boolean;
	durationMs: number;
	log: { path: string; bytes: number; sha256: string };
	/**
	 * Processes the command started that were still running after it ended and after the grace
	 * period. A command that leaves any has not passed. Its own are stopped; on macOS one that
	 * may be a shared service, or is not shown to be the command's own, is never signalled.
	 */
	survivors: TrackedProcess[];
	/** How many of the survivors were stopped; all of them when absent. */
	stopped?: number;
	/** How many were sent a signal and still ran at the last look; none when absent. */
	resisted?: number;
	/** What the command left could not be established; nothing more was signalled for it. */
	unknown?: boolean;
}

const graceMs = 500;
/** How often the processes a command started are looked for while it runs. */
const lookMs = 200;
/** How long what a command started may take to end by itself once the command has ended. */
const settleMs = 2000;
const marker = '\n[output truncated]\n';

/**
 * Runs a command in its own process group with a hard time limit. On timeout or on exit what the
 * command started is stopped, so that it cannot outlive the command or report late: elsewhere by
 * a signal to the group, on macOS one judged process at a time, where a vetted system service is
 * handed over and a possible one is left running and fails the command.
 */
export async function runIsolated(run: IsolatedRun): Promise<IsolatedResult> {
	const started = performance.now();
	const output: Buffer[] = [];
	const outcome = pathMissing(run.command)
		? { exitCode: null, timedOut: false, survivors: [], stopped: 0, resisted: 0, unknown: false }
		: await execute(run, output);
	const text = Buffer.concat(output);
	await mkdir(dirname(run.log), { recursive: true });
	await writeFile(run.log, text);
	return {
		status: statusOf(outcome),
		exitCode: outcome.exitCode,
		timedOut: outcome.timedOut,
		survivors: outcome.survivors,
		stopped: outcome.stopped,
		resisted: outcome.resisted,
		unknown: outcome.unknown,
		durationMs: performance.now() - started,
		log: {
			path: run.log,
			bytes: text.length,
			sha256: createHash('sha256').update(text).digest('hex')
		}
	};
}

function statusOf(outcome: Outcome): IsolatedResult['status'] {
	if (outcome.timedOut) return 'timeout';
	const clean = outcome.survivors.length === 0 && !outcome.unknown;
	return outcome.exitCode === 0 && clean ? 'passed' : 'failed';
}

/** `unknown`: what the command left could not be read, so it is not known to be nothing. */
type Outcome = Pick<IsolatedResult, 'exitCode' | 'timedOut' | 'survivors'> & {
	stopped: number;
	resisted: number;
	unknown: boolean;
};
type Followed = ReturnType<typeof processDescendants>;

/**
 * On macOS a command may have started a service that the system shares with other commands. No
 * group is signalled there: every process is judged by itself before any signal, on every path.
 */
function guarding(run: IsolatedRun, group: number): ServiceContext | null {
	if (process.platform !== 'darwin') return null;
	const authority = run.platform?.authority ?? platformServices;
	return { authority, group, probes: run.platform?.probes };
}

interface Running {
	run: IsolatedRun;
	child: ChildProcess;
	descendants: Followed;
	guard: ServiceContext | null;
}

/** What is left once the command ended, and what was done about it. It always answers. */
async function ending({ run, child, descendants, guard }: Running) {
	const failed = '\n[harness] settling what the command left failed; nothing more was signalled\n';
	try {
		const cleanupMs = run.platform?.cleanupMs;
		if (guard) return await settleProcesses(descendants, guard, { settleMs, graceMs, cleanupMs });
		const survivors = await groupTeardown(child, descendants, { settleMs, graceMs });
		return { survivors, stopped: survivors.length, resisted: 0, unknown: false, report: '' };
	} catch {
		return { survivors: [], stopped: 0, resisted: 0, unknown: true, report: failed };
	}
}

/**
 * Stops a command at its time limit: asked first, forced after the grace time. On macOS that is
 * one piece of work under one deadline; when the deadline is over, or the settling begins, it
 * signals nothing more, and a command that could not be stopped no longer holds its limit open.
 */
function halt({ child, descendants, guard }: Running, over: () => void): void {
	if (!guard) {
		signalGroup(child, 'SIGTERM');
		setTimeout(() => signalGroup(child, 'SIGKILL'), graceMs);
		return;
	}
	const deadline = cleanupDeadline(graceMs + settleMs);
	deadline.signal.addEventListener('abort', over, { once: true });
	void haltProcesses(descendants, guard, { graceMs, deadline }).catch(() => undefined);
}

function pathMissing(command: string): boolean {
	return command.includes('/') && !existsSync(command);
}

function execute(run: IsolatedRun, output: Buffer[]): Promise<Outcome> {
	// The shell only merges stderr into stdout, then replaces itself with the command.
	const child = spawn('sh', ['-c', 'exec "$0" "$@" 2>&1', run.command, ...run.args], {
		cwd: run.cwd,
		env: run.env,
		detached: true,
		stdio: ['ignore', 'pipe', 'ignore']
	});
	const descendants = processDescendants(child.pid ?? -1, run.platform?.table);
	const guard = guarding(run, child.pid ?? -1);
	const looking = setInterval(() => void descendants.look(), lookMs);
	void descendants.look();
	let kept = 0;
	let timedOut = false;
	child.stdout?.on('data', (chunk: Buffer) => {
		if (kept > run.maxLogBytes) return;
		const room = run.maxLogBytes - kept;
		output.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
		if (chunk.length > room) output.push(Buffer.from(marker));
		kept += chunk.length > room ? run.maxLogBytes + 1 : chunk.length;
	});
	return new Promise((resolve) => {
		let ended = false;
		const running = { run, child, descendants, guard };
		const finish = (exitCode: number | null) => {
			if (ended) return;
			ended = true;
			clearTimeout(limit);
			clearInterval(looking);
			void ending(running).then(({ survivors, stopped, resisted, unknown, report }) => {
				output.push(Buffer.from(report));
				resolve({ exitCode, timedOut, survivors, stopped, resisted, unknown });
			});
		};
		const limit = setTimeout(() => {
			timedOut = true;
			halt(running, () => finish(null));
		}, run.timeoutMs);
		child.once('error', () => finish(null));
		child.once('exit', (code) => {
			descendants.closed();
			if (!guard) signalGroup(child, 'SIGKILL');
			setTimeout(() => finish(code), 50);
		});
	});
}
