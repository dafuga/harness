import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerSnapshotAdapter } from '../../../src/adapters/projects-sessions/TrackerSnapshotAdapter';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';

const adapter = new TrackerSnapshotAdapter();
function withSnapshots(use: (before: string, after: string, root: string) => void | Promise<void>) {
	return withTempDir('harness-tracker-snapshot-', (root) =>
		use(join(root, 'before # checkpoint.sqlite'), join(root, 'after.sqlite'), root)
	);
}

function sql(file: string, statements: string) {
	const db = new DatabaseSync(file);
	try {
		db.exec(statements);
	} finally {
		db.close();
	}
}

function fixture(file: string, reverse = false) {
	sql(
		file,
		`
		CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT) WITHOUT ROWID;
		INSERT INTO meta VALUES
			('db_id', 'fixture-identity'), ('pull_cursor', '2'), ('peer_pull_cursor', '4'),
			('pushed_seq', '1'), ('peer_pushed_seq', '2'), ('peer_push_all', '0');
		CREATE TABLE ops(
			seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT UNIQUE, node TEXT, fields TEXT
		);
		INSERT INTO ops VALUES
			(1, 'a', 'spoke', 'initial'), (2, 'b', 'remote', 'pulled'),
			(3, 'c', 'spoke', 'local-pending'), (4, 'd', 'remote', 'relay-pending');
		CREATE TABLE webhook_outbox (id TEXT PRIMARY KEY, payload TEXT);
		INSERT INTO webhook_outbox VALUES ('queued', 'synthetic confidential payload');
		CREATE TABLE "typed""values" ("column""one", v);
		INSERT INTO "typed""values" VALUES ${reverse ? "(1, X'31'), (1, 1.0), (1, 1)" : "(1, 1), (1, 1.0), (1, X'31')"},
			(2, 9007199254740993), (3, '1'), (4, NULL), (5, char(0, 65)),
			(6, 'duplicate'), (6, 'duplicate'), (7, 1e999), (8, X'');
		CREATE INDEX queue_cursor ON ops (node, seq);
	`
	);
}

test('compare matches typed rows across files and insertion orders without exposing values or touching the snapshots', () =>
	withSnapshots(async (before, after, root) => {
		fixture(before);
		fixture(after, true);
		sql(after, 'PRAGMA journal_mode = WAL');
		const contents = [readFileSync(before), readFileSync(after)];
		const directoryEntries = readdirSync(root);
		await measureWorkload(
			'adapter.projects-sessions-tracker-snapshot',
			'compare-equivalent-synthetic-checkpoints',
			() => {
				const comparison = adapter.compare(before, after, { node: 'spoke', peerRelayOps: true });
				expect(comparison).toMatchObject({
					matches: true,
					schemaChanged: false,
					changedTables: [],
					changedPendingLinks: []
				});
				expect(comparison.before).toEqual(comparison.after);
				expect(comparison.before.tables).toContainEqual({
					name: 'typed"values',
					rowCount: 11,
					sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
				});
				expect(comparison.before.pendingPush).toEqual({
					hub: { rowCount: 1, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
					peer: { rowCount: 2, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }
				});
				const response = JSON.stringify(comparison);
				expect(response).not.toContain('synthetic confidential payload');
				expect(response).not.toContain('fixture-identity');
				expect(response).not.toContain('local-pending');
				expect(response).not.toContain('CREATE TABLE');
			}
		);
		expect([readFileSync(before), readFileSync(after)]).toEqual(contents);
		expect(readdirSync(root)).toEqual(directoryEntries);
	}));

test('compare detects equal-count changes in rows, cursors, queue payloads, and optional schema', () =>
	withSnapshots((before, after) => {
		fixture(before);
		fixture(after);
		sql(
			after,
			`
		UPDATE meta SET v = '3' WHERE k = 'peer_pull_cursor';
		UPDATE ops SET fields = 'changed' WHERE seq = 3;
		UPDATE webhook_outbox SET payload = 'different payload';
		UPDATE "typed""values" SET v = 9007199254740992 WHERE "column""one" = 2;
		UPDATE sqlite_sequence SET seq = 5 WHERE name = 'ops';
		CREATE TABLE adapter_links (id TEXT PRIMARY KEY);
	`
		);
		const comparison = adapter.compare(before, after, { node: 'spoke', peerRelayOps: true });
		expect(comparison).toMatchObject({
			matches: false,
			schemaChanged: true,
			changedTables: [
				'adapter_links',
				'meta',
				'ops',
				'sqlite_sequence',
				'typed"values',
				'webhook_outbox'
			],
			changedPendingLinks: ['hub', 'peer']
		});
		expect(comparison.before.pendingPush?.hub.rowCount).toBe(1);
		expect(comparison.after.pendingPush?.hub.rowCount).toBe(1);
	}));

test('read keeps SQLite storage classes distinct and includes replay and relay selections', () =>
	withSnapshots((before, after) => {
		fixture(before);
		fixture(after);
		sql(
			after,
			`
		UPDATE "typed""values" SET v = CAST(v AS TEXT) WHERE typeof(v) = 'real' AND v = 1.0;
		UPDATE meta SET v = '1' WHERE k = 'peer_push_all';
		INSERT INTO meta VALUES ('push_all', '1');
	`
		);
		const original = adapter.read(before, { node: 'spoke', peerRelayOps: false });
		const changed = adapter.read(after, { node: 'spoke', peerRelayOps: false });
		expect(original.pendingPush).toMatchObject({ hub: { rowCount: 1 }, peer: { rowCount: 1 } });
		expect(changed.pendingPush).toMatchObject({ hub: { rowCount: 3 }, peer: { rowCount: 2 } });
		expect(adapter.read(before, { node: 'spoke', hubRelayOps: true }).pendingPush?.hub).toEqual(
			changed.pendingPush?.hub
		);
		expect(original.tables.find(({ name }) => name === 'typed"values')?.sha256).not.toBe(
			changed.tables.find(({ name }) => name === 'typed"values')?.sha256
		);
	}));

test('read rejects missing or corrupt snapshots and WAL frames without exposing database errors', () =>
	withSnapshots((before, after, root) => {
		expect(() => adapter.read(before)).toThrow('Unable to read SQLite snapshot');
		expect(readdirSync(root)).toEqual([]);
		writeFileSync(before, 'synthetic invalid database');
		expect(() => adapter.read(before)).toThrow('Unable to read SQLite snapshot');
		fixture(after);
		const writer = new DatabaseSync(after);
		try {
			writer.exec("PRAGMA journal_mode = WAL; UPDATE meta SET v = 'new frame' WHERE k = 'db_id'");
			expect(() => adapter.read(after)).toThrow(
				'SQLite snapshot has a nonempty WAL or rollback journal'
			);
		} finally {
			writer.close();
		}
	}));
