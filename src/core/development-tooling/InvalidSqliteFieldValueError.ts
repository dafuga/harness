// @harness-uid u_sggnkny4w3
/** A value that cannot be bound to its declared SQLite field type. */
export class InvalidSqliteFieldValueError extends Error {
	override name = 'InvalidSqliteFieldValueError';
}
