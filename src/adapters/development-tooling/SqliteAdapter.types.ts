// @harness-uid u_rbabjoss2e
/** A failure raised by the SQLite adapter. */
export class SqliteAdapterError extends Error {
	override name = 'SqliteAdapterError';
}
/** A stored field value: a scalar its type accepts, null, or an object for json and blob fields. */
export type SqliteFieldValue = string | number | boolean | null | object;
