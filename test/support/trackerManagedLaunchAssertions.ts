import { verifyBlockedLaunchCli } from './trackerObservedRunFixture';
import { mkdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import { trackerManagedToken } from '../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedLaunchReceipt';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { managedTrackerItemRequest } from './trackerManagedProcessFixture';
import { fixtureTrackerJson, trackerProcess } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export async function verifyCancelledClaim(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	attempts: string,
	itemId: string
) {
	const tick = () => runtime.scheduler!.tick(new AbortController().signal);
	expect((await managedTrackerItemRequest(runtime, itemId, 'done')).ok).toBe(true);
	await tick();
	for (const action of ['reopen', 'unlaunch', 'launch'])
		expect((await managedTrackerItemRequest(runtime, itemId, action)).ok).toBe(true);
	const token = database.prepare('SELECT auto FROM items WHERE id = ?').get(itemId)!.auto;
	const directory = join(
		attempts,
		trackerManagedToken(runtime.store.node, JSON.stringify([itemId, token, 1]))
	);
	mkdirSync(directory, { mode: 0o700 });
	await tick();
	const runs = () =>
		database
			.prepare('SELECT id,state,outcome,started_at FROM runs WHERE id >= 4 ORDER BY id')
			.all();
	const held = [{ id: 4, state: 'queued', outcome: null, started_at: null }];
	expect(runs()).toEqual(held);
	expect((await managedTrackerItemRequest(runtime, itemId, 'unlaunch')).ok).toBe(true);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	expect(database.prepare('SELECT auto FROM items WHERE id = ?').get(itemId)!.auto).not.toBe(token);
	await tick();
	expect(runs()).toEqual(held);
	const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000);
	const probe = join(attempts, '..', 'tmux-presence');
	try {
		for (const reply of ['tmux inventory permission denied', 'HARNESS_TRACKER_ATTEMPT=live']) {
			writeFileSync(probe, reply);
			await tick();
			expect(runs()).toEqual(held);
		}
		unlinkSync(probe);
		const marker = join(directory, 'started.tmp');
		writeFileSync(marker, 'synthetic partial startup marker', { mode: 0o600 });
		await tick();
		expect(runs()).toEqual(held);
		unlinkSync(marker);
		await tick();
		expect(runs()).toEqual([
			{ id: 4, state: 'finished', outcome: 'abandoned', started_at: null },
			{ id: 5, state: 'running', outcome: null, started_at: expect.any(Number) }
		]);
		expect((await managedTrackerItemRequest(runtime, itemId, 'done')).ok).toBe(true);
		await tick();
		expect(runs()).toHaveLength(2);
	} finally {
		clock.mockRestore();
	}
}

export async function verifyExpiredClaim(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	attempts: string,
	itemId: string
) {
	const tick = () => runtime.scheduler!.tick(new AbortController().signal);
	const daytime = new Date();
	daytime.setUTCHours(9, 0, 0, 0);
	if (daytime.getTime() < Date.now()) daytime.setUTCDate(daytime.getUTCDate() + 1);
	const clock = vi.spyOn(Date, 'now').mockReturnValue(daytime.getTime());
	try {
		for (const action of ['reopen', 'unlaunch', 'schedule-on', 'launch'])
			expect((await managedTrackerItemRequest(runtime, itemId, action)).ok).toBe(true);
		const token = database.prepare('SELECT auto FROM items WHERE id = ?').get(itemId)!.auto;
		mkdirSync(
			join(attempts, trackerManagedToken(runtime.store.node, JSON.stringify([itemId, token, 1]))),
			{
				mode: 0o700
			}
		);
		await tick();
		const runs = () =>
			database.prepare('SELECT id,state,attempt,started_at FROM runs WHERE id >= 6').all();
		expect(runs()).toEqual([{ id: 6, state: 'queued', attempt: 1, started_at: null }]);
		clock.mockReturnValue(daytime.getTime() + 6 * 60_000);
		await tick();
		await tick();
		const expired = { id: 6, state: 'finished', attempt: 1, started_at: null };
		const held = { id: 7, state: 'queued', attempt: 2, started_at: null };
		expect(runs(), 'a future due time holds the unattended retry').toEqual([expired, held]);
		runtime.store.appendLocal({ itemId, fields: { due: '2020-03-04' } });
		await tick();
		const resumed = { ...held, state: 'running', started_at: expect.any(Number) };
		expect(runs()).toEqual([expired, resumed]);
	} finally {
		clock.mockRestore();
	}
}

