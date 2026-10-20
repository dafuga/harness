import { createSqliteAdapter as createAdapter } from '../../adapters/SqliteAdapter';
import type { SqliteDatabase, SqliteModel } from '../../core/sqliteTypes';

export function createSqliteAdapter(db: SqliteDatabase, models: readonly SqliteModel[]) {
	return createAdapter(db, models);
}
