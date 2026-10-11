import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { processDescendants, signalProcesses, type TrackedProcess } from './processDescendants';

export interface IsolatedRun {
	command: string;
	args: string[];
	cwd: string;
	env: Record<string, string | undefined>;
	/** Hard limit: the whole process group is killed when it passes. */
	timeoutMs: number;
	log: string;
	maxLogBytes: number;
}

export interface IsolatedResult {
	status: 'passed' | 'failed' | 'timeout';
	exitCode: number | null;
	timedOut: boolean;
	durationMs: number;
	log: { path: string; bytes: number; sha256: string };
	/**
	 * Processes the command started that were still running after it ended and after the grace
	 * period. They were stopped, and a command that leaves any has not passed.
	 */
	survivors: TrackedProcess[];
}

const graceMs = 500;
/** How often the processes a command started are looked for while it runs. */
const lookMs = 200;
/** How long what a command started may take to end by itself once the command has ended. */
const settleMs = 2000;
const marker = '\n[output truncated]\n';

/** Signals the whole process group, so children the command started die with it. */
function signalGroup(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL'): void {
	try {
		if (child.pid) process.kill(-child.pid, signal);
	} catch {
		// The group is already gone.
	}
}

/**
 * Runs a command in its own process group with a hard time limit. On timeout or on exit the
 * group is killed, so nothing the command started can outlive it or report late.
 */
export async function runIsolated(run: IsolatedRun): Promise<IsolatedResult> {
	const started = performance.now();
	const output: Buffer[] = [];
	const outcome = pathMissing(run.command)
		? { exitCode: null, timedOut: false, survivors: [] }
		: await execute(run, output);
	const text = Buffer.concat(output);
	await mkdir(dirname(run.log), { recursive: true });
	await writeFile(run.log, text);
	return {
		status: statusOf(outcome),
		...outcome,
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
	return outcome.exitCode === 0 && outcome.survivors.length === 0 ? 'passed' : 'failed';
}

type Outcome = Pick<IsolatedResult, 'exitCode' | 'timedOut' | 'survivors'>;

/**
 * What the command left behind. Its group is already killed; a process that put itself in
 * another group or session is followed by its parent links instead. Such a process gets a
 * moment to end by itself, as a browser or server being shut down does, and is then stopped.
 */
async function leftBehind(
	descendants: ReturnType<typeof processDescendants>
): Promise<TrackedProcess[]> {
	let left = await descendants.survivors();
	for (let waited = 0; left.length > 0 && waited < settleMs; waited += 100) {
		await new Promise((resolve) => setTimeout(resolve, 100));
		left = await descendants.survivors();
	}
	if (left.length === 0) return [];
	await signalProcesses(left, 'SIGTERM');
	await new Promise((resolve) => setTimeout(resolve, graceMs));
	await signalProcesses(left, 'SIGKILL');
	return left;
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
	const descendants = processDescendants(child.pid ?? -1);
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
	const limit = setTimeout(() => {
		timedOut = true;
		signalGroup(child, 'SIGTERM');
		setTimeout(() => signalGroup(child, 'SIGKILL'), graceMs);
	}, run.timeoutMs);
	return new Promise((resolve) => {
		const finish = (exitCode: number | null) => {
			clearTimeout(limit);
			clearInterval(looking);
			signalGroup(child, 'SIGKILL');
			void leftBehind(descendants).then((survivors) => resolve({ exitCode, timedOut, survivors }));
		};
		child.once('error', () => finish(null));
		child.once('exit', (code) => {
			signalGroup(child, 'SIGKILL');
			setTimeout(() => finish(code), 50);
		});
	});
}
