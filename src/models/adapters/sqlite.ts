import { createSqliteAdapter as createAdapter } from '../../adapters/development-tooling/SqliteAdapter';
import type { SqliteDatabase, SqliteModel } from '../../core/development-tooling/sqliteTypes';

export function createSqliteAdapter(db: SqliteDatabase, models: readonly SqliteModel[]) {
	return createAdapter(db, models);
}
