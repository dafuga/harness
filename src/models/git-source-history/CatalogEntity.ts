import type { PersistenceAdapter, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import type {
	CatalogEntityAttributes,
	CatalogEntityCreateInput,
	CatalogEntityUpdateInput
} from './CatalogEntity.types';

/** Owns the catalog_entities table and its storage contract. */
export class CatalogEntity {
	static readonly definition = {
		table: 'catalog_entities',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			unitId: { type: 'string' },
			version: { type: 'string' },
			kind: { type: 'string' },
			title: { type: 'string' },
			responsibility: { type: 'string' },
			data: { type: 'json' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<CatalogEntityAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogEntityAttributes>
	): Promise<CatalogEntityAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogEntityCreateInput
	): Promise<CatalogEntityAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogEntityUpdateInput
	): Promise<CatalogEntityAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
