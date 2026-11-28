import { DatabaseSync } from 'node:sqlite';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';

const now = Date.parse('2026-11-23T12:00:00.000Z');
export const scope = 'a'.repeat(64);
export const updatedAt = new Date(now).toISOString();
export const phoneWrite = { device: 'fixture-phone', token: 'synthetic-fixture-write-token-0001' };

export function hub(role: 'hub' | 'spoke' = 'hub') {
	const db = new DatabaseSync(':memory:');
	const options = {
		node: 'fixture',
		role,
		now: () => now,
		storage: { databaseId: () => 'fixture-db' },
		phoneWrite
	};
	const runtime = () => new TrackerNativeRuntimeService(db, options);
	let instance = runtime();
	const pull = (query = '') =>
		instance.items.handle(new Request('http://localhost/phone-replica/v1?scope=' + scope + query));
	return {
		db,
		pull,
		write: (input: object, token = phoneWrite.token, device = phoneWrite.device) =>
			instance.items.handle(
				new Request('http://localhost/phone-replica/v1/write', {
					method: 'POST',
					headers: {
						authorization: 'Bearer ' + token,
						'content-type': 'application/json',
						'x-tracker-phone-device': device,
						'x-tracker-phone-scope': scope
					},
					body: JSON.stringify({ version: 1, itemId: 'fixture001', ...input })
				})
			),
		restart: () => (instance = runtime()),
		item: (
			itemId: string,
			fields: Parameters<typeof instance.store.appendLocal>[0]['fields'],
			actor = 'fixture'
		) => instance.store.appendLocal({ itemId, fields, actor }),
		release: (itemId: string, body: object) =>
			instance.items.handle(
				new Request(`http://localhost/items/${itemId}/release`, {
					method: 'POST',
					headers: { 'x-tracker-as': 'Chief of Staff' },
					body: JSON.stringify(body)
				})
			)
	};
}
