import { createRequire } from 'node:module';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';

const require = createRequire(import.meta.url);

/** Opens only the path the caller supplies, using the host runtime's built-in SQLite. */
export function openSqlite(path: string, readOnly = false): SqliteDatabase {
	if (process.versions.bun) {
		const { Database } = require('bun:sqlite');
		return new Database(path, { readonly: readOnly, create: !readOnly });
	}
	const { DatabaseSync } = require('node:sqlite');
	return new DatabaseSync(path, { readOnly });
}
