import type { IsolatedRun, IsolatedResult, Outcome, Running } from './runIsolated.types';
export type { IsolatedRun, IsolatedResult, Outcome, Followed, Running } from './runIsolated.types';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { cleanupDeadline } from '../../development-tooling/cleanupDeadline';
import { processDescendants } from '../../development-tooling/processDescendants';
import { signalGroup } from '../groupTeardown';
import { platformServices, type ServiceContext } from '../platformServices';
import { groupTeardown } from './groupTeardown';
import { captureIsolatedOutput, isolatedChild } from './isolatedChild';
import { haltProcesses, settleProcesses } from './settleProcesses';

const graceMs = 500;

/** How often the processes a command started are looked for while it runs. */
const lookMs = 200;

/** How long what a command started may take to end by itself once the command has ended. */
const settleMs = 2000;

/**
 * Runs a command in its own process group with a hard time limit. On timeout or on exit what the
 * command started is stopped, so that it cannot outlive the command or report late: elsewhere by
 * a signal to the group, on macOS one judged process at a time, where a vetted system service is
 * handed over and a possible one is left running and fails the command.
 */
export async function runIsolated(run: IsolatedRun): Promise<IsolatedResult> {
	run.signal?.throwIfAborted();
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

/**
 * On macOS a command may have started a service that the system shares with other commands. No
 * group is signalled there: every process is judged by itself before any signal, on every path.
 */
function guarding(run: IsolatedRun, group: number): ServiceContext | null {
	if (process.platform !== 'darwin') return null;
	const authority = run.platform?.authority ?? platformServices;
	return { authority, group, probes: run.platform?.probes };
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
	const child = isolatedChild(run);
	const descendants = processDescendants(child.pid ?? -1, run.platform?.table);
	const guard = guarding(run, child.pid ?? -1);
	let looking: ReturnType<typeof setInterval> | undefined;
	let timedOut = false;
	return new Promise((resolve) => {
		let ended = false;
		const running = { run, child, descendants, guard };
		const finish = (exitCode: number | null) => {
			if (ended) return;
			ended = true;
			run.signal?.removeEventListener('abort', cancel);
			clearTimeout(limit);
			clearInterval(looking);
			void ending(running).then(({ survivors, stopped, resisted, unknown, report }) => {
				output.push(Buffer.from(report));
				resolve({ exitCode, timedOut, survivors, stopped, resisted, unknown });
			});
		};
		const cancel = () => halt(running, () => finish(null));
		const limit = setTimeout(() => {
			timedOut = true;
			halt(running, () => finish(null));
		}, run.timeoutMs);
		child.once('error', () => finish(null));
		run.signal?.addEventListener('abort', cancel, { once: true });
		if (run.signal?.aborted) cancel();
		// Bun may deliver child events inside a synchronous spawn observer.
		child.once('exit', (code) => {
			descendants.closed();
			if (!guard) signalGroup(child, 'SIGKILL');
			setTimeout(() => finish(code), 50);
		});
		captureIsolatedOutput(child, output, run.maxLogBytes);
		looking = setInterval(() => void descendants.look(), lookMs);
		void descendants.look();
		try {
			if (child.pid) run.onSpawn?.(child.pid);
		} catch {
			cancel();
			finish(null);
		}
	});
}
