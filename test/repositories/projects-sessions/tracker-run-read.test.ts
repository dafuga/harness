import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';

test('reads local and remote runs by legacy queue order without conflating run identifiers', () => {
	const database = new DatabaseSync(':memory:');
	try {
		const reads = new TrackerRunReadRepository(database, 'fixture-alpha');
		expect(reads.list()).toEqual([]);
		database.exec(`
			CREATE TABLE runs(id INTEGER, item_id TEXT, queued_at INTEGER, state TEXT);
			CREATE TABLE remote_runs(node TEXT, id INTEGER, item_id TEXT, queued_at INTEGER, state TEXT);
			INSERT INTO runs VALUES (1, 'fixture-item', 100, 'finished'), (2, 'another-item', 300, 'running');
			INSERT INTO remote_runs VALUES ('fixture-beta', 1, 'fixture-item', 200, 'finished');
		`);
		expect(reads.list({ limit: 1 })).toEqual([
			{
				id: 2,
				node: 'fixture-alpha',
				item_id: 'another-item',
				queued_at: 300,
				state: 'running'
			}
		]);
		expect(reads.list({ itemId: 'fixture-item', limit: 1 })).toMatchObject([
			{ id: 1, node: 'fixture-alpha' },
			{ id: 1, node: 'fixture-beta' }
		]);
		expect(reads.finished()).toMatchObject([
			{ id: 1, node: 'fixture-alpha' },
			{ id: 1, node: 'fixture-beta' }
		]);
	} finally {
		database.close();
	}
});
