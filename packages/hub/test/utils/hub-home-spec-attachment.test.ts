import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { readLocalAttachment } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/readLocalAttachment';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import { parseHomePayload } from '../../src/routes/api/hub-home/homePayload';
import {
	readHomeDocument,
	reconcileHomeDocuments,
	storeHomeDocument
} from '../../src/routes/api/hub-home/homeDocumentStore';
import type { OverviewBucket } from '../../src/routes/api/tracker-overview/trackerOverviewCache.types';

const now = Date.UTC(2026, 10, 25, 12);
const markdown = '# Service\n\n| Part | Owner |\n| --- | --- |\n| API | Us |\n';

function liveTracker() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-hub', { now: () => now });
	const items = new TrackerItemReadRepository(database);
	const api = new TrackerLocalApiService(store, items, {
		now: () => now,
		runs: new TrackerRunReadRepository(database, store.node)
	});
	const fetcher = (async (input: string | URL, init?: RequestInit) => {
		if (String(input).endsWith('/machines')) return Response.json([]);
		return api.handle(new Request(String(input), init));
	}) as typeof fetch;
	const post = (path: string, body: object) =>
		fetcher(`http://127.0.0.1:7701${path}`, { method: 'POST', body: JSON.stringify(body) });
	store.appendLocal({
		itemId: 'review001',
		fields: { title: 'Service spec', status: 'in_progress', kind: 'task', agent: 'widgets' }
	});
	return { items, fetcher, post, close: () => database.close() };
}

function memoryBucket() {
	const files = new Map<string, string>();
	return {
		files,
		bucket: {
			get: async (key: string) => {
				const value = files.get(key);
				return value === undefined ? null : { text: async () => value };
			},
			put: async (key: string, value: string) => void files.set(key, value),
			delete: async (keys: string | string[]) => {
				for (const key of [keys].flat()) files.delete(key);
			}
		} as unknown as OverviewBucket
	};
}

const ask = (extra: object) => ({
	question: 'Approve the service spec?',
	options: [
		{ label: 'Approve', effect: '', recommended: true },
		{ label: 'Hold', effect: '' }
	],
	...extra
});

async function snapshotOf(tracker: ReturnType<typeof liveTracker>) {
	const sources = await readTrackerSources(tracker.fetcher, true);
	const home = buildHomeSnapshot(sources, noProviders, now);
	return parseHomePayload(JSON.parse(JSON.stringify(home)));
}

test('a flagged spec reaches Hub: listing in the snapshot, document stored apart', async () => {
	const tracker = liveTracker();
	const { bucket, files } = memoryBucket();
	try {
		const attachments = [{ kind: 'spec', title: 'service.md', pr: 7, markdown }];
		expect((await tracker.post('/items/review001/flag', ask({ attachments }))).status).toBe(200);
		const shown = tracker.items.get('review001');
		expect(JSON.stringify(shown)).not.toContain('| API | Us |');

		const snapshot = await snapshotOf(tracker);
		const [listing] = snapshot.openAsks?.[0].attachments ?? [];
		expect(listing).toMatchObject({ kind: 'spec', title: 'service.md', pr: 7 });
		expect(JSON.stringify(snapshot)).not.toContain('| API | Us |');

		const [wanted] = await reconcileHomeDocuments(bucket, 'owner', snapshot);
		expect(wanted).toEqual({ id: listing.id, itemId: 'review001' });
		const document = await readLocalAttachment(wanted, tracker.fetcher);
		expect(await readLocalAttachment(wanted, tracker.fetcher, 'open-ask')).toEqual({ markdown });
		const forged = { id: wanted.id, document: { markdown: 'other text' } };
		expect(await storeHomeDocument(bucket, 'owner', forged, snapshot)).toBe(false);
		const upload = { id: wanted.id, document };
		expect(await storeHomeDocument(bucket, 'owner', upload, snapshot)).toBe(true);
		expect((await readHomeDocument(bucket, 'owner', wanted.id))?.markdown).toBe(markdown);
		expect(await reconcileHomeDocuments(bucket, 'owner', snapshot)).toEqual([]);

		await tracker.post('/items/review001/answer', { option: 1, by: 'Daniel' });
		expect(
			await readLocalAttachment(wanted, tracker.fetcher, 'open-ask'),
			'a closed ask is no longer readable through the linked connection'
		).toBeNull();
		await reconcileHomeDocuments(bucket, 'owner', await snapshotOf(tracker));
		expect([...files.values()].join()).not.toContain('| API | Us |');
	} finally {
		tracker.close();
	}
});

test('a new question drops the earlier attachments', async () => {
	const tracker = liveTracker();
	try {
		const attachments = [{ kind: 'doc', title: 'a.md', markdown }];
		await tracker.post('/items/review001/flag', ask({ attachments }));
		const [{ id }] = tracker.items.get('review001').attachments ?? [];
		const next = ask({ question: 'Ship the build today?', force: true });
		await tracker.post('/items/review001/flag', next);
		expect(tracker.items.get('review001').attachments).toBeUndefined();
		const gone = await tracker.fetcher(`http://127.0.0.1:7701/items/review001/attachments/${id}`);
		expect(gone.status).toBe(404);
	} finally {
		tracker.close();
	}
});
