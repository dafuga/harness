// @harness-uid u_7kd6hzjalj
import { createRequire } from 'node:module';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';

const require = createRequire(import.meta.url);

/** Opens only the path the caller supplies, using the host runtime's built-in SQLite. */
export function openSqlite(path: string, readOnly = false): SqliteDatabase {
	if (process.versions.bun) {
		const { Database, constants } = require('bun:sqlite');
		// Bun's own SQLite on Linux reads a `file:` URI only when asked; Apple's on macOS always does.
		if (readOnly && path.startsWith('file:'))
			return new Database(path, constants.SQLITE_OPEN_READONLY | constants.SQLITE_OPEN_URI);
		return new Database(path, { readonly: readOnly, create: !readOnly });
	}
	const { DatabaseSync } = require('node:sqlite');
	return new DatabaseSync(path, { readOnly });
}
