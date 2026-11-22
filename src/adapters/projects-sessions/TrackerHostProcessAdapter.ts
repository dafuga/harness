// @harness-uid u_ucbos7kmyv
import { TrackerHostProcessError } from './tracker-host-process-adapter/TrackerHostProcessError';
import type { TrackerHostProcessOperation } from './TrackerHostProcessAdapter.types';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from './tracker-host-process-adapter/trackerHostCommand';

/** Invoke a configured host driver with versioned JSON and an isolated environment. */
export class TrackerHostProcessAdapter {
	private readonly executable: string;

	constructor(path: string) {
		this.executable = controlledTrackerExecutable(path);
	}

	request(
		operation: TrackerHostProcessOperation,
		payload: object,
		signal: AbortSignal
	): Promise<unknown> {
		signal.throwIfAborted();
		return trackerHostJson(this.executable, operation, { ...payload, version: 1 }, signal);
	}
}

async function trackerHostJson(
	executable: string,
	operation: TrackerHostProcessOperation,
	payload: object,
	signal: AbortSignal
): Promise<unknown> {
	try {
		const result = await runTrackerHostCommand(executable, [operation], signal, {
			input: JSON.stringify(payload)
		});
		if (result.code === 0) return JSON.parse(result.stdout);
	} catch {
		// Driver stderr and payload may contain private workstation information.
	}
	throw new TrackerHostProcessError(`Tracker host process failed during ${operation}`);
}
