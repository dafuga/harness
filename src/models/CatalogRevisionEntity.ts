import type { PersistenceAdapter, SqliteModel } from '../core/sqliteTypes';
import type {
	CatalogRevisionEntityAttributes,
	CatalogRevisionEntityCreateInput,
	CatalogRevisionEntityUpdateInput
} from './CatalogRevisionEntity.types';

/** Owns the catalog_revision_entities table and its storage contract. */
export class CatalogRevisionEntity {
	static readonly definition = {
		table: 'catalog_revision_entities',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			commit: { type: 'string' },
			entityId: { type: 'string' }
		}
	} as const satisfies SqliteModel;
	static find(
		adapter: PersistenceAdapter,
		id: string
	): Promise<CatalogRevisionEntityAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogRevisionEntityAttributes>
	): Promise<CatalogRevisionEntityAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogRevisionEntityCreateInput
	): Promise<CatalogRevisionEntityAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogRevisionEntityUpdateInput
	): Promise<CatalogRevisionEntityAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
