import type {
	PersistenceAdapter,
	SqliteDatabase,
	SqliteModel,
	SqliteValue
} from '../../core/development-tooling/sqliteTypes';
import {
	sqliteColumn,
	sqliteIdentifier,
	sqliteTableSql
} from '../../utils/development-tooling/sqliteTableSql';
import { SqliteTableAdapter } from './SqliteTableAdapter';

/** A driver-injected adapter: constructing or importing it never opens a database. */
export class SqliteAdapter implements PersistenceAdapter {
	private readonly models = new Map<string, SqliteModel>();
	private savepoint = 0;
	constructor(
		private readonly db: SqliteDatabase,
		models: readonly SqliteModel[]
	) {
		for (const model of models) {
			sqliteTableSql(model);
			if (this.models.has(model.table)) throw new Error(`Duplicate SQLite model: ${model.table}`);
			this.models.set(model.table, model);
		}
	}
	private table(name: string): SqliteTableAdapter {
		const model = this.models.get(name);
		if (!model) throw new Error(`No SQLite model for table: ${name}`);
		return new SqliteTableAdapter(this.db, model);
	}
	async find<T>(table: string, id: number | string): Promise<T | null> {
		return this.table(table).find<T>(id);
	}
	async findBy<T>(table: string, fields: Record<string, unknown>): Promise<T[]> {
		return this.table(table).findBy<T>(fields);
	}
	async create<T>(table: string, input: Record<string, unknown>): Promise<T> {
		return this.insert<T>(table, input);
	}
	async update<T>(
		table: string,
		id: number | string,
		input: Record<string, unknown>
	): Promise<T | null> {
		return this.table(table).update<T>(id, input);
	}
	async delete(table: string, id: number | string): Promise<boolean> {
		return this.table(table).delete(id);
	}
	/** Synchronous insertion is also available inside an atomic transaction. */
	insert<T>(table: string, input: Record<string, unknown>): T {
		return this.table(table).insert<T>(input);
	}
	query<T>(sql: string, bindings: SqliteValue[] = []): T[] {
		return this.db.prepare(sql).all(...bindings) as T[];
	}
	execute(sql: string, bindings: SqliteValue[] = []) {
		return this.db.prepare(sql).run(...bindings);
	}
	createTables(): void {
		for (const model of this.models.values()) this.db.exec(sqliteTableSql(model));
	}
	/** Refuses async callbacks so a transaction cannot commit before its writes finish. */
	transaction<T>(write: () => T): T {
		if (Object.prototype.toString.call(write) === '[object AsyncFunction]')
			throw new Error('SQLite transactions require a synchronous callback');
		const name = `harness_${this.savepoint++}`;
		this.db.exec(`SAVEPOINT ${name}`);
		try {
			const result = write();
			if (result && typeof (result as { then?: unknown }).then === 'function')
				throw new Error('SQLite transactions require a synchronous callback');
			this.db.exec(`RELEASE ${name}`);
			return result;
		} catch (error) {
			this.db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
			throw error;
		}
	}
	/** Every application table and declared column must have its explicit model. */
	assertModels(): void {
		const tables = this.query<{ name: string }>(
			"SELECT name FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*'"
		);
		for (const { name } of tables)
			if (!this.models.has(name)) throw new Error(`No SQLite model for table: ${name}`);
		for (const model of this.models.values()) {
			const actual = this.query<{ name: string }>(
				`PRAGMA table_info(${sqliteIdentifier(model.table)})`
			);
			const expected = Object.entries(model.fields)
				.map(([property, field]) => sqliteColumn(property, field))
				.sort();
			if (JSON.stringify(actual.map(({ name }) => name).sort()) !== JSON.stringify(expected))
				throw new Error(`SQLite model columns do not match table: ${model.table}`);
		}
	}
}

export function createSqliteAdapter(
	db: SqliteDatabase,
	models: readonly SqliteModel[]
): SqliteAdapter {
	return new SqliteAdapter(db, models);
}
