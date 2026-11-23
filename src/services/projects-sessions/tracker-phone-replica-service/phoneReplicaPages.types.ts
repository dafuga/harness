// @harness-uid u_st4dufvqxm
import type { ProjectionRow } from './PhoneReplicaFeed.types';

export interface PhoneReplicaSnapshot {
	id: string;
	cursor: string;
	startedAt: number;
	rows: ProjectionRow[];
}
