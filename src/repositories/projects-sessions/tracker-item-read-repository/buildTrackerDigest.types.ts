// @harness-uid u_xba7ieg4je
import type { TrackerProjectStatus } from '../TrackerItemReadRepository.types';
import type { TrackerRunReadRepository } from '../TrackerRunReadRepository';

export type StoredRecurringResult = { occurrence: string; status: string; note?: string | null };
export type TrackerDigestSources = {
	runs: TrackerRunReadRepository;
	projects: TrackerProjectStatus[];
};
