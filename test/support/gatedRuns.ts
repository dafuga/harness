import type { Child } from './gatedRuns.types';
import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { openRunGate, teardownGate, type RunGate } from './runGate';

const fixtureOwner = resolve(import.meta.dirname, 'fixtureOwner.ts');
const runGate = resolve(import.meta.dirname, 'runGate.ts');
/** What the guards started and must end: gates, child processes, and the directories they own. */
const started = { gates: [] as RunGate[], children: [] as Child[], owned: [] as string[] };

function watched(child: ChildProcess): Child {
	const entry: Child = { child, closed: Promise.resolve() };
	entry.closed = new Promise((done) => {
		child.once('close', () => done());
		child.on('error', (error) => {
			entry.failure ??= error;
			if (child.pid === undefined) done();
		});
	});
	// A process that is gone cannot be written to; that it is gone is reported where it matters.
	child.stdin?.on('error', () => undefined);
	started.children.push(entry);
	return entry;
}
/** A child process the guards end in `cleanup`, by its own handle. */
export function track<T extends ChildProcess>(child: T): T {
	watched(child);
	return child;
}
/** Rejects once the child is gone, saying how it ended; raced against what it should say first. */
function goneBefore(watch: Child, what: string): Promise<never> {
	return watch.closed.then(() => {
		const { child, failure } = watch;
		const how = child.exitCode === null ? `signal ${child.signalCode}` : `exit ${child.exitCode}`;
		throw new Error(`The process ended (${failure?.message ?? how}) before ${what}`);
	});
}
/** A promise that may be left unawaited: its rejection is still seen by whoever awaits it. */
function settled<T>(promise: Promise<T>): Promise<T> {
	promise.catch(() => undefined);
	return promise;
}

/** A gate held by the guards; `cleanup` closes it. */
export async function heldGate(scratch: string, name: string): Promise<RunGate> {
	const gate = await openRunGate(scratch, name);
	started.gates.push(gate);
	return gate;
}

/** A run directory owned by a process of its own, ended by the real teardown when told to. */
export async function owner(scratch: string, gate?: string, launch = ['bun', fixtureOwner]) {
	const env: Record<string, string | undefined> = { ...process.env, TMPDIR: scratch };
	env[teardownGate] = gate;
	for (const name of ['HARNESS_E2E_ROOT', 'HARNESS_E2E_OWNER']) delete env[name];
	const [program = 'bun', ...args] = launch;
	const watch = watched(spawn(program, args, { env, stdio: ['pipe', 'pipe', 'inherit'] }));
	const { child } = watch;
	const replies: Array<{ done(state: string): void; failed(error: unknown): void }> = [];
	let over: unknown;
	void goneBefore(watch, 'it answered').catch((error: unknown) => {
		over = error;
		for (const reply of replies.splice(0)) reply.failed(error);
	});
	let ended: () => void = () => undefined;
	const returned = settled(
		Promise.race([new Promise<void>((done) => (ended = done)), goneBefore(watch, 'it returned')])
	);
	const ready = new Promise<{ root: string; build: string }>((done) =>
		createInterface({ input: child.stdout! }).on('line', (line) => {
			if (line.startsWith('ready ')) done(JSON.parse(line.slice(6)));
			if (line === 'returned') ended();
			if (line.startsWith('status ')) replies.shift()?.done(line.slice(7));
		})
	);
	const { root, build } = await Promise.race([ready, goneBefore(watch, 'it was ready')]);
	started.owned.push(root, resolve(build, '..'));
	const ask = (done: (state: string) => void, failed: (error: unknown) => void) => {
		if (over) failed(over);
		else {
			replies.push({ done, failed });
			child.stdin?.write('status\n');
		}
	};
	return {
		root,
		build,
		child,
		returned,
		finish: () => child.stdin?.write('finish\n'),
		status: () => new Promise<string>(ask)
	};
}

/** Another process that holds a gate. It never ends by itself: only a signal ends it. */
export async function holder(scratch: string, name: string, program = 'bun') {
	const script = [
		`const { openRunGate } = await import(${JSON.stringify(runGate)});`,
		`const gate = await openRunGate(${JSON.stringify(scratch)}, ${JSON.stringify(name)});`,
		"console.log('open');",
		'await gate.reached;',
		"console.log('reached');"
	].join('\n');
	const watch = watched(spawn(program, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] }));
	const said = createInterface({ input: watch.child.stdout! });
	const heard = (word: string) =>
		settled(
			Promise.race([
				new Promise<void>((done) => said.on('line', (line) => line === word && done())),
				goneBefore(watch, `it said ${word}`)
			])
		);
	const reached = heard('reached');
	await heard('open');
	return { path: join(scratch, `${name}.gate`), reached, child: watch.child };
}

/** Whether a child has ended, read from its own handle, never from a process id. */
export const ended = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

/**
 * Ends one child by its own handle: asked first, by closing its input or, if it reads none, by
 * SIGTERM; killed if it is still running after `grace`. A child that never started, or has
 * ended, is not signalled, so no other process can be reached through its handle.
 */
async function stop({ child, closed }: Child, grace: number): Promise<void> {
	const running = () => child.pid !== undefined && !ended(child);
	if (running()) {
		if (child.stdin) child.stdin.end();
		else child.kill('SIGTERM');
	}
	const force = setTimeout(() => running() && child.kill('SIGKILL'), grace);
	await closed;
	clearTimeout(force);
}

/**
 * Ends what the guards started, whether a guard passed or failed. Every gate is closed first, so
 * a teardown waiting at one goes on; then each child is ended and awaited until it is gone; only
 * then are the directories the owners made removed. No process is signalled by id or as a group.
 */
export async function cleanup(grace = 10_000): Promise<void> {
	await Promise.all(started.gates.splice(0).map((gate) => gate.close()));
	await Promise.all(started.children.splice(0).map((child) => stop(child, grace)));
	for (const path of started.owned.splice(0)) rmSync(path, { recursive: true, force: true });
}
