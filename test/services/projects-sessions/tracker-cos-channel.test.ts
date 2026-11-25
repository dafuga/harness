import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { recordWatchdogAlert } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogState';

const now = Date.UTC(2026, 10, 25, 23);
const options = [
	{ label: 'Approve', effect: '', recommended: true },
	{ label: 'Hold', effect: '' }
];

/** One real Daniel decision is open, beside a working item a session may ping about. */
function tracker() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-hub', { now: () => now });
	const items = new TrackerItemReadRepository(database);
	const api = new TrackerLocalApiService(store, items, {
		now: () => now,
		runs: new TrackerRunReadRepository(database, store.node)
	});
	for (const [itemId, title] of [
		['decision1', 'Synthetic decision'],
		['worker001', 'Synthetic worker']
	])
		store.appendLocal({ itemId, fields: { title, status: 'in_progress', kind: 'task' } });
	store.appendLocal({
		itemId: 'decision1',
		fields: {
			needs_daniel: 1,
			resolved: 0,
			question: 'Approve the synthetic spec?',
			options: JSON.stringify(options)
		}
	});
	const needsYou = () => items.digest(now).daniel_decisions.map(({ id }) => id);
	const post = (path: string, body: object) =>
		api.handle(
			new Request(`http://127.0.0.1${path}`, { method: 'POST', body: JSON.stringify(body) })
		);
	return { database, store, items, needsYou, post };
}

test('a watchdog idle ping goes to the Chief of Staff channel only', () => {
	const { database, store, items, needsYou } = tracker();
	try {
		const before = needsYou();
		recordWatchdogAlert(
			store,
			{
				itemId: 'worker001',
				kind: 'idle',
				reason: 'Session auto-worker-r1 is idle again after a watchdog check-in.',
				identity: 'pane:1'
			},
			now
		);
		expect(needsYou()).toEqual(before);
		const item = items.getStored('worker001');
		expect(item).toMatchObject({ needs_daniel: false, question: null, status: 'in_progress' });
		expect(item.notes_log.at(-1)?.text).toMatch(/^watchdog idle:/);
		// The CoS channel: what `tracker needs-attention` serves and the CoS tick delivers.
		expect(readWatchdogAlerts(store)['worker001:idle']).toMatchObject({ item_id: 'worker001' });
	} finally {
		database.close();
	}
});

test('a watchdog alert never replaces an open Daniel decision', () => {
	const { database, store, items, needsYou } = tracker();
	try {
		recordWatchdogAlert(
			store,
			{ itemId: 'decision1', kind: 'idle', reason: 'Idle again.', identity: 'pane:2' },
			now
		);
		expect(needsYou()).toEqual(['decision1']);
		expect(items.getStored('decision1').question).toBe('Approve the synthetic spec?');
	} finally {
		database.close();
	}
});

for (const question of [
	'daniel-primary-mbp: Session auto-x-r1 is idle again after a watchdog check-in. Chief of Staff, please inspect the session.',
	'CoS: please publish the canvas from your session.',
	'Chief of Staff: which computer should run this?'
])
	test(`a flag addressed to Chief of Staff never asks Daniel: ${question.slice(0, 24)}`, async () => {
		const { database, store, items, needsYou, post } = tracker();
		try {
			const response = await post('/items/worker001/flag', { question, options });
			expect(response.status).toBe(200);
			expect(needsYou()).toEqual(['decision1']);
			const item = items.getStored('worker001');
			expect(item.needs_daniel).toBe(false);
			expect(item.notes_log.at(-1)?.text).toContain('Chief of Staff');
			expect(Object.values(readWatchdogAlerts(store))).toMatchObject([
				{ item_id: 'worker001', kind: 'cos-message', reason: question }
			]);
		} finally {
			database.close();
		}
	});
