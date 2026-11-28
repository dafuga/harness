import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { vi } from 'vitest';
import type { TrackerDispatchRepository } from '../../src/repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerDispatchRunner } from '../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { fixtureTrackerJson, trackerProcess } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { expect } from '../verificationExpect';

export async function verifyAdoption(
	runtime: TrackerNativeRuntimeService,
	db: DatabaseSync,
	root: string,
	advance: () => void
) {
	const manual = 'man123abcd';
	runtime.store.appendLocal({
		itemId: manual,
		fields: {
			title: 'Hand-launched task',
			kind: 'task',
			status: 'in_progress',
			model: 'gpt-6.1-terra:high',
			schedule_off: true
		}
	});
	const marker = join(root, 'hand-session');
	writeFileSync(marker, '');
	const signal = new AbortController().signal;
	const rows = () =>
		db.prepare('SELECT state,model,effort,tmux FROM runs WHERE item_id = ?').all(manual);
	for (let poll = 0; poll < 2; poll++) {
		advance();
		await runtime.watchdog!.tick(signal);
		expect(rows()).toEqual([
			{ state: 'observed', model: 'gpt-6.1-terra', effort: 'high', tmux: 'man123-recovery' }
		]);
	}
	unlinkSync(marker);
	advance();
	await runtime.watchdog!.tick(signal);
	expect(rows()).toEqual([
		{ state: 'finished', model: 'gpt-6.1-terra', effort: 'high', tmux: 'man123-recovery' }
	]);
	expect(db.prepare('SELECT status, blocked_reason FROM items WHERE id = ?').get(manual)).toEqual({
		status: 'open',
		blocked_reason: null
	});
	expect((await runtime.watchdog!.inspect(manual, signal)).recovery).toEqual([]);
}

export const retainedTrackerTmuxFixture = (at: number) => `
const fs = require('node:fs');
const path = require('node:path');
const [,,, socket, command, ...args] = process.argv;
const closed = path.join(__dirname, 'closed');
const busy = path.join(__dirname, 'busy');
const attached = Number(fs.existsSync(path.join(__dirname, 'attached')));
const raw = 'auto-old008-r8|${at / 1000}|71|%9|200|${at / 1000}|2|2|0|0|0|' + attached + '|1|1|codex';
if (socket !== 'default') process.exit(2);
if (command === 'list-panes' || command === 'display-message') {
	if (!fs.existsSync(closed)) process.stdout.write(raw + '\\n');
} else if (command === 'capture-pane') {
	const idle = !fs.existsSync(busy) || fs.readFileSync(busy, 'utf8') === 'idle';
	process.stdout.write(idle ? 'fixture\\n\\n› \\n\\n100% context left\\n' : 'Working');
} else if (command === 'if-shell') {
	fs.writeFileSync(closed, args.join(' '));
	process.stdout.write('tracker-session-closed\\n');
} else process.exit(2);
`;

export async function verifyStaleIdleAlert(
	runtime: TrackerNativeRuntimeService,
	root: string,
	itemId: string,
	advance: () => void
) {
	runtime.store.appendLocal({ itemId, fields: { status: 'blocked' } });
	const idle = () => runtime.watchdog!.alerts().filter(({ kind }) => kind === 'idle');
	expect(idle()).toEqual([]);
	runtime.store.appendLocal({ itemId, fields: { status: 'in_progress' } });
	writeFileSync(join(root, 'hand-session'), '');
	advance();
	await runtime.watchdog!.tick(new AbortController().signal);
	expect(idle()).toEqual([]);
}

