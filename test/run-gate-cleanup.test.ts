import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { cleanup, ended, heldGate, holder, owner, track } from './support/gatedRuns';

/**
 * A GUARD THAT FAILS STILL ENDS WHAT IT STARTED. Its gates are closed first, so a teardown waiting
 * at one runs to its end; each process it started is ended and awaited by its own handle, killed
 * only when it outlasts a bound; only then are the directories its runs owned removed. The runs
 * are real processes ending with the real teardown; what they seed is SYNTHETIC.
 */
const scratch = mkdtempSync(join(tmpdir(), 'harness-gate-cleanup-'));
afterEach(() => cleanup(2_000), 20_000);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function refused(path: string): Promise<boolean> {
	return new Promise((done) => {
		const socket = createConnection(path, () => {
			socket.destroy();
			done(false);
		});
		socket.once('error', () => done(true));
	});
}
/** What the failing guard below left for its cleanup; the guard after it reads what became of it. */
let abandoned = {
	children: [] as ChildProcess[],
	gates: [] as string[],
	owned: [] as string[],
	returned: [] as boolean[]
};

test.fails(
	'a guard fails while one run waits at its gate, one at a gate another process holds, and one is idle',
	async () => {
		const gate = await heldGate(scratch, 'abandoned');
		const held = await holder(scratch, 'abandoned-holder');
		const waiting = [await owner(scratch, gate.path), await owner(scratch, held.path)];
		const idle = await owner(scratch);
		const returned = [false, false];
		for (const [at, run] of waiting.entries())
			void run.returned.then(
				() => (returned[at] = true),
				() => undefined
			);
		for (const run of waiting) run.finish();
		await Promise.all([gate.reached, held.reached]);
		const runs = [...waiting, idle];
		abandoned = {
			children: [...runs.map((run) => run.child), held.child],
			gates: [gate.path, held.path],
			owned: runs.flatMap((run) => [run.root, run.build]),
			returned
		};
		// Fails on purpose: the run still waits at its gate.
		expect(await waiting[0].status()).toBe('returned');
	},
	30_000
);

test('its cleanup let the waiting runs finish their teardown, ended each process, then removed their files', async () => {
	const { children, gates, owned, returned } = abandoned;
	expect(children.map(ended)).toEqual([true, true, true, true]);
	// The runs left on their own; the holder, which reads no input, was asked by SIGTERM.
	expect(children.map((child) => child.signalCode ?? child.exitCode)).toEqual([0, 0, 0, 'SIGTERM']);
	expect(returned).toEqual([true, true]);
	expect(owned.filter((path) => existsSync(path))).toEqual([]);
	expect(await Promise.all(gates.map(refused))).toEqual([true, true]);
});

test('a process that will not end when asked is killed by its own handle after the bound, and no other', async () => {
	const script =
		"process.on('SIGTERM', () => undefined); setInterval(() => undefined, 1000); console.log('up');";
	// The bystander is not tracked: cleanup must leave it, and this test ends it, pass or fail.
	const bystander = spawn(process.execPath, ['-e', script], {
		stdio: ['ignore', 'pipe', 'inherit']
	});
	const gone = new Promise<void>((done) => {
		bystander.once('close', () => done());
		bystander.once('error', () => done());
	});
	try {
		const stubborn = track(
			spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] })
		);
		await Promise.all([once(stubborn.stdout, 'data'), once(bystander.stdout, 'data')]);
		await cleanup(500);
		expect([stubborn.signalCode, ended(bystander)]).toEqual(['SIGKILL', false]);
	} finally {
		if (bystander.pid !== undefined && !ended(bystander)) bystander.kill('SIGKILL');
		await gone;
	}
});
