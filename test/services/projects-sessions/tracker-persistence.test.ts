import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

let database: DatabaseSync;
let store: TrackerPersistenceService;

beforeEach(() => {
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-spoke', {
		now: () => 5000,
		databaseId: () => 'fixture-db-id'
	});
});

afterEach(() => database.close());

test('appendLocal publishes a committed change and deduplicates replication', () => {
	const listener = vi.fn(() => expect(store.maxSeq()).toBe(1));
	const unsubscribe = store.subscribe(listener);
	const first = store.appendLocal({
		itemId: 'fixture-item',
		fields: { title: 'Fixture', status: 'open' }
	});
	expect(first.node).toBe('fixture-spoke');
	expect(store.applyOps([first])).toBe(0);
	expect(store.opsSince(0, 100, { onlyNode: 'fixture-spoke' })).toEqual([{ ...first, seq: 1 }]);
	expect(store.countLocalOpsSince(0)).toBe(1);
	expect(listener).toHaveBeenCalledTimes(1);
	unsubscribe();
	store.appendLocal({ itemId: 'fixture-item', fields: { 'note+': 'Second' } });
	expect(listener).toHaveBeenCalledTimes(1);
});

test('writeMeta stores cursor groups atomically and preserves the store identity', () => {
	store.writeMeta({ pushed_seq: '1', peer_pushed_seq: '2' });
	database.exec(`
		CREATE TRIGGER refuse_fixture_peer_cursor BEFORE UPDATE ON meta
		WHEN new.k = 'peer_pushed_seq' BEGIN SELECT RAISE(ABORT, 'fixture cursor refused'); END
	`);
	expect(() => store.writeMeta({ pushed_seq: '3', peer_pushed_seq: '4' })).toThrow(
		'fixture cursor refused'
	);
	const reopened = new TrackerPersistenceService(database, 'fixture-spoke', {
		databaseId: () => 'unexpected-new-identity'
	});
	expect(reopened.dbId).toBe('fixture-db-id');
	expect(reopened.getMeta('pushed_seq')).toBe('1');
	expect(reopened.getMeta('peer_pushed_seq')).toBe('2');
});
