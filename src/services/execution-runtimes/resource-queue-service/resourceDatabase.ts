import { chmodSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import type { ResourceDatabase, Statement } from './resourceDatabase.types';
export type { ResourceDatabase, Statement } from './resourceDatabase.types';
/** Bun CLI and the Node desktop use the same SQLite file and transaction protocol. */
export function resourceDatabase(home: string): ResourceDatabase {
	mkdirSync(home, { recursive: true, mode: 0o700 });
	const require = createRequire(resolve(home, 'resource-loader.cjs')),
		path = join(home, 'queue.sqlite');
	const db: ResourceDatabase =
		'Bun' in globalThis
			? new (require('bun:sqlite').Database)(path)
			: nodeDatabase(require('node:sqlite').DatabaseSync, path);
	chmodSync(path, 0o600);
	const version = db.query('PRAGMA user_version').get() as { user_version: number };
	if (![0, 1].includes(version.user_version)) {
		db.close();
		throw new Error('Unsupported resource queue schema');
	}
	db.exec(
		'PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS resource_jobs (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS resource_state (id TEXT PRIMARY KEY, data TEXT NOT NULL); PRAGMA user_version=1;'
	);
	return db;
}
function nodeDatabase(
	Database: new (path: string) => {
		exec(sql: string): unknown;
		prepare(sql: string): Statement;
		close(): void;
	},
	path: string
): ResourceDatabase {
	const db = new Database(path);
	return { exec: (sql) => db.exec(sql), query: (sql) => db.prepare(sql), close: () => db.close() };
}
