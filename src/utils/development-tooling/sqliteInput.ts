// @harness-uid u_ofidpk73mq
import type { SqliteModel } from '../../core/development-tooling/sqliteTypes';
import { sqliteColumn, sqliteIdentifier } from './sqliteTableSql';
import { sqliteBinding } from './sqliteBinding';
import { UnknownSqliteFieldError } from './sqliteInput.types';
export function sqliteInput(model: SqliteModel, input: Record<string, unknown>) {
	return Object.entries(input).map(([property, value]) => {
		const field = Object.hasOwn(model.fields, property) ? model.fields[property] : undefined;
		if (!field) throw new UnknownSqliteFieldError(`Unknown SQLite field: ${property}`);
		return {
			column: sqliteIdentifier(sqliteColumn(property, field)),
			value: sqliteBinding(value, field)
		};
	});
}
