import type { PersistenceAdapter, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import type {
	CatalogDependencyAttributes,
	CatalogDependencyCreateInput,
	CatalogDependencyUpdateInput
} from './CatalogDependency.types';

/** Owns the catalog_dependencies table and its storage contract. */
export class CatalogDependency {
	static readonly definition = {
		table: 'catalog_dependencies',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			entityId: { type: 'string' },
			targetId: { type: 'string' },
			via: { type: 'string' }
		}
	} as const satisfies SqliteModel;
	static find(
		adapter: PersistenceAdapter,
		id: string
	): Promise<CatalogDependencyAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogDependencyAttributes>
	): Promise<CatalogDependencyAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogDependencyCreateInput
	): Promise<CatalogDependencyAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogDependencyUpdateInput
	): Promise<CatalogDependencyAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
