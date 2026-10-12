import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	processTable,
	type FollowedProcess,
	type TrackedProcess
} from '../src/utils/processDescendants';
import { runIsolated } from '../src/utils/runIsolated';
import { settleProcesses } from '../src/utils/settleProcesses';
import { settlementReport, type Judged } from '../src/utils/settlementReport';
import { realProbes } from './support/realProbes';
import {
	adopted,
	alive,
	cleared,
	journal,
	pause,
	remembered,
	syntheticServices,
	type SyntheticServices
} from './support/syntheticServices';

/**
 * What is written of a process that is still there is what was done to it. One that was sent a
 * signal and outlasted it is not said to be "not signalled"; one that was never signalled is not
 * said to have been. Every process is a stand-in that these tests start, and it writes down each
 * signal it is sent, so what the report says is held against what really reached it.
 */
const mac = process.platform === 'darwin';
const group = 4242;
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const file = (name: string) => join(made.home, name);
const standIn = (program: string, name: string) =>
	adopted(program, ['30', file(name), file(`${name}.ready`)]);
const own = (name: string) => standIn(made.helper, name);
/**
 * Waits until the stand-ins at these files say that they run their own code. Before that a
 * signal ends one without a trace, and nothing could be read from what it wrote down.
 */
async function running(...ready: string[]) {
	const all = () => ready.every((path) => existsSync(path));
	for (let waited = 0; !all() && waited < 5000; waited += 20) await pause(20);
	expect(all()).toBe(true);
}
const seen = (known: TrackedProcess): FollowedProcess => ({
	...known,
	parent: 1,
	group: known.pid,
	origin: null,
	proven: true
});
/** The line of the report that is about this process. */
const told = (report: string, known: TrackedProcess) =>
	report.split('\n').find((line) => line.includes(`process ${known.pid} `)) ?? '';

test.skipIf(!mac)(
	'a process that outlasts its signal and one that was never signalled are told apart',
	async () => {
		const [outlasting, unknown, plain] = [own('outlasting'), own('unknown'), own('plain')];
		const possible = standIn(made.lookAlike, 'possible');
		const names = ['outlasting', 'unknown', 'plain', 'possible'];
		await running(...names.map((name) => file(`${name}.ready`)));
		// One program can never be read. Another can be read until it was asked to end, and no
		// more after that: it is asked, then neither forced nor known.
		const reads = new Map<number, number>();
		const executable = async (pid: number) => {
			const read = (reads.get(pid) ?? 0) + 1;
			reads.set(pid, read);
			if (pid === unknown.pid || (pid === outlasting.pid && read > 2)) return null;
			return realProbes.executable(pid);
		};
		const rows = [outlasting, unknown, plain, possible].map(seen);
		const watch = { alive: async () => rows.filter((item) => alive(item)) };
		const context = {
			authority: () => made.authority,
			group,
			probes: { ...realProbes, executable }
		};
		const timing = { settleMs: 0, graceMs: 100, cleanupMs: 15_000 };
		const settled = await settleProcesses(watch, context, timing);
		expect([alive(outlasting), journal(file('outlasting'))]).toEqual([true, 'signalled\n']);
		expect([alive(unknown), journal(file('unknown'))]).toEqual([true, '']);
		expect([alive(possible), journal(file('possible'))]).toEqual([true, '']);
		expect(alive(plain)).toBe(false);
		expect(told(settled.report, outlasting)).toContain('signalled but still running');
		expect(told(settled.report, outlasting)).not.toContain('not signalled');
		expect(told(settled.report, unknown)).toContain('left running, not signalled');
		expect(told(settled.report, possible)).toContain('left running, not signalled');
		expect(told(settled.report, plain)).toContain('stopped');
		expect(settled).toMatchObject({ stopped: 1, resisted: 1, unknown: false });
		expect(settled.survivors).toHaveLength(4);
	},
	30_000
);

