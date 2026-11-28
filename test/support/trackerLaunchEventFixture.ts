import { DatabaseSync } from 'node:sqlite';
import { onTestFinished } from 'vitest';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import type { TrackerDispatchRunner } from '../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { fixturePolicy, primary } from './trackerDispatcherFixture';
import type {
	LaunchEventFixture,
	LaunchEventFixtureOptions,
	LaunchEventState
} from './trackerLaunchEventFixture.types';

export type { LaunchEventFixture };

const signal = new AbortController().signal;
const minute = 60_000;

/** A hub with a real journal and scheduler, a scripted host and a captured webhook. */
export function launchEventFixture({ scheduleDue = false }: LaunchEventFixtureOptions = {}) {
	const state: LaunchEventState = {
		at: Date.parse('2026-11-25T20:00:00Z'),
		exited: new Set(),
		sent: []
	};
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const runtime = launchRuntime(database, state, scheduleDue);
	const write = (itemId: string, fields: Record<string, unknown>) =>
		runtime.store.appendLocal({ itemId, fields, actor: 'Chief of Staff' });
	return {
		state,
		sent: state.sent,
		runtime,
		item: write,
		add: (id: string, fields: Record<string, unknown> = {}) => write(id, newTask(id, fields)),
		tick: async () => {
			state.at += minute / 4;
			await runtime.scheduler!.tick(signal);
		},
		exit: (id: string) => state.exited.add(id),
		notify: () => notifyOnce(runtime),
		recorded: () =>
			database
				.prepare('SELECT kind, item_id FROM launch_events ORDER BY id')
				.all()
				.map((row) => [row.kind, row.item_id]),
		pending: () =>
			database.prepare('SELECT count(*) AS n FROM launch_events WHERE batched = 0').get()!.n,
		notes: (id: string) =>
			database
				.prepare('SELECT text FROM item_notes WHERE item_id = ? ORDER BY hlc')
				.all(id)
				.map((row) => row.text),
		show: async (id: string) =>
			(await runtime.items.handle(new Request(`http://tracker.test/items/${id}`))).json(),
		requests: () => new TrackerSupervisorService(runtime).status().autolaunch
	};
}

export function finishBatchWindow(fixture: LaunchEventFixture) {
	fixture.state.at += 10 * minute;
}

function newTask(id: string, fields: Record<string, unknown>) {
	return {
		title: id,
		kind: 'task',
		status: 'open',
		project: 'harness',
		computer: primary,
		created_by: primary,
		auto: `token-${id}`,
		...fields
	};
}

/** Run the supervisor's own notification worker once, as the running node does. */
async function notifyOnce(runtime: TrackerNativeRuntimeService) {
	const controller = new AbortController();
	const supervisor = new TrackerSupervisorService(runtime, {
		intervalMs: 60_000,
		ticks: { dispatch: async () => {} }
	});
	const running = supervisor.run(controller.signal);
	await new Promise((resolve) => setTimeout(resolve, 20));
	controller.abort();
	await running;
}

function launchRuntime(database: DatabaseSync, state: LaunchEventState, scheduleDue: boolean) {
	const now = () => state.at;
	const base = fixturePolicy(now);
	return new TrackerNativeRuntimeService(database, {
		node: primary,
		role: 'hub',
		now,
		notification: capturedWebhook(state),
		dispatch: {
			policy: fixturePolicy(now, {
				admit: (item) => (item.id === 'held000001' ? 'no approved repository' : null),
				pickModel: (item) =>
					item.model === 'unknown' ? { error: 'unknown model' } : base.pickModel(item)
			}),
			...(scheduleDue && { scheduleDue, due: () => ({ enabled: true, paused: false }) }),
			runner: scriptedRunner(state)
		}
	});
}

function scriptedRunner(state: LaunchEventState): TrackerDispatchRunner {
	return {
		start: async ({ run, key }) => ({
			type: 'session',
			session: { key, id: `session-${run.id}`, state: 'live', startedAt: state.at }
		}),
		observe: async (run) => ({
			type: 'monitor',
			session: state.exited.has(run.item_id) ? 'exited' : 'live'
		})
	};
}

function capturedWebhook(state: LaunchEventState) {
	const destination = { id: 'fixture-chief', kind: 'http' } as const;
	return {
		webhook: { destination, batch: false },
		destinations: {
			available: () => true,
			async send({ body }: { body: string }) {
				const payload = JSON.parse(body);
				if (payload.event === 'autolaunch') state.sent.push(payload);
				return { status: 'sent' } as const;
			}
		}
	};
}
