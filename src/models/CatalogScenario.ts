import type { PersistenceAdapter, SqliteModel } from '../core/sqliteTypes';
import type {
	CatalogScenarioAttributes,
	CatalogScenarioCreateInput,
	CatalogScenarioUpdateInput
} from './CatalogScenario.types';

/** Owns the catalog_scenarios table and its storage contract. */
export class CatalogScenario {
	static readonly definition = {
		table: 'catalog_scenarios',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			scenarioId: { type: 'string' },
			commit: { type: 'string' },
			title: { type: 'string' },
			data: { type: 'json' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<CatalogScenarioAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<CatalogScenarioAttributes>
	): Promise<CatalogScenarioAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: CatalogScenarioCreateInput
	): Promise<CatalogScenarioAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: CatalogScenarioUpdateInput
	): Promise<CatalogScenarioAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
