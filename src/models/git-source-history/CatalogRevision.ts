import type { PersistenceAdapter, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import type {
	CatalogRevisionAttributes,
	CatalogRevisionCreateInput,
	CatalogRevisionUpdateInput
} from './CatalogRevision.types';

/** Owns the catalog_revisions table and its storage contract. */
export class CatalogRevision {
	static readonly definition = {
		table: 'catalog_revisions',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			subject: { type: 'string' },
			committedAt: { type: 'string' },
			coverage: { type: 'string' },
			registryAvailable: { type: 'boolean' },
			data: { type: 'json' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<CatalogRevisionAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogRevisionAttributes>
	): Promise<CatalogRevisionAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogRevisionCreateInput
	): Promise<CatalogRevisionAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogRevisionUpdateInput
	): Promise<CatalogRevisionAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
