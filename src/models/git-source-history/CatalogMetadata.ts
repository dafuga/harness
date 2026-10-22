import type { PersistenceAdapter, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import type {
	CatalogMetadataAttributes,
	CatalogMetadataCreateInput,
	CatalogMetadataUpdateInput
} from './CatalogMetadata.types';

/** Owns the catalog_metadata table and its storage contract. */
export class CatalogMetadata {
	static readonly definition = {
		table: 'catalog_metadata',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			schemaVersion: { type: 'number' },
			digest: { type: 'string' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<CatalogMetadataAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogMetadataAttributes>
	): Promise<CatalogMetadataAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogMetadataCreateInput
	): Promise<CatalogMetadataAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogMetadataUpdateInput
	): Promise<CatalogMetadataAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
