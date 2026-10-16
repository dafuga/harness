import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { classifyProcess } from '../src/utils/platformServices';
import type { FollowedProcess, TrackedProcess } from '../src/utils/processDescendants';
import { runIsolated } from '../src/utils/runIsolated';
import { settleProcesses } from '../src/utils/settleProcesses';
import { realProbes } from './support/realProbes';
import {
	adopted,
	alive,
	cleared,
	identityOf,
	journal,
	pause,
	remembered,
	syntheticServices,
	type SyntheticServices
} from './support/syntheticServices';

/**
 * Settling what a command left always ends, within a bound, with an answer: what could not be
 * read or judged in time is unknown and fails, nothing is signalled for it, and no answer that
 * comes late signals anything. Every process is a stand-in started by these tests.
 */
const mac = process.platform === 'darwin';
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const never = () => new Promise<never>(() => {});
const file = (name: string) => join(made.home, name);
const timing = { settleMs: 0, graceMs: 100, cleanupMs: 1000 };
const judging = (probes: typeof realProbes = realProbes) => ({
	authority: () => made.authority,
	group: 4242,
	probes
});
const seen = (known: TrackedProcess): FollowedProcess => ({
	...known,
	parent: 1,
	group: known.pid,
	origin: null,
	proven: true
});
/** The answer, or 'never' when it has not come after eight seconds. */
const bounded = <T>(work: Promise<T>) => Promise.race([work, pause(8000).then(() => 'never')]);

test.skipIf(!mac)('a read of the processes that never answers ends as unknown', async () => {
	const settled = await bounded(settleProcesses({ alive: never }, judging(), timing));
	expect(settled).toMatchObject({ unknown: true, survivors: [] });
});

test.skipIf(!mac)('a read of the processes that fails ends as unknown', async () => {
	const failing = { alive: () => Promise.reject(new Error('unreadable')) };
	const settled = await bounded(settleProcesses(failing, judging(), timing).catch(() => 'threw'));
	expect(settled).toMatchObject({ unknown: true, survivors: [] });
});

test.skipIf(!mac)(
	'a judgement that never answers is bounded, and its late answer signals nothing',
	async () => {
		const leak = adopted(made.helper, ['30', file('late')]);
		let answer: (path: string | null) => void = () => undefined;
		const executable = (pid: number) =>
			pid === leak.pid
				? new Promise<string | null>((done) => (answer = done))
				: realProbes.executable(pid);
		const rows = { alive: async () => [seen(leak)] };
		const settled = await bounded(
			settleProcesses(rows, judging({ ...realProbes, executable }), timing)
		);
		expect(settled).not.toBe('never');
		const result = settled as { unknown: boolean; survivors: TrackedProcess[] };
		expect(result.unknown || result.survivors.length > 0).toBe(true);
		answer(made.helper);
		await pause(800);
		expect([alive(leak), journal(file('late'))]).toEqual([true, '']);
	},
	30_000
);

test.skipIf(!mac)(
	'tools that are gone when they are asked do not break the judgement',
	async () => {
		const gone = { ...made.authority, rootCode: join(made.home, 'Gone.app') };
		const service = adopted(made.service, ['30', file('orphaned')]);
		const verdict = await classifyProcess(service, { authority: () => gone, group: 1 });
		expect(verdict.standing).toBe('protected');
	}
);

/** A command under the runner whose processes cannot be read, in the way the test says. */
async function unreadable(
	name: string,
	body: string,
	table: () => Promise<never>,
	timeoutMs = 20_000
) {
	const dir = join(made.home, name);
	mkdirSync(dir);
	const script = `require('fs').writeFileSync(process.argv[1] + '/pid', String(process.pid)); ${body}`;
	const began = Date.now();
	const result = await bounded(
		runIsolated({
			command: process.execPath,
			args: ['-e', script, dir],
			cwd: dir,
			env: { ...process.env },
			timeoutMs,
			log: join(dir, 'run.log'),
			maxLogBytes: 64_000,
			platform: { authority: () => made.authority, table, cleanupMs: 1000 }
		})
	);
	return { dir, result, took: Date.now() - began };
}

test.skipIf(!mac)(
	'the runner ends within its bound and fails when the processes never answer or fail to',
	async () => {
		const leaves = (code: number) => `setTimeout(() => process.exit(${code}), 300);`;
		const passing = await unreadable('hung-pass', leaves(0), never);
		const failing = await unreadable('hung-fail', leaves(3), never);
		const rejected = await unreadable('rejected', leaves(0), () => Promise.reject(new Error('no')));
		expect(passing.result).toMatchObject({ status: 'failed', exitCode: 0 });
		expect(failing.result).toMatchObject({ status: 'failed', exitCode: 3 });
		expect(rejected.result).toMatchObject({ status: 'failed', exitCode: 0 });
		expect(Math.max(passing.took, failing.took, rejected.took)).toBeLessThan(6000);
	},
	60_000
);

test.skipIf(!mac)(
	'at its time limit an unreadable command is a timeout within the bound, and nothing is signalled',
	async () => {
		const hung = await unreadable('hung-limit', 'setInterval(() => {}, 1000);', never, 500);
		expect(hung.result).toMatchObject({ status: 'timeout', timedOut: true });
		expect(hung.took).toBeLessThan(7000);
		const pid = Number(readFileSync(join(hung.dir, 'pid'), 'utf8'));
		expect(alive(remembered(identityOf(pid)))).toBe(true);
	},
	60_000
);
