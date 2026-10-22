import type { SqliteField, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import { sqliteColumn } from './sqliteTableSql';
export function sqliteRow<T>(model: SqliteModel, row: unknown): T | null {
	if (row === null || row === undefined) return null;
	const stored = row as Record<string, unknown>;
	const result = Object.fromEntries(
		Object.entries(model.fields).map(([property, field]) => {
			const value = stored[sqliteColumn(property, field)];
			return [property, decode(value, field)];
		})
	);
	return result as T;
}

function decode(value: unknown, field: SqliteField): unknown {
	if (value === null) return null;
	if (field.type === 'json') return JSON.parse(String(value));
	if (field.type === 'boolean') return Boolean(value);
	return value;
}
