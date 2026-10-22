import { toSnakeCase } from '../../core/case';
import type { SqliteField, SqliteModel } from '../../core/development-tooling/sqliteTypes';

export function sqliteIdentifier(identifier: string): string {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier))
		throw new Error(`Invalid SQLite identifier: ${identifier}`);
	return `"${identifier}"`;
}

export function sqliteColumn(property: string, field: SqliteField): string {
	return field.column ?? toSnakeCase(property);
}

export function sqliteTableSql(model: SqliteModel): string {
	const primary = model.primaryKey ?? 'id';
	if (!Object.hasOwn(model.fields, primary)) throw new Error(`Missing primary key: ${primary}`);
	const names = Object.entries(model.fields).map(([property, field]) =>
		sqliteColumn(property, field)
	);
	if (new Set(names).size !== names.length)
		throw new Error(`Duplicate SQLite column in ${model.table}`);
	const columns = Object.entries(model.fields).map(([property, field]) => {
		const type = {
			string: 'TEXT',
			number: 'INTEGER',
			boolean: 'INTEGER',
			json: 'TEXT',
			blob: 'BLOB'
		}[field.type];
		if (!type) throw new Error(`Invalid SQLite field type: ${field.type}`);
		let constraint = field.nullable ? '' : ' NOT NULL';
		if (property === primary)
			constraint = ` PRIMARY KEY${field.type === 'number' ? '' : ' NOT NULL'}`;
		const fallback = field.default === 'timestamp' ? ' DEFAULT CURRENT_TIMESTAMP' : '';
		return `${sqliteIdentifier(sqliteColumn(property, field))} ${type}${constraint}${fallback}`;
	});
	return `CREATE TABLE IF NOT EXISTS ${sqliteIdentifier(model.table)} (${columns.join(', ')})`;
}
