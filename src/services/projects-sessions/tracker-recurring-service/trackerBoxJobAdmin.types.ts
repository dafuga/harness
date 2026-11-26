// @harness-uid u_nyrzsecwoe
import type { trackerBoxJobAdmin } from './trackerBoxJobAdmin';

export interface TrackerBoxJobTarget {
	id: string;
	every?: string | null;
	occurrence?: string | null;
}

export type TrackerBoxJobAdmin = ReturnType<typeof trackerBoxJobAdmin>;
