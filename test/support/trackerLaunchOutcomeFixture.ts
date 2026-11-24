import type { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import { trackerNodeApi } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { fixtureTrackerJson, trackerProcess } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export async function verifyLaunchCliOptions(spoke: TrackerNodeFixture, id: string) {
	const short = id.slice(0, 6);
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

export async function verifyLaunchWatchdogBoundary(
	runtime: TrackerNativeRuntimeService,
	signal: AbortSignal,
	advance: (milliseconds: number) => void
) {
	const requestId = 'waiting123';
	const minute = 60_000;
	runtime.store.appendLocal({
		itemId: requestId,
		fields: {
			title: 'Remote launch without a run',
			kind: 'task',
			status: 'open',
			launch_target: 'harbor-mbp-2',
			auto: 'fixture-request'
		}
	});
	advance(minute - 1);
	await runtime.watchdog!.tick(signal);
	expect(runtime.watchdog!.alerts()).toEqual([]);
	advance(1);
	await runtime.watchdog!.tick(signal);
	expect(runtime.watchdog!.alerts()).toMatchObject([
		{ item_id: requestId, kind: 'launch-without-run', host: 'harbor-mbp-2' }
	]);
	runtime.store.appendLocal({ itemId: requestId, fields: { auto: null, status: 'ignored' } });
}

export async function verifyIdleWatchdogAlert(
	runtime: TrackerNativeRuntimeService,
	itemId: string,
	node: string
) {
	const response = await trackerNodeApi(
		new Request('http://tracker-fixture.invalid/watchdog/alerts'),
		runtime,
		new TrackerSupervisorService(runtime),
		'synthetic-fence'
	);
	expect(await response.json()).toMatchObject([{ item_id: itemId, host: node, kind: 'idle' }]);
	const item = await runtime.items.handle(
		new Request('http://tracker-fixture.invalid/items/' + itemId)
	);
	expect(await item.json()).toMatchObject({
		needs_daniel: true,
		notes_log: [
			{ text: expect.stringContaining('watchdog nudge 1/1') },
			{ text: expect.stringContaining('watchdog idle') }
		]
	});
}

export async function verifyHostLaunchOutcomes(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	signal: AbortSignal
) {
	seedUnlaunchableItems(runtime, database);
	try {
		await runtime.scheduler!.tick(signal);
		const started = await launchReply(runtime, 'next100001');
		expect(started.status).toBe(200);
		expect(await started.json()).toMatchObject({
			id: 'next100001',
			run: { id: 9, state: 'running', node: runtime.store.node }
		});
		for (const [id, reason] of [
			['next100002', 'Tracker host is at session capacity'],
			['next100003', 'waiting on Daniel (flagged)'],
			['noroute123', 'no approved Tracker repository or platform for this node'],
			['existing12', 'item already has an open session'],
			['recurring1', 'recurring item'],
			['plan123456', 'item is a plan; only tasks can launch']
		]) {
			const held = await launchReply(runtime, id);
			expect.soft(held.status).toBe(409);
			expect.soft(await held.json()).toMatchObject({ error: expect.stringContaining(reason) });
		}
	} finally {
		database.prepare("DELETE FROM runs WHERE item_id = 'existing12'").run();
		for (const itemId of ['noroute123', 'existing12', 'recurring1', 'plan123456']) {
			runtime.store.appendLocal({ itemId, fields: { status: 'ignored', auto: null } });
		}
	}
}

function seedUnlaunchableItems(runtime: TrackerNativeRuntimeService, database: DatabaseSync) {
	const computer = runtime.store.node;
	for (const [id, overrides] of [
		['noroute123', { project: 'Unknown project' }],
		['existing12', {}],
		['recurring1', { every: 'daily' }],
		['plan123456', { kind: 'plan' }]
	] as [string, Record<string, string>][]) {
		runtime.store.appendLocal({
			itemId: id,
			fields: {
				title: id,
				kind: 'task',
				status: 'open',
				project: 'Harness',
				auto: id,
				computer,
				launch_target: computer,
				launch_source: 'manual',
				...overrides
			}
		});
	}
	database
		.prepare(
			`INSERT INTO runs(item_id, rung, cli, model, state, queued_at, started_at)
		VALUES ('existing12','manual','codex','gpt-6.2-sol','observed',?,?)`
		)
		.run(runtime.now(), runtime.now());
}

function launchReply(runtime: TrackerNativeRuntimeService, id: string) {
	return trackerNodeApi(
		new Request(`http://tracker-fixture.invalid/items/${id}/launch?outcome=run`, {
			method: 'POST',
			body: '{}'
		}),
		runtime,
		new TrackerSupervisorService(runtime),
		'fixture'
	);
}

export async function verifyIdleCapacityQueue(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	signal: AbortSignal,
	advance: (elapsed: number) => void
) {
	const states = {
		'idle-task1': {},
		'later-task': { schedule_off: 1 },
		'blocked-id': { needs_daniel: 1, question: 'Blocked: approval' }
	};
	const setActivity = database.prepare('UPDATE items SET updated_at = ? WHERE id = ?');
	const lastActivity = new Date(runtime.now() - 119 * 60_000).toISOString();
	for (const [id, state] of Object.entries(states)) {
		const fields = { title: id, kind: 'task', status: 'open', project: 'Harness', ...state };
		runtime.store.appendLocal({ itemId: id, fields });
		setActivity.run(lastActivity, id);
	}
	await runtime.watchdog!.tick(signal);
	const read = async (path: string) =>
		await (await runtime.items.handle(new Request(`http://localhost${path}`))).json();
	expect(await read('/items/idle-task1')).toMatchObject({ auto: null });
	advance(60_000);
	await runtime.watchdog!.tick(signal);
	const queued = await read('/items/idle-task1');
	expect(queued).toMatchObject({ auto: expect.any(String), launch_target: runtime.store.node });
	expect(await read('/items/later-task')).toMatchObject({ auto: null });
	expect(await read('/items/blocked-id')).toMatchObject({ auto: null });
	advance(180_000);
	await runtime.scheduler!.tick(signal);
	expect(await read('/items/idle-task1')).toMatchObject({ auto: queued.auto });
	expect(await read('/digest')).toMatchObject({
		queued: expect.arrayContaining([
			expect.objectContaining({ id: 'idle-task1', waiting_minutes: 3 })
		])
	});
}
