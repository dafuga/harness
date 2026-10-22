/** The small synchronous boundary implemented by Bun SQLite and Node DatabaseSync. */
export type SqliteValue = string | number | bigint | Uint8Array | null;
export interface SqliteStatement {
	all(...bindings: SqliteValue[]): unknown[];
	get(...bindings: SqliteValue[]): unknown;
	run(...bindings: SqliteValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
export interface SqliteDatabase {
	prepare(sql: string): SqliteStatement;
	exec(sql: string): unknown;
	close(): void;
}
export interface SqliteField {
	type: 'string' | 'number' | 'boolean' | 'json' | 'blob';
	column?: string;
	nullable?: boolean;
	default?: 'timestamp';
}
/** One declared application model for one table. Fields are application property names. */
export interface SqliteModel {
	table: string;
	primaryKey?: string;
	fields: Readonly<Record<string, SqliteField>>;
}
export interface PersistenceAdapter {
	find<T>(table: string, id: number | string): Promise<T | null>;
	findBy<T>(table: string, fields: Record<string, unknown>): Promise<T[]>;
	create<T>(table: string, input: Record<string, unknown>): Promise<T>;
	update<T>(table: string, id: number | string, input: Record<string, unknown>): Promise<T | null>;
	delete(table: string, id: number | string): Promise<boolean>;
}
