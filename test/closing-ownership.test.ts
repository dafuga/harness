import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	processDescendants,
	processTable,
	type ProcessRow,
	type ProcessTable
} from '../src/utils/processDescendants';
import { runIsolated } from '../src/utils/run-isolated/runIsolated';
import { settleProcesses } from '../src/utils/run-isolated/settleProcesses';
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
 * The number of a group proves nothing once its command has been reaped: the processes are read
 * later than that moment, and by then the number may be anyone's. What was never seen beside one
 * of the command's own is not shown to be the command's: it is never signalled, and it fails the
 * command. What was seen under the command is still its own and still ends with it. Every
 * process is a stand-in that these tests start, and it writes down each signal it is sent.
 */
const mac = process.platform === 'darwin';
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const old = 'Mon Oct 12 10:00:00 2026';
const later = 'Mon Oct 12 10:05:00 2026';
const row = (pid: number, parent: number, group: number, started = old): ProcessRow => ({
	pid,
	parent,
	group,
	started
});
const tick = () => pause(0);

test('the first table after the command was reaped claims no member of its group', async () => {
	const unrelated = { pid: 70, parent: 1, group: 10, started: 'new-unrelated' };
	const followed = processDescendants(10, async () => [unrelated]);
	followed.closed();
	await tick();
	expect(await followed.alive()).toEqual([{ ...unrelated, origin: null, proven: false }]);
	expect(await followed.survivors()).toEqual([]);
});

test('after the reaping what was seen under the command is its own, and nothing else is', async () => {
	let shown = [row(10, 1, 10), row(20, 10, 10)];
	const followed = processDescendants(10, async () => shown);
	await followed.look();
	shown = [row(20, 1, 10)];
	followed.closed();
	await tick();
	const own = { ...row(20, 1, 10), origin: { pid: 10, started: old }, proven: true };
	expect(await followed.alive()).toEqual([own]);
	expect(await followed.survivors()).toEqual([{ pid: 20, started: old }]);
	shown = [row(80, 1, 10, later)];
	expect(await followed.alive()).toEqual([
		{ ...row(80, 1, 10, later), origin: null, proven: false }
	]);
	expect(await followed.survivors()).toEqual([]);
});

test.skipIf(!mac)(
	'a stranger in the group of a reaped command is never signalled, and counts against it',
	async () => {
		const group = 4242;
		const file = join(made.home, 'stranger');
		const stranger = adopted(made.helper, ['4', file]);
		const followed = processDescendants(group, async () => [{ ...stranger, parent: 1, group }]);
		followed.closed();
		await tick();
		const context = { authority: () => made.authority, group };
		const settled = await settleProcesses(followed, context, { settleMs: 300, graceMs: 100 });
		expect(settled).toMatchObject({ survivors: [stranger], stopped: 0, unknown: false });
		expect(settled.report).toContain(`process ${stranger.pid} `);
		expect(settled.report).toContain('left running, not signalled');
		expect(alive(stranger)).toBe(true);
		while (alive(stranger)) await pause(200);
		expect(journal(file)).toBe('retired\n');
	},
	30_000
);

/**
 * A command that starts one process inside its own group, writes down who that is, and ends as
 * soon as the runner has looked once more: `looked` is written by the table the runner reads.
 */
const command = `
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const [dir, program] = process.argv.slice(1);
const looked = () => (fs.existsSync(dir + '/looked') ? fs.readFileSync(dir + '/looked', 'utf8') : '');
const child = spawn(program, ['6', dir + '/journal'], { stdio: 'ignore' });
const when = execFileSync('/bin/ps', ['-p', String(child.pid), '-o', 'lstart=']).toString().trim();
fs.writeFileSync(dir + '/child.part', child.pid + ' ' + when);
fs.renameSync(dir + '/child.part', dir + '/child');
const before = looked();
setInterval(() => looked() !== before && process.exit(0), 5);
`;
type Seam = (dir: string) => ProcessTable;
const noted = (dir: string, looks: number) => writeFileSync(join(dir, 'looked'), String(looks));

/**
 * No look falls into the time in which the command has its child: while the leader of a group
 * is alive, the other members of that group are not shown. Once it was reaped they are.
 */
const neverUnder: Seam = (dir) => {
	let looks = 0;
	return async () => {
		const rows = await processTable();
		const live = new Set(rows?.map((item) => item.pid));
		noted(dir, ++looks);
		return rows?.filter((item) => item.pid === item.group || !live.has(item.group)) ?? null;
	};
};

/** The processes as they are; a look counts once it shows the child under its command. */
const under: Seam = (dir) => {
	let looks = 0;
	return async () => {
		const rows = await processTable();
		const file = join(dir, 'child');
		const child = existsSync(file) ? Number(readFileSync(file, 'utf8').split(' ')[0]) : -1;
		const shown = rows?.find((item) => item.pid === child);
		const leads = shown && rows?.some((item) => item.pid === shown.parent);
		if (shown && leads && shown.parent === shown.group) noted(dir, ++looks);
		return rows;
	};
};

async function ran(name: string, seam: Seam) {
	const dir = join(made.home, name);
	mkdirSync(dir);
	const result = await runIsolated({
		command: process.execPath,
		args: ['-e', command, dir, made.helper],
		cwd: dir,
		env: { ...process.env },
		timeoutMs: 20_000,
		log: join(dir, 'run.log'),
		maxLogBytes: 64_000,
		platform: { authority: () => made.authority, table: seam(dir) }
	});
	const [pid, ...when] = readFileSync(join(dir, 'child'), 'utf8').split(' ');
	const child = remembered({ pid: Number(pid), started: when.join(' ') });
	return { dir, result, child, log: readFileSync(join(dir, 'run.log'), 'utf8') };
}

test.skipIf(!mac)(
	'a process never seen under its command is not signalled when the command ends, and fails it',
	async () => {
		const { dir, result, child, log } = await ran('unseen', neverUnder);
		expect(result).toMatchObject({ status: 'failed', exitCode: 0, timedOut: false });
		expect(result).toMatchObject({ survivors: [child], stopped: 0, unknown: false });
		expect(log).toContain(`process ${child.pid} `);
		expect(log).toContain('left running, not signalled');
		expect(alive(child)).toBe(true);
		while (alive(child)) await pause(200);
		expect(journal(join(dir, 'journal'))).toBe('retired\n');
	},
	30_000
);

test.skipIf(!mac)(
	"seen under its command, the same process is the command's own and ends with it",
	async () => {
		const { dir, result, child } = await ran('seen', under);
		expect(result).toMatchObject({ status: 'passed', exitCode: 0, survivors: [] });
		expect(alive(child)).toBe(false);
		expect(journal(join(dir, 'journal'))).toBe('');
	},
	30_000
);
