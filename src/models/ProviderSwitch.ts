import type { PersistenceAdapter, SqliteModel } from '../core/sqliteTypes';
import type {
	ProviderSwitchAttributes,
	ProviderSwitchCreateInput,
	ProviderSwitchUpdateInput
} from './ProviderSwitch.types';

/** Owns the switches table and its storage contract. */
export class ProviderSwitch {
	static readonly definition = {
		table: 'switches',
		primaryKey: 'session',
		fields: {
			session: { type: 'string' },
			id: { type: 'string' },
			data: { type: 'json' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<ProviderSwitchAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<ProviderSwitchAttributes>
	): Promise<ProviderSwitchAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: ProviderSwitchCreateInput
	): Promise<ProviderSwitchAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: ProviderSwitchUpdateInput
	): Promise<ProviderSwitchAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
