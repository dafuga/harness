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

/** Existing build services could not be observed: the baseline was missing, or a service was not attested or anchored. */
export class ServiceObservationError extends Error {
	override name = 'ServiceObservationError';
}
