// @harness-uid u_umjvzneh5k
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';

/** Notes the Tracker or Hub writes about an item, not progress its owner reported. */
const automatedNote =
	/^(watchdog|auto-launch|launch |unblocked|hub message:|due scheduler|stopped: watchdog)/i;

/**
 * @pure Where a piece of work really is: why it is blocked, or the latest milestone its owner
 * noted. Planning stages stay at their default for most items, so they cannot say this.
 */
export function homeWorkNow(item: TrackerItemRecord): string | null {
	if (item.status === 'blocked') {
		const reason = homeText(item.blocked_reason ?? item.question, 240);
		if (reason) return `Blocked: ${reason}`;
	}
	const notes = item.notes_log ?? [];
	for (let index = notes.length - 1; index >= 0; index -= 1) {
		const text = notes[index]?.text.trim();
		if (text && !automatedNote.test(text)) return homeText(text, 240);
	}
	return null;
}
