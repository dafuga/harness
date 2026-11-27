import { seedBlockedLaunch } from './trackerObservedRunFixture';
import type { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import { watchLaunchRequests } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchLaunchRequests';
import { trackerNodeApi } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';

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
			auto: 'fixture-request',
			'note+': 'auto-launch requested on harbor-mbp-2'
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
		needs_daniel: false,
		question: null,
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
			if (id === 'next100002' || id === 'next100003')
				await seedBlockedLaunch(runtime, database, id);
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
				'note+': 'auto-launch requested on ' + computer,
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
	const at = Date.parse(queued.updated_at) + 30 * 60_000;
	watchLaunchRequests(runtime.store, at);
	expect(
		runtime
			.watchdog!.alerts()
			.some(({ kind, item_id }) => item_id === 'idle-task1' && kind === 'launch-queue-stuck')
	).toBe(false);
	watchLaunchRequests(runtime.store, at + 1);
	expect(runtime.watchdog!.alerts()).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ item_id: 'idle-task1', kind: 'launch-queue-stuck' })
		])
	);
	expect(watchLaunchRequests(runtime.store, at + 1)).toBe(false);
	verifyUrgentQueueAlert(runtime);
}
function verifyUrgentQueueAlert(runtime: TrackerNativeRuntimeService) {
	const id = 'urgent0001';
	const now = runtime.now();
	runtime.store.appendLocal({
		itemId: id,
		fields: {
			title: 'Urgent tester intake',
			kind: 'task',
			status: 'open',
			priority: 'urgent',
			adapter_due_owner: runtime.store.node,
			due: new Date(now).toISOString()
		}
	});
	const alerts = () => runtime.watchdog!.alerts().filter(({ item_id }) => item_id === id);
	watchLaunchRequests(runtime.store, now + 15 * 60_000);
	expect(alerts()).toEqual([]);
	watchLaunchRequests(runtime.store, now + 15 * 60_000 + 1);
	expect(alerts()).toMatchObject([
		{ kind: 'urgent-launch-queue-stuck', reason: expect.stringContaining('15 minutes') }
	]);
}
