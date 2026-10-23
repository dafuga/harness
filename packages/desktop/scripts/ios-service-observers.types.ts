import type { TrackedProcess } from '../../../src/utils/processDescendants';
import type { processDescendants } from '../../../src/utils/processDescendants';

export interface SeenService {
	started: string;
	executable: string;
}

export interface WatchedService {
	known: TrackedProcess;
	watch: ReturnType<typeof processDescendants>;
}