test.skipIf(!mac)(
	'a process signalled at the time limit that outlasts it is not reported as not signalled',
	async () => {
		const dir = file('limit');
		mkdirSync(dir);
		const script = [
			"const fs = require('fs'), { spawn, execFileSync } = require('child_process');",
			'const [dir, program] = process.argv.slice(1);',
			"const args = ['30', dir + '/journal', dir + '/ready'];",
			"const child = spawn(program, args, { stdio: 'ignore' });",
			"const when = execFileSync('/bin/ps', ['-p', String(child.pid), '-o', 'lstart=']).toString().trim();",
			"fs.writeFileSync(dir + '/child', child.pid + ' ' + when);",
			// Keep the parent alive until every initial signal has been attempted. If it exits
			// on TERM, settling cancels the slower child observation before that child is asked.
			"process.on('SIGTERM', () => {});",
			'setInterval(() => {}, 1000);'
		].join('\n');
		const started = () => {
			const [pid, ...when] = readFileSync(join(dir, 'child'), 'utf8').split(' ');
			return { pid: Number(pid), started: when.join(' ') };
		};
		// Once the child has written down a signal its program can no longer be read: it was
		// asked to end at the limit, and is neither forced nor known after that.
		const asked = () => (journal(join(dir, 'journal')) === '' ? -1 : started().pid);
		const executable = async (pid: number) => {
			// Model a child observation that completes after its parent's. This ordering must
			// still reach the intended surviving, signalled child state.
			if (existsSync(join(dir, 'child')) && pid === started().pid) await pause(200);
			return pid === asked() ? null : realProbes.executable(pid);
		};
		// No look is answered before the child says that it runs: the limit finds it ready.
		const table = async () => {
			const ready = () => existsSync(join(dir, 'ready'));
			for (let waited = 0; !ready() && waited < 2000; waited += 20) await pause(20);
			return processTable();
		};
		const probes = { ...realProbes, executable };
		const result = await runIsolated({
			command: process.execPath,
			args: ['-e', script, dir, made.helper],
			cwd: dir,
			env: { ...process.env },
			timeoutMs: 1200,
			log: join(dir, 'run.log'),
			maxLogBytes: 64_000,
			platform: { authority: () => made.authority, table, probes }
		});
		await running(join(dir, 'ready'));
		const child = remembered(started());
		const line = told(readFileSync(join(dir, 'run.log'), 'utf8'), child);
		expect(result).toMatchObject({ status: 'timeout', timedOut: true, survivors: [child] });
		expect(result).toMatchObject({ stopped: 0, resisted: 1, unknown: false });
		expect([alive(child), journal(join(dir, 'journal'))]).toEqual([true, 'signalled\n']);
		expect(line).toContain('signalled but still running');
		expect(line).not.toContain('not signalled');
	},
	30_000
);

const judged = (pid: number, standing: Judged['verdict']['standing'], reason: string): Judged => ({
	pid,
	started: 'Mon Oct 12 10:00:00 2026',
	parent: 1,
	group: pid,
	origin: null,
	proven: true,
	verdict: { standing, reason, executable: `/made/up/${pid}` }
});

test('the report words and counts each outcome by what was done to the process', () => {
	const ended = judged(1, 'private', "the command's own");
	const outlasting = judged(2, 'private', "the command's own");
	const earlier = judged(3, 'protected', 'its program could not be read');
	const shielded = judged(4, 'protected', 'it works for a service');
	const handed = judged(5, 'delegated', 'vetted service');
	// The third was signalled before, at the time limit, and is not among those asked now.
	const signalled = (item: TrackedProcess) => [1, 2, 3].includes(item.pid);
	const last = [outlasting, earlier, shielded, handed];
	const made = settlementReport([ended, outlasting], last, signalled);
	expect(made).toMatchObject({ stopped: 1, resisted: 2, unknown: false });
	expect(made.survivors.map((item) => item.pid)).toEqual([1, 2, 3, 4]);
	expect(told(made.report, ended)).toContain('stopped');
	for (const item of [outlasting, earlier]) {
		expect(told(made.report, item)).toContain('signalled but still running; the check fails');
		expect(told(made.report, item)).not.toContain('not signalled');
	}
	expect(told(made.report, shielded)).toContain('left running, not signalled; the check fails');
	expect(told(made.report, handed)).toContain('handed over to the system');
	// Told nothing else, what was asked to end is what was signalled.
	expect(settlementReport([outlasting], [outlasting, shielded])).toMatchObject({ resisted: 1 });
});