export async function verifyLegacyQueuedClaim(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	root: string,
	itemId: string
) {
	const tick = () => runtime.scheduler!.tick(new AbortController().signal);
	for (const action of ['done', 'reopen', 'unlaunch']) {
		expect((await managedTrackerItemRequest(runtime, itemId, action)).ok).toBe(true);
		await tick();
	}
	const retained = join(root, 'run-8');
	mkdirSync(retained, { mode: 0o700 });
	database
		.prepare(
			`INSERT INTO runs (id,item_id,auto_token,rung,cli,model,state,queued_at)
		VALUES (8,?,'legacy-claim','sol','codex','gpt-6.2-sol','queued',?)`
		)
		.run(itemId, Date.now() - 6 * 60_000);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	const runs = () =>
		database.prepare('SELECT id,state,outcome FROM runs WHERE id >= 8 ORDER BY id').all();
	await tick();
	expect(runs()).toEqual([{ id: 8, state: 'queued', outcome: null }]);
	rmdirSync(retained);
	await tick();
	expect(runs()).toEqual([
		{ id: 8, state: 'finished', outcome: 'abandoned' },
		{ id: 9, state: 'running', outcome: null }
	]);
}

export async function verifyLaunchCliOptions(spoke: TrackerNodeFixture, id: string) {
	const short = id.slice(0, 6);
	const { id: visualId } = await fixtureTrackerJson(spoke, ['add', 'Design a dashboard mockup']);
	// The Tracker process uses the real clock: Claude Sonnet until the Codex reset, then Sol.
	const claudeOnly = Date.now() < Date.parse('2026-11-27T10:39:00Z');
	expect(await fixtureTrackerJson(spoke, ['pick', visualId])).toMatchObject(
		claudeOnly
			? {
					rung: 'sonnet',
					model: 'claude-sonnet-5-5',
					cli: 'claude',
					effort: 'medium',
					pinned: false
				}
			: { rung: 'sol', model: 'gpt-6.2-sol', cli: 'codex', effort: 'medium', pinned: false }
	);
	const launch = ['launch', short, '--project', 'Tracker', '--model', 'Fable:high'];
	const rejected = await trackerProcess(spoke, launch).exited;
	expect(rejected).toMatchObject({
		code: 1,
		stdout: '',
		stderr: expect.stringContaining('launcher disabled')
	});
	const launched = await fixtureTrackerJson(spoke, ['show', short]);
	expect(launched).toMatchObject({
		id,
		auto: expect.stringMatching(/^synthetic-spoke@/),
		launch_source: 'manual',
		launch_target: 'synthetic-spoke',
		project: 'Tracker',
		model: 'Fable:high'
	});
	expect((await trackerProcess(spoke, launch).exited).code).toBe(1);
	expect(await fixtureTrackerJson(spoke, ['show', short])).toEqual(launched);
	expect(await fixtureTrackerJson(spoke, ['pick', short])).toMatchObject({
		rung: 'fable',
		model: 'claude-fable-5-2',
		effort: 'high',
		pinned: true
	});
	await verifyBlockedLaunchCli(spoke, short, launched.auto);
	expect((await trackerProcess(spoke, ['launch', short, '--model', 'sol:low']).exited).code).toBe(
		1
	);
	await verifyLaunchCliTimeout(spoke, short, id);
	expect(await fixtureTrackerJson(spoke, ['launch', 'on', short])).toMatchObject({
		id,
		schedule_off: false
	});
}

async function verifyLaunchCliTimeout(spoke: TrackerNodeFixture, short: string, id: string) {
	const clear = ['launch', 'off', short];
	expect(await fixtureTrackerJson(spoke, clear)).toMatchObject({
		id,
		auto: null,
		schedule_off: true
	});
	const waiting = await trackerProcess(spoke, ['launch', short, '--computer', 'grok-box']).exited;
	expect(waiting).toMatchObject({
		code: 1,
		stdout: '',
		stderr: expect.stringContaining('no run confirmation within 20 seconds on grok-box')
	});
	expect(await fixtureTrackerJson(spoke, clear)).toMatchObject({ id, auto: null });
}

export function verifyManagedBrief(launched: { brief: string; cwd: string }, root: string) {
	expect(launched.brief).toContain('Run 1, attempt 1');
	expect(launched.brief).toContain('Project: Harness');
	expect(launched.brief).toContain('2099-03-04');
	expect(launched.brief).toContain(root);
	expect(launched.brief).toContain('private git worktree');
	expect(launched.brief).toContain(launched.cwd);
	expect(launched.brief).toContain('Greymass remote');
	expect(launched.brief).toMatch(
		/## Parent[\s\S]+Parent assignment[\s\S]+Inspect the pending sibling/
	);
	expect(launched.brief).not.toContain('## Earlier attempts');
}
