// @harness-uid u_idcdl5fjlo
import type { TrackedProcess, processDescendants } from '../../../src/utils/processDescendants';

export interface IosServiceProcess {
	started: string;
	executable: string;
}

export interface WatchedService {
	known: TrackedProcess;
	watch: ReturnType<typeof processDescendants>;
}
export { ServiceObservationError } from './ServiceObservationError';
