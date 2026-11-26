// @harness-uid u_lqt6xmept4
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerHostSupervisorOptions } from '../TrackerHostSupervisorService.types';
import { rotateSupervisedLog } from './rotateSupervisedLog';
import { appendingTrackerChild, supervisorLog } from './appendingTrackerChild';

const defaults = { initialMs: 1000, maxMs: 60_000, stableMs: 60_000 };

/** Restart the service whenever it exits, backing off while it keeps failing quickly. */
export async function keepTrackerServing(
	options: TrackerHostSupervisorOptions,
	signal: AbortSignal
): Promise<void> {
	const { serve, log, backoff = defaults } = options;
	let wait = backoff.initialMs;
	while (!signal.aborted) {
		rotateSupervisedLog(options);
		const started = Date.now();
		const outcome = await appendingTrackerChild(serve, log, signal);
		if (signal.aborted) return;
		if (Date.now() - started >= backoff.stableMs) wait = backoff.initialMs;
		supervisorLog(log, `tracker service exited (${outcome}); restarting in ${wait} ms`);
		await delay(wait, undefined, { signal }).catch(() => {});
		wait = Math.min(wait * 2, backoff.maxMs);
	}
}