export async function verifyBlockedLaunchCli(spoke: TrackerNodeFixture, id: string, token: string) {
	const item = await fixtureTrackerJson(spoke, ['block', id, 'Old dependency']);
	await expect
		.poll(() => fixtureTrackerJson(spoke, ['status']), { timeout: 8000 })
		.toMatchObject({ sync: { connected: true, pending_push: 0 } });
	const db = new DatabaseSync(spoke.config.database);
	try {
		db.exec('PRAGMA busy_timeout = 5000');
		const now = Date.now();
		db.prepare(
			`INSERT INTO runs(item_id,auto_token,rung,cli,model,state,outcome,failure_reason,queued_at,started_at,ended_at)
			VALUES (?,?,'fable','claude','claude-fable-5-2','finished','blocked','Old dependency',?,?,?)`
		).run(item.id, token, now, now, now);
	} finally {
		db.close();
	}
	for (const args of [
		['answer', id, 'Dependency is ready'],
		['reopen', id],
		['pick', id]
	])
		await fixtureTrackerJson(spoke, args);
	const result = await trackerProcess(spoke, ['launch', id]).exited;
	expect
		.soft(result)
		.toMatchObject({ code: 1, stdout: '', stderr: expect.stringContaining('launcher disabled') });
	expect.soft(result.stderr).toContain(`tracker show ${item.id}`);
	expect.soft(await fixtureTrackerJson(spoke, ['show', id])).toMatchObject({
		auto: expect.not.stringContaining(token),
		runs: [
			expect.objectContaining({
				auto_token: token,
				outcome: 'blocked',
				failure_reason: 'Old dependency'
			})
		]
	});
}

export async function seedBlockedLaunch(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	id: string
) {
	const now = runtime.now();
	database
		.prepare(
			`INSERT INTO runs(id,item_id,auto_token,rung,cli,model,state,outcome,failure_reason,queued_at,started_at,ended_at)
		VALUES (?,?,?,'sol','codex','gpt-6.2-sol','finished','blocked','Old dependency',?,?,?)`
		)
		.run(id === 'next100002' ? -2 : -3, id, id, now, now, now);
	if (id === 'next100003') return;
	runtime.store.appendLocal({
		itemId: id,
		fields: { status: 'blocked', blocked_reason: 'Old dependency' }
	});
	const response = await runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${id}/unblock`, { method: 'POST' })
	);
	expect(response.ok).toBe(true);
	// Record the host's capacity hold before polling the confirmation route.
	await runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${id}/launch`, { method: 'POST' })
	);
	await runtime.scheduler!.tick(new AbortController().signal);
}

const childProgram = `
const { writeFileSync } = require('node:fs');
const [path, key, startedAt] = process.argv.slice(1);
writeFileSync(path, JSON.stringify({ pid: process.pid, key, startedAt: Number(startedAt) }), { mode: 0o600 });
process.stdout.write('ready');
setInterval(() => {}, 60000);
`;

export function managedRunner(
	root: string,
	current: () => { repo: TrackerDispatchRepository },
	startedAt: number
) {
	const receiptPath = join(root, 'receipt.json');
	const fixture: {
		child?: ReturnType<typeof spawn>;
		exited?: Promise<unknown>;
		startedKey: string;
	} = { startedKey: '' };
	const start = vi.fn<TrackerDispatchRunner['start']>(async (reservation) => {
		expect(current().repo.managedRuns()).toMatchObject([
			{ state: 'queued', dispatch_at: startedAt }
		]);
		fixture.startedKey = reservation.key;
		const child = spawn(
			process.execPath,
			['-e', childProgram, receiptPath, fixture.startedKey, String(startedAt)],
			{
				stdio: ['ignore', 'pipe', 'ignore'],
				env: {}
			}
		);
		fixture.child = child;
		const exited = once(child, 'close');
		fixture.exited = exited;
		await Promise.race([
			once(child.stdout, 'data'),
			exited.then(() => {
				throw new Error('fixture child exited before receipt');
			})
		]);
		throw new Error('lost start reply');
	});
	const observe = vi.fn<TrackerDispatchRunner['observe']>(async (_run, key) => {
		const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
		if (receipt.key !== key || receipt.pid !== fixture.child?.pid) return undefined;
		process.kill(receipt.pid, 0);
		return {
			type: 'session',
			session: { key, id: `fixture-${receipt.pid}`, startedAt: receipt.startedAt, state: 'live' }
		};
	});
	return Object.assign(fixture, { runner: { start, observe } });
}
