import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { PhoneReplicaWriteService } from '../../../src/services/projects-sessions/tracker-phone-replica-service/PhoneReplicaWriteService';
import {
	attentionRevision,
	phoneReplicaRows,
	readPhoneReplicaItem
} from '../../../src/services/projects-sessions/tracker-phone-replica-service/phoneReplicaRows';

const at = Date.UTC(2026, 10, 25, 12);
const scope = 'a'.repeat(64);
let database: DatabaseSync;
let store: TrackerPersistenceService;
let api: TrackerLocalApiService;
let writer: PhoneReplicaWriteService;

beforeEach(() => {
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-mac', { now: () => at });
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		now: () => at
	});
	writer = new PhoneReplicaWriteService(store, () => at, {
		device: 'phone',
		token: 't'.repeat(40)
	});
});

afterEach(() => database.close());

const request = (path: string, payload: object) =>
	api.handle(
		new Request(`http://127.0.0.1:7700${path}`, {
			method: 'POST',
			headers: { 'x-tracker-as': 'fixture-actor' },
			body: JSON.stringify(payload)
		})
	);

test('the phone feed carries options and an option tap answers through the write path', async () => {
	const { id } = await (await request('/items', { title: 'Release gate' })).json();
	await request(`/items/${id}/flag`, {
		question: 'Deploy now?',
		options: [
			{ label: 'Deploy', effect: 'Ship to production' },
			{ label: 'Hold', effect: 'Wait a day', recommended: true }
		],
		confirm: 'deploy'
	});
	const [row] = phoneReplicaRows(database, 'fixture-mac', at);
	expect(row.flag).toMatchObject({
		state: 'open',
		question: 'Deploy now?',
		confirm: 'deploy',
		options: [
			{ label: 'Deploy', effect: 'Ship to production' },
			{ label: 'Hold', effect: 'Wait a day', recommended: true }
		]
	});
	const revision = attentionRevision(readPhoneReplicaItem(database, id, at)!);
	expect(revision).toBe(row.attentionRevision);
	const intent = { version: 1, itemId: id, action: 'answer', text: 'Hold', revision };
	const tap = (extra: object, n: number) =>
		writer.push(scope, {
			...intent,
			intentId: `00000000-0000-4000-8000-00000000000${n}`,
			...extra
		});
	expect(() => tap({ option: 7 }, 1)).toThrow('invalid phone option');
	expect(() => tap({ option: 1, action: 'note', revision: null }, 2)).toThrow();
	expect(tap({ option: 2 }, 3)).toMatchObject({ status: 'conflict' });
	expect(tap({ option: 2, confirmed: true }, 4)).toMatchObject({ status: 'accepted' });
	const answered = await (
		await api.handle(new Request(`http://127.0.0.1:7700/items/${id}`))
	).json();
	expect(answered).toMatchObject({ answer: 'Hold', answer_option: 2, resolved: true });
});
