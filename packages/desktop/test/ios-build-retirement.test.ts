import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type * as Fs from 'node:fs';
import { PassThrough } from 'node:stream';
import type * as Descendants from '../../../src/utils/processDescendants';
type Row = Descendants.ProcessRow & { executable: string };
const fake = vi.hoisted(() => ({
	rows: [] as Row[],
	signals: [] as unknown[],
	readable: true,
	trusted: true,
	spawned: 0
}));
const started = 'Tue Oct 13 01:53:25 2026';
const xcode = '/Applications/Xcode.app/Contents/Developer';
const row = (pid: number, parent: number, group: number, executable: string): Row => ({
	pid,
	parent,
	group,
	started,
	executable
});
const daemon = row(2000, 1, 2000, `${xcode}/usr/bin/ibtoold`);
const agent = 'Platforms/iPhoneSimulator.platform/Developer/Library/Xcode/Overlays/IBAgent-iOS';
const helper = row(3000, 2000, 3000, `${xcode}/${agent}`);
/** What a build ends as when something it waits for did not go: failed, and saying so. */
const stuck = { code: 1, left: expect.stringContaining('did not retire') };
vi.mock('node:child_process', () => ({
	execFile: (
		_command: string,
		_args: string[],
		_options: unknown,
		done: (error: Error | null, output: string) => void
	) => {
		done(
			fake.readable ? null : new Error('unreadable'),
			fake.rows.map((row) => `${row.pid} ${row.started} ${row.executable}`).join('\n')
		);
	},
	spawn: () => {
		fake.spawned++;
		const child = Object.assign(new EventEmitter(), {
			pid: 1001,
			stdout: new PassThrough(),
			stderr: new PassThrough(),
			kill: (...args: unknown[]) => {
				fake.signals.push(args);
				return true;
			}
		}) as unknown as ChildProcess;

		fake.rows.push(row(1001, process.pid, 99, '/usr/bin/xcodebuild'));
		setTimeout(() => {
			fake.rows.push({ ...helper });
		}, 100);
		setTimeout(() => {
			fake.rows = fake.rows.filter((row) => row.pid !== 1001);
			child.emit('close', 0);
		}, 400);
		return child;
	}
}));
vi.mock('node:fs', async (original) => ({
	...(await original<typeof Fs>()),
	realpathSync: (path: string) => path
}));
vi.mock('../scripts/ios-products', () => ({
	desktopRoot: '/synthetic',
	tried: (args: string[]) => ({
		output: args[0] === 'ps' ? '99' : xcode,
		code: 0
	})
}));
vi.mock('../../../src/utils/platformServices', () => ({
	platformServices: async () => ({
		root: xcode,
		services: [{ path: 'usr/bin/ibtoold' }]
	}),
	classifyProcess: async (known: { pid: number }) => ({
		standing: fake.trusted && known.pid === 2000 ? 'delegated' : 'protected'
	})
}));
vi.mock('../../../src/utils/processDescendants', async (original) => {
	const real = await original<typeof Descendants>();
	return {
		...real,
		processDescendants: (pid: number) =>
			real.processDescendants(pid, async () =>
				fake.readable ? fake.rows.map((row) => ({ ...row })) : null
			),
		signalProcesses: async (...args: unknown[]) => {
			fake.signals.push(args);
		}
	};
});

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('HARNESS_VERIFY', '1');
	vi.resetModules();
	fake.rows = [row(process.pid, 1, 99, '/usr/bin/bun'), { ...daemon }];
	fake.signals = [];
	fake.readable = true;
	fake.trusted = true;
	fake.spawned = 0;
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
async function launch() {
	const { followed } = await import('../scripts/ios-build-processes');
	let settled = false;
	const result = followed(['xcodebuild']).then((value) => {
		settled = true;
		return value;
	});
	await vi.advanceTimersByTimeAsync(0);
	return { result, settled: () => settled };
}
test('a reused daemon helper must retire naturally before the next build returns success', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(1000);
	expect(run.settled()).toBe(false);
	expect(fake.signals).toEqual([]);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	await vi.advanceTimersByTimeAsync(200);
	expect(await run.result).toMatchObject({ code: 0, left: null });
	expect(fake.signals).toEqual([]);
});
test('a reused daemon helper that stays beyond the bound fails without any signal', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(31_000);
	expect(run.settled()).toBe(true);
	expect(await run.result).toMatchObject(stuck);
	expect(fake.signals).toEqual([]);
});
test('an unreadable observation cannot become successful empty settlement', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(500);
	fake.readable = false;
	await vi.advanceTimersByTimeAsync(31_000);
	expect(run.settled()).toBe(true);
	expect(await run.result).toMatchObject(stuck);
	expect(fake.signals).toEqual([]);
});
test('an untrusted preexisting daemon is refused before a new build starts', async () => {
	fake.trusted = false;
	const { followed } = await import('../scripts/ios-build-processes');
	const request = followed(['xcodebuild']);
	const outcome = request.then(
		(value) => ({ value }),
		(error) => ({ error })
	);
	await vi.advanceTimersByTimeAsync(31_000);
	expect(await outcome).toMatchObject({
		error: expect.objectContaining({ message: expect.stringContaining('could not be attested') })
	});
	expect(fake.spawned).toBe(0);
	expect(fake.signals).toEqual([]);
});
test('a replaced daemon PID confers no ancestry or signal authority', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(1000);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	fake.rows.find((row) => row.pid === 2000)!.started = 'Tue Oct 13 02:00:00 2026';
	fake.rows.push({ ...helper, started: 'Tue Oct 13 02:00:01 2026' });
	await vi.advanceTimersByTimeAsync(300);
	expect(await run.result).toMatchObject({ code: 0, left: null });
	expect(fake.signals).toEqual([]);
});
test('unchanged empty service observation retains normal successful build', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(500);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	await vi.advanceTimersByTimeAsync(500);
	expect(await run.result).toMatchObject({ code: 0, left: null });
	expect(fake.signals).toEqual([]);
});

test('a helper stays observed after reparenting and is never signalled', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(300);
	fake.rows.find((row) => row.pid === 3000)!.parent = 1;
	await vi.advanceTimersByTimeAsync(1000);
	expect(run.settled()).toBe(false);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	await vi.advanceTimersByTimeAsync(200);
	expect(await run.result).toMatchObject({ code: 0, left: null });
	expect(fake.signals).toEqual([]);
});
test('lost service attestation is not an ongoing exemption', async () => {
	const run = await launch();
	await vi.advanceTimersByTimeAsync(500);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	fake.trusted = false;
	await vi.advanceTimersByTimeAsync(31_000);
	expect(run.settled()).toBe(true);
	expect(await run.result).toMatchObject(stuck);
	expect(fake.signals).toEqual([]);
});

test('separate consecutive build invocations retain observation of a reused daemon', async () => {
	const first = await launch();
	await vi.advanceTimersByTimeAsync(500);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	await vi.advanceTimersByTimeAsync(500);
	expect(await first.result).toMatchObject({ code: 0, left: null });
	vi.resetModules(); // Like the separate Debug/Release script processes: no module state survives.
	const second = await launch();
	await vi.advanceTimersByTimeAsync(1000);
	expect(second.settled()).toBe(false);
	fake.rows = fake.rows.filter((row) => row.pid !== 3000);
	await vi.advanceTimersByTimeAsync(200);
	expect(await second.result).toMatchObject({ code: 0, left: null });
	expect(fake.spawned).toBe(2);
	expect(fake.signals).toEqual([]);
});
