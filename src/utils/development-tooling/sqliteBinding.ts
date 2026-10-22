import type { SqliteField, SqliteValue } from '../../core/development-tooling/sqliteTypes';
export function sqliteBinding(value: unknown, field: SqliteField): SqliteValue {
	if (value === null && field.nullable) return null;
	if (field.type === 'json' && value !== undefined) {
		const encoded = JSON.stringify(value);
		if (encoded !== undefined) return encoded;
	}
	const scalar = scalarBinding(value, field.type);
	if (scalar !== undefined) return scalar;
	throw new Error(`Invalid SQLite ${field.type} field value`);
}

function scalarBinding(value: unknown, type: SqliteField['type']): SqliteValue | undefined {
	if (type === 'boolean' && typeof value === 'boolean') return Number(value);
	if (type === 'string' && typeof value === 'string') return value;
	if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
	if (type === 'blob' && value instanceof Uint8Array) return value;
	return undefined;
}
