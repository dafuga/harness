// @harness-uid u_3matsrl4l7
import type { CanaryClock, CanaryTracker } from './canary.types';

/** What the native CLI prints when the daemon gave no reply, as during a restart or release. */
const unanswered = 'tracker: native service unavailable';
const retryMs = 3000;
const patienceMs = 300_000;

/**
 * Repeats a command the Tracker did not answer, for up to five minutes per command. A refusal is
 * never repeated. A reply lost after the write can repeat that write: at worst a second note, or
 * an extra test item that was never flagged.
 */
export function patientTracker(
	tracker: CanaryTracker,
	clock: CanaryClock,
	log: (line: string) => void
): CanaryTracker {
	return async (args) => {
		const end = clock.now() + patienceMs;
		for (let attempt = 1; ; attempt += 1) {
			try {
				return await tracker(args);
			} catch (error) {
				if (!String(error).includes(unanswered) || clock.now() >= end) throw error;
				if (attempt === 1) log(`tracker did not answer "${args[0]}"; trying again`);
				await clock.wait(retryMs);
			}
		}
	};
}
