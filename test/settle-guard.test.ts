import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { FollowedProcess, TrackedProcess } from '../src/utils/processDescendants';
import { settleProcesses } from '../src/utils/reports-media/run-isolated/settleProcesses';
import { epoch, realProbes } from './support/realProbes';
import { stopFixtureProcesses } from './support/syntheticFixtureCleanup';
import { isStaleSyntheticWrapper } from './support/sweepSyntheticServices';
import { fixtureProcessTable } from './support/syntheticProcessTable';
import {
	adopted,
	alive,
	cleared,
	journal,
	pause,
	syntheticServices,
	type SyntheticServices
} from './support/syntheticServices';

/**
 * No signal without a fresh look at who a process is and what it runs, and no signal to what a
 * possible service started, whatever became of that service. Every process is a stand-in that
 * these tests start; what is shown to the code is the real state except where a test says so.
 */
const mac = process.platform === 'darwin';
const group = 4242;
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterEach(() => {
	if (mac) stopFixtureProcesses(made.home);
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const file = (name: string) => join(made.home, name);
const own = (name: string) => adopted(made.helper, ['30', file(name)]);
const seen = (known: TrackedProcess, more: Partial<FollowedProcess> = {}): FollowedProcess => ({
	...known,
	parent: 1,
	group: known.pid,
	origin: null,
	proven: true,
	...more
});
const watching = (...rows: FollowedProcess[]) => ({
	alive: async () => rows.filter((item) => alive(item))
});
const judging = (probes: typeof realProbes = realProbes) => ({
	authority: () => made.authority,
	group,
	probes
});
const timing = { settleMs: 0, graceMs: 100, cleanupMs: 15_000 };

test.skipIf(!mac)(
	'a process replaced while another is still being judged is not signalled',
	async () => {
		const [replaced, slow] = [own('replaced'), own('slow')];
		let looks = 0;
		const probes = {
			...realProbes,
			facts: async (pid: number) => {
				const real = await realProbes.facts(pid);
				return real && pid === replaced.pid && ++looks > 1 ? { ...real, started: epoch } : real;
			},
			executable: async (pid: number) => {
				if (pid === slow.pid) await pause(800);
				return realProbes.executable(pid);
			}
		};
		const rows = watching(seen(replaced), seen(slow));
		const settled = await settleProcesses(rows, judging(probes), timing);
		expect([alive(replaced), journal(file('replaced'))]).toEqual([true, '']);
		expect(alive(slow)).toBe(false);
		expect(settled.survivors).toEqual([slow]);
	},
	30_000
);

test.skipIf(!mac)(
	'a crashed fixture worker leaves neither its wrapper nor its unrecorded child',
	async () => {
		const home = realpathSync(mkdtempSync(join(tmpdir(), 'harness-services-')));
		const ready = file('crashed-worker');
		const cleanup = fileURLToPath(new URL('./support/syntheticFixtureCleanup.ts', import.meta.url));
		const wrapper = `
		const {spawn} = require('node:child_process');
		const child = spawn('/bin/sleep', ['60'], {stdio: 'ignore'});
		require('node:fs').writeFileSync(${JSON.stringify(ready)}, process.pid + ' ' + child.pid);
		setInterval(() => {}, 1000);
	`;
		const script = `
		import {spawn, execFileSync} from 'node:child_process';
		import {watchFixture, recordFixtureProcess} from ${JSON.stringify(cleanup)};
		const home = ${JSON.stringify(home)};
		watchFixture(home);
		const child = spawn(${JSON.stringify(process.execPath)}, ['-e', ${JSON.stringify(wrapper)}],
			{detached: true, stdio: 'ignore'});
		const started = execFileSync('/bin/ps', ['-p', String(child.pid), '-o', 'lstart=']).toString().trim();
		recordFixtureProcess(home, {pid: child.pid, started});
		setInterval(() => {}, 1000);
	`;
		const worker = spawn('bun', ['-e', script], { stdio: 'inherit' });
		try {
			await expect.poll(() => existsSync(ready) && existsSync(join(home, '.processes'))).toBe(true);
			const pids = readFileSync(ready, 'utf8').split(' ').map(Number);
			const known = pids.map((pid) => {
				const [row] = fixtureProcessTable(pid);
				expect(row.group).toBe(pids[0]);
				return row;
			});
			worker.kill('SIGKILL');
			await expect
				.poll(() => [existsSync(home), ...known.map(alive)])
				.toEqual([false, false, false]);
		} finally {
			worker.kill('SIGKILL');
			stopFixtureProcesses(home);
			// The watchdog owns removal. Leave it the directory while it is acting on EOF.
			await expect.poll(() => existsSync(home)).toBe(false);
		}
	},
	15_000
);

test('the stale fixture sweep requires an older private orphan group and a fixture command', () => {
	const dir = '/private/var/folders/abc/def/T/harness-services-x12345';
	const wrapper = {
		pid: 42,
		group: 42,
		parent: 1,
		started: 'Mon Oct 12 10:00:00 2026',
		ageSeconds: 1801,
		command: `/opt/homebrew/bin/node -e setInterval(() => {}, 1000); ${dir}/limit ${dir}/helper`
	};
	expect(
		[
			wrapper,
			{ ...wrapper, parent: 2 },
			{ ...wrapper, group: 43 },
			{ ...wrapper, ageSeconds: 1800 },
			{ ...wrapper, command: wrapper.command.replace('/T/', '/work/') },
			{ ...wrapper, command: wrapper.command.replace('node -e', 'node task.js') }
		].map(isStaleSyntheticWrapper)
	).toEqual([true, false, false, false, false, false]);
});

test.skipIf(!mac)(
	'a process whose program changed or cannot be read at the last look is not signalled',
	async () => {
		const [changed, unreadable] = [own('changed'), own('unreadable')];
		const reads = new Map<number, number>();
		const executable = async (pid: number) => {
			reads.set(pid, (reads.get(pid) ?? 0) + 1);
			if (reads.get(pid)! > 1 && pid === changed.pid) return made.lookAlike;
			if (reads.get(pid)! > 1 && pid === unreadable.pid) return null;
			return realProbes.executable(pid);
		};
		const rows = watching(seen(changed), seen(unreadable));
		const settled = await settleProcesses(rows, judging({ ...realProbes, executable }), timing);
		expect([alive(changed), alive(unreadable)]).toEqual([true, true]);
		expect([journal(file('changed')), journal(file('unreadable'))]).toEqual(['', '']);
		expect(settled.survivors).toEqual(expect.arrayContaining([changed, unreadable]));
		expect(settled.report).toContain('not signalled');
	},
	30_000
);

test.skipIf(!mac)(
	'what a possible service started stays protected after that service is gone',
	async () => {
		const service = adopted(made.lookAlike, ['1', file('service')]);
		const started = own('started');
		const rows = watching(seen(service), seen(started, { origin: service }));
		const settled = await settleProcesses(rows, judging(), { ...timing, settleMs: 2000 });
		expect([alive(service), journal(file('service'))]).toEqual([false, 'retired\n']);
		expect([alive(started), journal(file('started'))]).toEqual([true, '']);
		expect(settled.survivors).toEqual([started]);
	},
	30_000
);

test.skipIf(!mac)(
	"inside the command's group, what a possible service outside it started is not signalled",
	async () => {
		const service = adopted(made.lookAlike, ['30', file('outside')]);
		const inside = own('inside');
		const rows = watching(seen(service), seen(inside, { origin: service, group }));
		const settled = await settleProcesses(rows, judging(), timing);
		expect([alive(inside), journal(file('inside'))]).toEqual([true, '']);
		expect(journal(file('outside'))).toBe('');
		expect(settled.survivors).toEqual(expect.arrayContaining([service, inside]));
	},
	30_000
);

test.skipIf(!mac)(
	'another process under the id of a possible service lends no protection',
	async () => {
		const service = adopted(made.lookAlike, ['30', file('lender')]);
		const leak = own('leak');
		const impostor = { pid: service.pid, started: epoch };
		const rows = watching(seen(service), seen(leak, { origin: impostor }));
		const settled = await settleProcesses(rows, judging(), timing);
		expect(alive(leak)).toBe(false);
		expect(settled.survivors).toEqual(expect.arrayContaining([leak]));
		expect([alive(service), journal(file('lender'))]).toEqual([true, '']);
	},
	30_000
);
