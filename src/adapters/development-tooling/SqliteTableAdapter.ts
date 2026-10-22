import type { SqliteDatabase, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import { sqliteColumn, sqliteIdentifier } from '../../utils/development-tooling/sqliteTableSql';
import { sqliteInput } from '../../utils/development-tooling/sqliteInput';
import { sqliteRow } from '../../utils/development-tooling/sqliteRow';

/** Builds only model-declared identifiers; all application values are bound parameters. */
export class SqliteTableAdapter {
	private readonly table: string;
	private readonly primary: string;
	constructor(
		private readonly db: SqliteDatabase,
		private readonly model: SqliteModel
	) {
		this.table = sqliteIdentifier(model.table);
		this.primary = model.primaryKey ?? 'id';
	}
	find<T>(id: number | string): T | null {
		return this.findBy<T>({ [this.primary]: id })[0] ?? null;
	}
	findBy<T>(fields: Record<string, unknown>): T[] {
		const inputs = sqliteInput(this.model, fields);
		const where = inputs.map(
			({ column, value }) => `${column} ${value === null ? 'IS NULL' : '= ?'}`
		);
		const sql = `SELECT * FROM ${this.table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
		const bindings = inputs.filter(({ value }) => value !== null).map(({ value }) => value);
		return this.db
			.prepare(sql)
			.all(...bindings)
			.map((row) => sqliteRow<T>(this.model, row)!);
	}
	insert<T>(input: Record<string, unknown>): T {
		const inputs = sqliteInput(this.model, input);
		const columns = inputs.map(({ column }) => column).join(', ');
		const values = inputs.map(() => '?').join(', ');
		const sql = inputs.length ? `(${columns}) VALUES (${values})` : 'DEFAULT VALUES';
		const row = this.db
			.prepare(`INSERT INTO ${this.table} ${sql} RETURNING *`)
			.get(...inputs.map(({ value }) => value));
		return sqliteRow<T>(this.model, row)!;
	}
	update<T>(id: number | string, input: Record<string, unknown>): T | null {
		if (Object.hasOwn(input, this.primary))
			throw new Error('A SQLite primary key cannot be updated');
		if (Object.keys(input).length === 0) return this.find<T>(id);
		const values = { ...input };
		if (this.model.fields.updatedAt?.default === 'timestamp')
			values.updatedAt = new Date().toISOString();
		const inputs = sqliteInput(this.model, values);
		const key = sqliteIdentifier(sqliteColumn(this.primary, this.model.fields[this.primary]));
		const assignments = inputs.map(({ column }) => `${column} = ?`).join(', ');
		const sql = `UPDATE ${this.table} SET ${assignments} WHERE ${key} = ? RETURNING *`;
		return sqliteRow<T>(
			this.model,
			this.db.prepare(sql).get(...inputs.map(({ value }) => value), id)
		);
	}
	delete(id: number | string): boolean {
		const key = sqliteIdentifier(sqliteColumn(this.primary, this.model.fields[this.primary]));
		return (
			Number(this.db.prepare(`DELETE FROM ${this.table} WHERE ${key} = ?`).run(id).changes) > 0
		);
	}
}
