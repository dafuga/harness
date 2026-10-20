import type { PersistenceAdapter, SqliteModel } from '../core/sqliteTypes';
import type {
	CatalogRecordAttributes,
	CatalogRecordCreateInput,
	CatalogRecordUpdateInput
} from './CatalogRecord.types';

/** Owns the catalog_records table and its storage contract. */
export class CatalogRecord {
	static readonly definition = {
		table: 'catalog_records',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			commit: { type: 'string' },
			status: { type: 'string' },
			valid: { type: 'boolean' },
			data: { type: 'json' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<CatalogRecordAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogRecordAttributes>
	): Promise<CatalogRecordAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogRecordCreateInput
	): Promise<CatalogRecordAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogRecordUpdateInput
	): Promise<CatalogRecordAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
