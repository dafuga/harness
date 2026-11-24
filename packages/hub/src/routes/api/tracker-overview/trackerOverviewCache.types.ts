// @harness-uid u_k4rxbz6pq3
import type { OverviewRecord } from './trackerOverviewInput.types';

/** The R2 operations the overview needs. The bucket is the Hub's CACHE binding. */
export type OverviewBucket = Pick<R2Bucket, 'get' | 'put' | 'delete'>;

/** What is stored: the snapshot as the server received it, and when that was. */
export interface OverviewProvenance {
	receivedAt: number;
	publisher: string;
}

export interface StoredOverview extends OverviewProvenance {
	snapshot: OverviewRecord;
}
