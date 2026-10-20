import type { PersistenceAdapter, SqliteModel } from '../core/sqliteTypes';
import type {
	CatalogBranchAttributes,
	CatalogBranchCreateInput,
	CatalogBranchUpdateInput
} from './CatalogBranch.types';

/** Owns the catalog_branches table and its storage contract. */
export class CatalogBranch {
	static readonly definition = {
		table: 'catalog_branches',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			head: { type: 'string' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<CatalogBranchAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogBranchAttributes>
	): Promise<CatalogBranchAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogBranchCreateInput
	): Promise<CatalogBranchAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogBranchUpdateInput
	): Promise<CatalogBranchAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
