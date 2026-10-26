import type { RepositoryRecord } from './FeaturePlanRepository.types';

export class FeaturePlanRepository<T extends RepositoryRecord> {
	private readonly records = new Map<number, T>();

	find(id: number): T | undefined {
		return this.records.get(id);
	}

	save(record: T): T {
		this.records.set(record.id, record);
		return record;
	}
}

export type { RepositoryRecord } from './FeaturePlanRepository.types';
