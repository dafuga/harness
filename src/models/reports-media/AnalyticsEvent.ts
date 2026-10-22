import type { PersistenceAdapter, SqliteModel } from '../../core/development-tooling/sqliteTypes';
import type {
	AnalyticsEventAttributes,
	AnalyticsEventCreateInput,
	AnalyticsEventUpdateInput
} from './AnalyticsEvent.types';

/** Owns the events table and its storage contract. */
export class AnalyticsEvent {
	static readonly definition = {
		table: 'events',
		primaryKey: 'id',
		fields: {
			id: { type: 'string' },
			timestamp: { type: 'string' },
			data: { type: 'json' }
		}
	} as const satisfies SqliteModel;
	static find(adapter: PersistenceAdapter, id: string): Promise<AnalyticsEventAttributes | null> {
		return adapter.find(this.definition.table, id);
	}
	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<AnalyticsEventAttributes>
	): Promise<AnalyticsEventAttributes[]> {
		return adapter.findBy(this.definition.table, { ...fields });
	}
	static create(
		adapter: PersistenceAdapter,
		input: AnalyticsEventCreateInput
	): Promise<AnalyticsEventAttributes> {
		return adapter.create(this.definition.table, { ...input });
	}
	static update(
		adapter: PersistenceAdapter,
		id: string,
		input: AnalyticsEventUpdateInput
	): Promise<AnalyticsEventAttributes | null> {
		return adapter.update(this.definition.table, id, { ...input });
	}
	static delete(adapter: PersistenceAdapter, id: string): Promise<boolean> {
		return adapter.delete(this.definition.table, id);
	}
}
