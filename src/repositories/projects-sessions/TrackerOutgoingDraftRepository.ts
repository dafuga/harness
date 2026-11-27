// @harness-uid u_4snu2qhejr
import type { RepositoryRecord } from './TrackerOutgoingDraftRepository.types';

export class TrackerOutgoingDraftRepository<T extends RepositoryRecord> {
	private readonly records = new Map<number, T>();

	find(id: number): T | undefined {
		return this.records.get(id);
	}

	save(record: T): T {
		this.records.set(record.id, record);
		return record;
	}
}

export type { RepositoryRecord } from './TrackerOutgoingDraftRepository.types';
